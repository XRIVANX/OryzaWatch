from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status
from users.models import User
from farms.models import Farm, FarmWeather
from .models import Alert
from .weather_monitor import CHECK_INTERVAL, evaluate_farm_weather, run_farm_weather_check


def _weather(**overrides):
    base = {
        'temperature': 30.0, 'humidity': 70.0, 'wind_speed': 8.0,
        'wind_direction_deg': 90, 'wind_cardinal': 'E', 'precipitation': 0.0,
        'weather_code': 1, 'condition': 'Clear',
    }
    base.update(overrides)
    return base


class AlertMarkReadTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='farmer1', password='Password123!', role='FARMER')
        self.other_user = User.objects.create_user(
            username='farmer2', password='Password123!', role='FARMER')
        self.alert = Alert.objects.create(
            recipient=self.user, title='Critical Outbreak',
            message='Test message', severity='CRITICAL')

    def test_recipient_can_mark_own_alert_read(self):
        self.client.force_authenticate(self.user)
        resp = self.client.patch(f'/api/alerts/{self.alert.pk}/mark-read/', {'is_read': True}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.alert.refresh_from_db()
        self.assertTrue(self.alert.is_read)

    def test_cannot_mark_read_via_post(self):
        # AlertMarkReadView is an UpdateAPIView - only PUT/PATCH are allowed.
        self.client.force_authenticate(self.user)
        resp = self.client.post(f'/api/alerts/{self.alert.pk}/mark-read/')
        self.assertEqual(resp.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_recipient_cannot_rewrite_alert_content(self):
        self.client.force_authenticate(self.user)
        resp = self.client.patch(
            f'/api/alerts/{self.alert.pk}/mark-read/',
            {'is_read': True, 'title': 'Hacked', 'severity': 'INFO'},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.alert.refresh_from_db()
        self.assertEqual(self.alert.title, 'Critical Outbreak')
        self.assertEqual(self.alert.severity, 'CRITICAL')

    def test_cannot_mark_another_users_alert_read(self):
        self.client.force_authenticate(self.other_user)
        resp = self.client.patch(f'/api/alerts/{self.alert.pk}/mark-read/', {'is_read': True}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


class EvaluateFarmWeatherTestCase(APITestCase):
    """Pure threshold/crossing logic - no DB, no network."""

    def test_first_reading_already_high_humidity_fires(self):
        events = evaluate_farm_weather(None, _weather(humidity=90.0))
        self.assertEqual([e['title'] for e in events], ['High Humidity'])
        self.assertEqual(events[0]['severity'], 'WARNING')

    def test_humidity_only_fires_on_the_upward_crossing(self):
        class Prev:
            humidity, temperature, precipitation = 88.0, 30.0, 0.0
            wind_cardinal, condition = 'E', 'Clear'
        # Already above the line last time -> no re-alert.
        self.assertEqual(evaluate_farm_weather(Prev(), _weather(humidity=90.0)), [])

    def test_low_temperature_fires(self):
        titles = [e['title'] for e in evaluate_farm_weather(None, _weather(temperature=16.0))]
        self.assertIn('Low Temperature', titles)

    def test_wind_direction_change_needs_a_previous_reading(self):
        self.assertEqual(evaluate_farm_weather(None, _weather(wind_cardinal='W')), [])

        class Prev:
            humidity, temperature, precipitation = 70.0, 30.0, 0.0
            wind_cardinal, condition = 'E', 'Clear'
        titles = [e['title'] for e in evaluate_farm_weather(Prev(), _weather(wind_cardinal='W'))]
        self.assertIn('Wind Direction Change', titles)

    def test_storm_wind_supersedes_rain_onset(self):
        titles = [e['title'] for e in evaluate_farm_weather(None, _weather(wind_speed=45.0, precipitation=1.0))]
        self.assertIn('Storm Warning', titles)
        self.assertNotIn('Rain Detected', titles)

    def test_condition_change_fires(self):
        class Prev:
            humidity, temperature, precipitation = 70.0, 30.0, 0.0
            wind_cardinal, condition = 'E', 'Clear'
        titles = [e['title'] for e in evaluate_farm_weather(
            Prev(), _weather(condition='Rain', weather_code=63))]
        self.assertIn('Weather Condition Change', titles)


class FarmWeatherMonitorTestCase(APITestCase):
    def setUp(self):
        self.farmer = User.objects.create_user(
            username='wfarmer', password='Password123!', role='FARMER',
            municipality='ASUNCION', barangay='Ising')
        self.manager = User.objects.create_user(
            username='wkagawad', password='Password123!', role='KAGAWAD',
            municipality='ASUNCION', barangay='Ising')
        self.far_manager = User.objects.create_user(
            username='wadmin', password='Password123!', role='MAO_ADMIN',
            municipality='CARMEN', barangay='Poblacion')
        self.farm = Farm.objects.create(
            farmer=self.farmer, latitude='7.450000', longitude='125.570000', size_hectares=1.0)

    @patch('alerts.weather_monitor.fetch_weather')
    def test_high_humidity_alerts_farmer_and_area_manager(self, mock_weather):
        mock_weather.return_value = _weather(humidity=92.0)
        created = run_farm_weather_check(self.farm, force=True)
        self.assertEqual(created, 2)

        names = set(Alert.objects.filter(title='High Humidity').values_list('recipient__username', flat=True))
        self.assertEqual(names, {'wfarmer', 'wkagawad'})
        self.assertNotIn('wadmin', names)  # different municipality
        self.assertEqual(Alert.objects.get(recipient=self.farmer, title='High Humidity').severity, 'WARNING')

    @patch('alerts.weather_monitor.fetch_weather')
    def test_snapshot_is_saved_and_persistent_condition_does_not_respam(self, mock_weather):
        mock_weather.return_value = _weather(humidity=92.0)
        run_farm_weather_check(self.farm, force=True)
        self.assertTrue(FarmWeather.objects.filter(farm=self.farm).exists())

        # Still humid on the next check -> no second wave of alerts.
        created = run_farm_weather_check(self.farm, force=True)
        self.assertEqual(created, 0)
        self.assertEqual(Alert.objects.filter(title='High Humidity').count(), 2)

    @patch('alerts.weather_monitor.fetch_weather')
    def test_wind_shift_between_two_checks_alerts(self, mock_weather):
        mock_weather.return_value = _weather(wind_cardinal='E', wind_direction_deg=90)
        run_farm_weather_check(self.farm, force=True)
        mock_weather.return_value = _weather(wind_cardinal='SW', wind_direction_deg=225)
        run_farm_weather_check(self.farm, force=True)

        self.assertTrue(Alert.objects.filter(recipient=self.farmer, title='Wind Direction Change').exists())

    @patch('alerts.weather_monitor.fetch_weather')
    def test_per_farm_throttle_skips_the_weather_call(self, mock_weather):
        mock_weather.return_value = _weather(humidity=92.0)
        run_farm_weather_check(self.farm, force=True)
        mock_weather.reset_mock()

        # A fresh snapshot exists -> a non-forced check inside the window is a no-op.
        created = run_farm_weather_check(self.farm, force=False)
        self.assertEqual(created, 0)
        mock_weather.assert_not_called()

        # ...and once the snapshot is stale, it checks again.
        FarmWeather.objects.filter(farm=self.farm).update(
            checked_at=timezone.now() - CHECK_INTERVAL - timedelta(minutes=1))
        run_farm_weather_check(self.farm, force=False)
        mock_weather.assert_called_once()

    @patch('alerts.weather_monitor.fetch_weather')
    def test_alerts_list_endpoint_triggers_a_farm_weather_check(self, mock_weather):
        mock_weather.return_value = _weather(temperature=37.0)
        self.client.force_authenticate(self.farmer)
        resp = self.client.get('/api/alerts/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        titles = [a['title'] for a in resp.data]
        self.assertIn('High Temperature', titles)

    @patch('alerts.weather_monitor.fetch_weather', side_effect=RuntimeError('weather API down'))
    def test_weather_api_failure_never_breaks_the_check(self, _mock_weather):
        self.assertEqual(run_farm_weather_check(self.farm, force=True), 0)


class AutomaticMunicipalityWeatherTestCase(APITestCase):
    """The automatic area advisory: any /api/alerts/ poll sweeps Carmen +
    Asuncion and alerts every user registered there - all roles, farm or no
    farm - so a farmer sees a waiting advisory just by opening the app."""

    def setUp(self):
        cache.clear()  # the area sweep is throttled via a cache lock
        self.asuncion_farmer = User.objects.create_user(
            username='amfarmer', password='Password123!', role='FARMER',
            municipality='ASUNCION', barangay='Ising')
        self.asuncion_admin = User.objects.create_user(
            username='amadmin', password='Password123!', role='MAO_ADMIN',
            municipality='ASUNCION', barangay='Poblacion')
        self.carmen_farmer = User.objects.create_user(
            username='cmfarmer', password='Password123!', role='FARMER',
            municipality='CARMEN', barangay='Tuganay')

    @patch('alerts.weather_monitor.fetch_weather')
    def test_poll_runs_area_sweep_and_alerts_everyone_in_the_municipality(self, mock_weather):
        mock_weather.return_value = _weather(humidity=93.0)
        # A farmer with NO registered farm - still gets the area advisory.
        self.client.force_authenticate(self.asuncion_farmer)
        resp = self.client.get('/api/alerts/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        # Everyone in Asuncion, both roles, no farm required.
        self.assertTrue(Alert.objects.filter(recipient=self.asuncion_farmer, title='High Humidity').exists())
        self.assertTrue(Alert.objects.filter(recipient=self.asuncion_admin, title='High Humidity').exists())
        # Carmen is swept in the same pass (same mocked weather) - its farmer is alerted too.
        self.assertTrue(Alert.objects.filter(recipient=self.carmen_farmer, title='High Humidity').exists())
        # The message names the municipality, not "your farm".
        msg = Alert.objects.filter(recipient=self.asuncion_farmer, title='High Humidity').first().message
        self.assertIn('Asuncion', msg)

    @patch('alerts.weather_monitor.fetch_weather')
    def test_area_sweep_is_cache_throttled(self, mock_weather):
        mock_weather.return_value = _weather(humidity=93.0)
        self.client.force_authenticate(self.asuncion_admin)
        self.client.get('/api/alerts/')
        mock_weather.reset_mock()
        # Second poll within the lock window: no more weather calls.
        self.client.get('/api/alerts/')
        mock_weather.assert_not_called()

    @patch('alerts.weather_monitor.fetch_weather')
    def test_persistent_condition_does_not_re_alert(self, mock_weather):
        from alerts.weather_monitor import run_all_municipality_weather_checks
        mock_weather.return_value = _weather(humidity=93.0)
        run_all_municipality_weather_checks(force=True)
        first = Alert.objects.filter(title='High Humidity').count()
        self.assertGreater(first, 0)
        # Still humid next sweep -> no duplicates.
        run_all_municipality_weather_checks(force=True)
        self.assertEqual(Alert.objects.filter(title='High Humidity').count(), first)
