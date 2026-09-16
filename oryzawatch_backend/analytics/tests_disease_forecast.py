"""
Tests for the airborne disease forecast (analytics/ml). No network access and
no trained model needed: weather is synthetic, and the API tests patch the
inference calls.
"""
from unittest.mock import patch

import numpy as np
import pandas as pd
from django.core.cache import cache
from django.test import SimpleTestCase
from rest_framework import status
from rest_framework.test import APITestCase

from analytics.ml import epidemiology as ep
from analytics.ml.features import MIN_HISTORY_DAYS, build_features, feature_columns
from analytics.ml.modeling import ensemble_probability, make_random_forest, make_xgboost, risk_level
from analytics.ml.predict import InvalidLocation, ModelNotTrained, _wind, clamp_days, validate_point
from analytics.ml.sources import to_daily
from analytics.ml.train import EMBARGO_DAYS, date_folds


def synthetic_hourly(days=150, seed=0, wet=True, location='TEST', start='2024-01-01'):
    """Plausible lowland-tropics hourly weather with a diurnal cycle."""
    rng = np.random.default_rng(seed)
    time = pd.date_range(start, periods=days * 24, freq='h')
    hour = time.hour.to_numpy()
    diurnal = -np.cos(2 * np.pi * (hour - 3) / 24)
    temp = 26.5 + 3.5 * diurnal + rng.normal(0, 0.6, len(time))
    rh = np.clip((92 if wet else 70) - 14 * diurnal + rng.normal(0, 3, len(time)), 30, 100)
    dew = temp - (100 - rh) / 5.0
    rain = np.where(rng.random(len(time)) < (0.12 if wet else 0.02), rng.gamma(1.5, 2.0, len(time)), 0.0)
    return pd.DataFrame({
        'time': time,
        'elevation': 20.0,
        'temperature_2m': temp,
        'relative_humidity_2m': rh,
        'dew_point_2m': dew,
        'precipitation': rain,
        'wind_speed_10m': np.abs(10 + rng.normal(0, 4, len(time))),
        'wind_direction_10m': (180 + rng.normal(0, 25, len(time))) % 360,
        'shortwave_radiation': np.clip(900 * np.sin(np.pi * (hour - 6) / 12), 0, None),
        'location': location,
        'latitude': 7.4,
        'longitude': 125.7,
    })


class FeatureTests(SimpleTestCase):
    def test_features_are_complete_and_label_free(self):
        hourly = synthetic_hourly()
        daily = to_daily(hourly)
        labels = ep.simulate_outbreaks(hourly, daily, location='TEST', seed=1)
        features = build_features(daily)

        self.assertEqual(len(features), len(daily) - (MIN_HISTORY_DAYS - 1))
        self.assertEqual(int(features.drop(columns=['location']).isna().sum().sum()), 0)
        inputs = set(feature_columns(features))
        self.assertFalse(inputs & set(ep.label_columns()))
        self.assertFalse(inputs & set(labels.columns) - {'date'})

    def test_wind_direction_is_vector_averaged(self):
        hourly = synthetic_hourly(days=2)
        hourly['wind_direction_10m'] = np.where(np.arange(len(hourly)) % 2, 350.0, 10.0)
        row = to_daily(hourly).iloc[0]
        wind = _wind(row)
        # A naive mean of 350 and 10 is 180, pointing the wrong way.
        self.assertIn(wind['wind_from_deg'], (0, 360))
        self.assertEqual(wind['wind_from'], 'N')
        self.assertEqual(wind['spread_toward'], 'S')


class EpidemiologyTests(SimpleTestCase):
    def test_temperature_response_bounds(self):
        profile = ep.PROFILES['BLAST']
        response = ep.temperature_response([profile.t_min - 1, profile.t_opt, profile.t_max + 1], profile)
        self.assertEqual(response[0], 0.0)
        self.assertAlmostEqual(response[1], 1.0, places=6)
        self.assertEqual(response[2], 0.0)

    def test_labels_are_deterministic_binary_and_burned_in(self):
        hourly = synthetic_hourly()
        daily = to_daily(hourly)
        first = ep.simulate_outbreaks(hourly, daily, location='TEST', seed=7)
        second = ep.simulate_outbreaks(hourly, daily, location='TEST', seed=7)
        pd.testing.assert_frame_equal(first, second)
        self.assertEqual(len(first), len(daily) - ep.BURN_IN_DAYS)
        for code in ep.PROFILES:
            self.assertTrue(set(first[f'{code}_outbreak'].unique()) <= {0, 1})

    def test_wet_weather_drives_more_blast_infection_than_dry(self):
        profile = ep.PROFILES['BLAST']
        wet, dry = synthetic_hourly(wet=True), synthetic_hourly(wet=False)
        wet_eff = ep.infection_efficiency(ep.hourly_drivers(wet, profile), to_daily(wet), profile)
        dry_eff = ep.infection_efficiency(ep.hourly_drivers(dry, profile), to_daily(dry), profile)
        self.assertGreater(wet_eff.mean(), dry_eff.mean() * 3)


class TrainingTests(SimpleTestCase):
    def test_date_folds_embargo_and_no_date_split(self):
        dates = pd.DatetimeIndex(np.repeat(pd.date_range('2022-01-01', periods=400), 3))
        folds = date_folds(dates, n_splits=3, embargo_days=EMBARGO_DAYS)
        self.assertEqual(len(folds), 3)
        for train_idx, val_idx in folds:
            gap = (dates[val_idx].min() - dates[train_idx].max()).days
            self.assertGreater(gap, EMBARGO_DAYS - 1)
            self.assertFalse(set(dates[train_idx]) & set(dates[val_idx]))

    def test_ensemble_probability_ignores_column_order(self):
        rng = np.random.default_rng(3)
        X = pd.DataFrame(rng.normal(size=(300, 4)), columns=['a', 'b', 'c', 'd'])
        y = (X['a'] + X['b'] + rng.normal(0, 0.5, 300) > 0).astype(int)
        bundle = {
            'features': ['a', 'b', 'c', 'd'],
            'rf': make_random_forest(n_jobs=1, n_estimators=20).fit(X, y),
            'xgb': make_xgboost(n_jobs=1, n_estimators=20).fit(X, y),
            'weights': {'rf': 0.5, 'xgb': 0.5},
        }
        straight = ensemble_probability(bundle, X)
        shuffled = ensemble_probability(bundle, X[['d', 'c', 'b', 'a']].assign(extra=1.0))
        np.testing.assert_allclose(straight, shuffled)
        self.assertTrue(((straight >= 0) & (straight <= 1)).all())

    def test_risk_levels_scale_with_threshold(self):
        bands = (('SEVERE', 1.6), ('HIGH', 1.0), ('MODERATE', 0.55), ('LOW', 0.0))
        self.assertEqual(risk_level(0.05, 0.2, bands), 'LOW')
        self.assertEqual(risk_level(0.12, 0.2, bands), 'MODERATE')
        self.assertEqual(risk_level(0.20, 0.2, bands), 'HIGH')
        self.assertEqual(risk_level(0.40, 0.2, bands), 'SEVERE')


class InputValidationTests(SimpleTestCase):
    def test_rejects_non_numeric_non_finite_and_out_of_area(self):
        for lat, lng in (('abc', 125.7), ('nan', 125.7), (7.4, 'inf'), (40.7, -74.0), (None, None)):
            with self.assertRaises(InvalidLocation):
                validate_point(lat, lng)
        self.assertEqual(validate_point('7.40', '125.70'), (7.4, 125.7))

    def test_days_are_clamped(self):
        self.assertEqual(clamp_days('99'), 14)
        self.assertEqual(clamp_days(-3), 1)
        self.assertEqual(clamp_days('junk'), 7)


FAKE_POINT = {
    'latitude': 7.36, 'longitude': 125.7, 'elevation_m': 4.0,
    'days': [{'date': '2026-09-17', 'weather': {}, 'risks': {}, 'dominant': None}],
    'peak': {},
}


class DiseaseForecastApiTests(APITestCase):
    def setUp(self):
        from users.models import User

        cache.clear()
        self.farmer = User.objects.create_user(
            username='forecast_farmer', password='Password123!',
            role='FARMER', municipality='CARMEN', barangay='Ising')
        self.client.force_authenticate(self.farmer)

    def test_requires_authentication(self):
        self.client.force_authenticate(None)
        response = self.client.get('/api/analytics/disease-risk/?municipality=CARMEN')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch('analytics.ml.predict.forecast_point', return_value=FAKE_POINT)
    def test_municipality_forecast(self, forecast):
        response = self.client.get('/api/analytics/disease-risk/?municipality=carmen&days=30')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['source'], 'municipality:CARMEN')
        self.assertEqual(response.data['forecast_days'], 14)
        forecast.assert_called_once_with(7.36, 125.7, 14)

    def test_out_of_area_and_bad_input_are_400(self):
        for query in ('lat=40.7&lng=-74', 'lat=abc&lng=1', 'municipality=MANILA', ''):
            response = self.client.get(f'/api/analytics/disease-risk/?{query}')
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, query)

    @patch('analytics.ml.predict.forecast_point', side_effect=ModelNotTrained('missing'))
    def test_untrained_model_is_503(self, _):
        response = self.client.get('/api/analytics/disease-risk/?lat=7.4&lng=125.6')
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    @patch('analytics.ml.predict.forecast_point', return_value=FAKE_POINT)
    def test_results_are_cached(self, forecast):
        for _ in range(3):
            self.client.get('/api/analytics/disease-risk/?lat=7.401&lng=125.601')
        self.assertEqual(forecast.call_count, 1)

    @patch('analytics.ml.predict.forecast_spread')
    def test_hotspot_spread_uses_detected_disease(self, spread):
        from analytics.models import DiseaseHotspot
        from diagnostics.models import LeafScan

        spread.return_value = {'latitude': 7.4, 'longitude': 125.7, 'radii_km': [10, 20], 'days': []}
        scan = LeafScan.objects.create(reporter=self.farmer, image='leaf_scans/x.jpg',
                                       detected_disease='BLAST', confidence_score=0.9,
                                       latitude=7.4, longitude=125.7)
        hotspot = DiseaseHotspot.objects.create(
            scan=scan, latitude=7.4, longitude=125.7, temperature=27, humidity=90,
            wind_speed=10, wind_direction_deg=180, wind_cardinal='S')
        response = self.client.get(f'/api/analytics/hotspots/{hotspot.pk}/spread-forecast/?days=3')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['detected_disease'], 'BLAST')
        spread.assert_called_once_with(7.4, 125.7, disease='BLAST', days=3)
