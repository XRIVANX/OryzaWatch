"""
Live inference for the airborne rice disease forecast.

Two questions, both answered from the saved Random Forest + XGBoost ensembles
and a live Open-Meteo forecast:

  * forecast_point  - what is each disease's outbreak risk at this place,
                      day by day, for the coming week?
  * forecast_spread - from an outbreak here, which way is it heading? Risk is
                      scored on a ring of points around the source and
                      weighted by each day's wind, so the answer combines
                      direction ("downwind") with suitability ("the weather
                      there favours infection").

Pure Python with no Django imports. The API views and the CLI call into this.
"""
from __future__ import annotations

import math
import threading
from datetime import timedelta

import joblib
import numpy as np
import pandas as pd

from analytics.prediction import angle_diff, bearing_deg, destination_point

from .config import (
    DEFAULT_FORECAST_DAYS,
    DISEASE_LABELS,
    DISEASES,
    MAX_FORECAST_DAYS,
    MODEL_DIR,
    PAST_DAYS,
    RISK_BANDS,
    SERVICE_AREA,
)
from .features import build_features
from .modeling import ensemble_probability, risk_level
from .sources import fetch_hourly_forecast_many, to_daily

_COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

# Ring used by forecast_spread. Open-Meteo's forecast grid here is roughly
# 9-13 km, so tighter rings would just resample the source's own grid cell.
SPREAD_RADII_KM = (10.0, 20.0)
SPREAD_BEARINGS = tuple(range(0, 360, 45))
# A ring point counts as downwind within this angle of the spread heading.
DOWNWIND_HALF_ANGLE = 45.0
# Below this wind steadiness (length of the day's mean unit wind vector, 0-1)
# the wind swung around too much to call a direction.
MIN_WIND_STEADINESS = 0.25


class ModelNotTrained(RuntimeError):
    """The forecast models have not been trained yet."""


class InvalidLocation(ValueError):
    """Coordinates outside the valid range."""


_lock = threading.Lock()
_loaded = {'key': None, 'bundles': None}


def load_bundles():
    """
    Load (and cache) every disease bundle. Reloads automatically when a model
    file changes on disk, so retraining needs no server restart. Files come
    only from the fixed ai_models/ directory, never from request data.
    """
    paths = {disease: MODEL_DIR / f'{disease}.joblib' for disease in DISEASES}
    missing = [path.name for path in paths.values() if not path.exists()]
    if missing:
        raise ModelNotTrained(
            f'Disease forecast models not trained (missing {", ".join(missing)}). '
            'Run: manage.py train_disease_forecast'
        )
    key = tuple(path.stat().st_mtime_ns for path in paths.values())
    with _lock:
        if _loaded['key'] != key:
            _loaded['bundles'] = {disease: joblib.load(path) for disease, path in paths.items()}
            _loaded['key'] = key
        return _loaded['bundles']


def models_available():
    try:
        load_bundles()
        return True
    except ModelNotTrained:
        return False


def validate_point(latitude, longitude):
    try:
        lat, lng = float(latitude), float(longitude)
    except (TypeError, ValueError):
        raise InvalidLocation('latitude and longitude must be numbers.')
    if not (math.isfinite(lat) and math.isfinite(lng)) or not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise InvalidLocation('latitude must be within -90..90 and longitude within -180..180.')
    area = SERVICE_AREA
    if not (area['lat_min'] <= lat <= area['lat_max'] and area['lng_min'] <= lng <= area['lng_max']):
        raise InvalidLocation(
            'Disease forecasts are only available within the service area '
            f"(lat {area['lat_min']}..{area['lat_max']}, lng {area['lng_min']}..{area['lng_max']})."
        )
    return lat, lng


def clamp_days(days):
    try:
        days = int(days)
    except (TypeError, ValueError):
        days = DEFAULT_FORECAST_DAYS
    return max(1, min(days, MAX_FORECAST_DAYS))


def _cardinal(degrees):
    return _COMPASS[round((degrees % 360) / 45) % 8]


def _wind(row):
    """Open-Meteo reports where the wind comes FROM. Spores travel the other way."""
    u, v = float(row['wind_u']), float(row['wind_v'])
    steadiness = min(1.0, math.hypot(u, v))
    wind_from = (math.degrees(math.atan2(u, v)) + 360.0) % 360.0
    toward = (wind_from + 180.0) % 360.0
    return {
        'wind_from_deg': round(wind_from),
        'wind_from': _cardinal(wind_from),
        'spread_toward_deg': round(toward),
        'spread_toward': _cardinal(toward),
        'wind_steadiness': round(steadiness, 2),
        'wind_max_kmh': round(float(row['wind_max']), 1),
    }


def _daily_probabilities(hourly, bundles, days):
    """
    Daily outbreak probabilities for the first `days` forecast days of one
    point. With past_days=PAST_DAYS, the hourly series starts PAST_DAYS before
    today in local time, which pins "today" without a timezone lookup.
    """
    daily = to_daily(hourly)
    today = hourly['time'].min().normalize() + timedelta(days=PAST_DAYS)
    features = build_features(daily)
    window = features[(features['date'] >= today) & (features['date'] < today + timedelta(days=days))]
    window = window.reset_index(drop=True)
    daily_by_date = daily.set_index('date')

    probabilities = {disease: ensemble_probability(bundle, window) for disease, bundle in bundles.items()}
    return window['date'], probabilities, daily_by_date


def _risk_entry(disease, probability, bundle):
    return {
        'name': DISEASE_LABELS[disease],
        'probability': round(float(probability), 3),
        'level': risk_level(float(probability), bundle['threshold'], RISK_BANDS),
    }


def _point_forecast(hourly, bundles, days):
    dates, probabilities, daily = _daily_probabilities(hourly, bundles, days)
    timeline = []
    for index, day in enumerate(dates):
        row = daily.loc[day]
        risks = {d: _risk_entry(d, probabilities[d][index], bundles[d]) for d in bundles}
        # Dominant = furthest above its own threshold, and only if not LOW.
        ratios = {d: probabilities[d][index] / bundles[d]['threshold'] for d in bundles}
        top = max(ratios, key=ratios.get)
        timeline.append({
            'date': f'{day:%Y-%m-%d}',
            'weather': {
                't_min': round(float(row['t_min']), 1),
                't_max': round(float(row['t_max']), 1),
                'rh_mean': round(float(row['rh_mean'])),
                'precip_mm': round(float(row['precip_sum']), 1),
                **_wind(row),
            },
            'risks': risks,
            'dominant': top if risks[top]['level'] != 'LOW' else None,
        })

    peak = {}
    for disease in bundles:
        if not timeline:
            break
        best = max(timeline, key=lambda entry: entry['risks'][disease]['probability'])
        peak[disease] = {'date': best['date'], **best['risks'][disease]}
    return {'days': timeline, 'peak': peak}


def forecast_points(points, days=DEFAULT_FORECAST_DAYS):
    """Day-by-day disease risk for several (lat, lng) points in one API call."""
    bundles = load_bundles()
    days = clamp_days(days)
    points = [validate_point(lat, lng) for lat, lng in points]
    frames = fetch_hourly_forecast_many(points, past_days=PAST_DAYS, forecast_days=days + 1)
    results = []
    for (lat, lng), hourly in zip(points, frames):
        result = _point_forecast(hourly, bundles, days)
        result.update({'latitude': lat, 'longitude': lng, 'elevation_m': float(hourly['elevation'].iloc[0])})
        results.append(result)
    return results


def forecast_point(latitude, longitude, days=DEFAULT_FORECAST_DAYS):
    return forecast_points([(latitude, longitude)], days)[0]


def forecast_spread(latitude, longitude, disease=None, days=DEFAULT_FORECAST_DAYS, radii_km=SPREAD_RADII_KM):
    """
    Where an outbreak at (latitude, longitude) is likely to go next.

    For each forecast day, every ring point gets a spread score:

        source probability x destination probability x downwind alignment

    Alignment is the cosine of the angle between the point's bearing and that
    day's spread heading, zero outside DOWNWIND_HALF_ANGLE, and zero on days
    when the wind was too variable to trust. The top-scoring direction is the
    day's `likely_direction`.
    """
    lat, lng = validate_point(latitude, longitude)
    bundles = load_bundles()
    diseases = [disease] if disease else list(bundles)
    unknown = [d for d in diseases if d not in bundles]
    if unknown:
        raise ValueError(f'Unknown disease: {", ".join(unknown)}. Choose from {", ".join(bundles)}.')

    ring = []
    for radius in radii_km:
        for bearing in SPREAD_BEARINGS:
            p_lat, p_lng = destination_point(lat, lng, bearing, radius)
            ring.append({'bearing_deg': bearing, 'direction': _cardinal(bearing), 'distance_km': radius,
                         'latitude': round(p_lat, 5), 'longitude': round(p_lng, 5)})

    forecasts = forecast_points([(lat, lng)] + [(p['latitude'], p['longitude']) for p in ring], days)
    source, destinations = forecasts[0], forecasts[1:]

    timeline = []
    for index, day in enumerate(source['days']):
        weather = day['weather']
        steady = weather['wind_steadiness'] >= MIN_WIND_STEADINESS
        per_disease = {}
        for code in diseases:
            source_p = day['risks'][code]['probability']
            points = []
            for spec, dest in zip(ring, destinations):
                dest_risk = dest['days'][index]['risks'][code]
                off_axis = angle_diff(spec['bearing_deg'], weather['spread_toward_deg'])
                alignment = math.cos(math.radians(off_axis)) if steady and off_axis <= DOWNWIND_HALF_ANGLE else 0.0
                points.append({
                    **spec,
                    'probability': dest_risk['probability'],
                    'level': dest_risk['level'],
                    'downwind': alignment > 0,
                    'spread_score': round(source_p * dest_risk['probability'] * alignment, 4),
                })
            points.sort(key=lambda p: p['spread_score'], reverse=True)
            best = points[0] if points and points[0]['spread_score'] > 0 else None
            per_disease[code] = {
                'source': day['risks'][code],
                'likely_direction': best['direction'] if best else None,
                'likely_destination': best,
                'points': points,
            }
        timeline.append({'date': day['date'], 'weather': weather, 'diseases': per_disease})

    return {
        'latitude': lat,
        'longitude': lng,
        'radii_km': list(radii_km),
        'days': timeline,
    }
