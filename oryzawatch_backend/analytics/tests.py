from datetime import timedelta
from unittest.mock import patch

from rest_framework.test import APITestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from users.models import User
from diagnostics.models import LeafScan
from analytics.models import DiseaseHotspot
from alerts.models import Alert

FAKE_WEATHER = {
    'temperature': 31.0, 'humidity': 82.0, 'wind_speed': 12.0,
    'wind_direction_deg': 45, 'wind_cardinal': 'NE', 'precipitation': 2.0,
}

# The predict endpoint always refreshes weather before building the cone, so
# tests placing farms due north/south need the mocked wind to actually blow
# due north (0 degrees), not FAKE_WEATHER's default NE.
FAKE_WEATHER_NORTH_WIND = {**FAKE_WEATHER, 'wind_direction_deg': 0, 'wind_cardinal': 'N'}


class HotspotAccessControlTestCase(APITestCase):
    """Regression tests for the broken-access-control fix on hotspot mutation."""

    def setUp(self):
        self.farmer = User.objects.create_user(
            username='farmer1', password='Password123!',
            role='FARMER', municipality='CARMEN', barangay='Ising')
        self.kagawad = User.objects.create_user(
            username='kagawad1', password='Password123!',
            role='KAGAWAD', municipality='CARMEN', barangay='Ising')

        scan = LeafScan.objects.create(
            reporter=self.farmer, image='leaf_scans/x.jpg',
            detected_disease='BLB', confidence_score=0.9,
            latitude='7.000000', longitude='125.000000')
        self.hotspot = DiseaseHotspot.objects.create(
            scan=scan, status='CRITICAL', temperature=30.0, humidity=80.0,
            wind_speed=5.0, wind_direction_deg=45, wind_cardinal='NE')
        self.url = reverse('hotspot_detail', args=[self.hotspot.pk])

    def test_farmer_can_read_hotspot(self):
        self.client.force_authenticate(self.farmer)
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_farmer_cannot_update_hotspot(self):
        self.client.force_authenticate(self.farmer)
        resp = self.client.patch(self.url, {'status': 'RESOLVED'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_farmer_cannot_delete_hotspot(self):
        self.client.force_authenticate(self.farmer)
        resp = self.client.delete(self.url)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(DiseaseHotspot.objects.filter(pk=self.hotspot.pk).exists())

    def test_kagawad_can_update_hotspot(self):
        self.client.force_authenticate(self.kagawad)
        resp = self.client.patch(self.url, {'status': 'RESOLVED'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.hotspot.refresh_from_db()
        self.assertEqual(self.hotspot.status, 'RESOLVED')

    def test_anonymous_cannot_read_hotspot(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch('analytics.views.fetch_weather', return_value=FAKE_WEATHER)
    def test_resolving_a_hotspot_deactivates_it(self, _mock_weather):
        self.client.force_authenticate(self.kagawad)
        resp = self.client.patch(self.url, {'status': 'RESOLVED'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.hotspot.refresh_from_db()
        self.assertFalse(self.hotspot.is_active)

    def test_reopening_a_resolved_hotspot_reactivates_it(self):
        self.hotspot.status = 'RESOLVED'
        self.hotspot.is_active = False
        self.hotspot.save()
        self.client.force_authenticate(self.kagawad)
        resp = self.client.patch(self.url, {'status': 'CRITICAL'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.hotspot.refresh_from_db()
        self.assertTrue(self.hotspot.is_active)


class HotspotReportTestCase(APITestCase):
    """A farmer reporting one of their own positive scans as an outbreak."""

    def setUp(self):
        self.farmer = User.objects.create_user(
            username='farmer2', password='Password123!',
            role='FARMER', municipality='ASUNCION', barangay='Ising')
        self.other_farmer = User.objects.create_user(
            username='farmer3', password='Password123!',
            role='FARMER', municipality='ASUNCION', barangay='Mangalcal')
        self.kagawad = User.objects.create_user(
            username='kagawad2', password='Password123!',
            role='KAGAWAD', municipality='ASUNCION', barangay='Ising')
        self.diseased_scan = LeafScan.objects.create(
            reporter=self.farmer, image='leaf_scans/x.jpg', detected_disease='BLB',
            confidence_score=0.9, latitude='7.000000', longitude='125.000000')
        self.healthy_scan = LeafScan.objects.create(
            reporter=self.farmer, image='leaf_scans/y.jpg', detected_disease='HEALTHY',
            confidence_score=0.95, latitude='7.000000', longitude='125.000000')
        self.url = reverse('active_hotspots')

    @patch('analytics.views.fetch_weather', return_value=FAKE_WEATHER)
    def test_farmer_can_report_own_diseased_scan(self, _mock_weather):
        self.client.force_authenticate(self.farmer)
        resp = self.client.post(self.url, {'scan': self.diseased_scan.id}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data['status'], 'CRITICAL')
        self.assertEqual(resp.data['scan']['id'], self.diseased_scan.id)

        hotspot = DiseaseHotspot.objects.get(scan=self.diseased_scan)
        self.assertTrue(hotspot.is_active)

        # Critical Outbreak alert reached the Kagawad in the same barangay.
        alert = Alert.objects.get(recipient=self.kagawad, hotspot=hotspot)
        self.assertEqual(alert.severity, 'CRITICAL')
        self.assertIn('Brgy. Ising', alert.message)
        self.assertIn('Bacterial Leaf Blight', alert.message)

    @patch('analytics.views.fetch_weather', return_value=FAKE_WEATHER)
    def test_hotspot_uses_farm_pin_not_scan_gps(self, _mock_weather):
        """The scan's GPS reading (wherever the photo was taken) can drift
        from the farmer's actual registered field - the hotspot must pin to
        the farm's own drawn location instead."""
        from farms.models import Farm
        Farm.objects.create(
            farmer=self.farmer, latitude='7.999999', longitude='126.999999', size_hectares=1)

        self.client.force_authenticate(self.farmer)
        resp = self.client.post(self.url, {'scan': self.diseased_scan.id}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(str(resp.data['latitude']), '7.999999')
        self.assertEqual(str(resp.data['longitude']), '126.999999')
        # The scan's own (different) GPS reading is untouched.
        self.assertEqual(resp.data['scan']['latitude'], '7.000000')

    @patch('analytics.views.fetch_weather', return_value=FAKE_WEATHER)
    def test_hotspot_falls_back_to_scan_gps_without_a_farm(self, _mock_weather):
        self.client.force_authenticate(self.farmer)
        resp = self.client.post(self.url, {'scan': self.diseased_scan.id}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(str(resp.data['latitude']), '7.000000')
        self.assertEqual(str(resp.data['longitude']), '125.000000')

    def test_farmer_cannot_report_a_healthy_scan(self):
        self.client.force_authenticate(self.farmer)
        resp = self.client.post(self.url, {'scan': self.healthy_scan.id}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_farmer_cannot_report_someone_elses_scan(self):
        self.client.force_authenticate(self.other_farmer)
        resp = self.client.post(self.url, {'scan': self.diseased_scan.id}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('analytics.views.fetch_weather', return_value=FAKE_WEATHER)
    def test_cannot_report_the_same_scan_twice(self, _mock_weather):
        self.client.force_authenticate(self.farmer)
        self.client.post(self.url, {'scan': self.diseased_scan.id}, format='json')
        resp = self.client.post(self.url, {'scan': self.diseased_scan.id}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class HotspotBroadcastTestCase(APITestCase):
    def setUp(self):
        self.farmer = User.objects.create_user(
            username='farmer4', password='Password123!',
            role='FARMER', municipality='ASUNCION', barangay='Ising')
        self.same_barangay_farmer = User.objects.create_user(
            username='farmer5', password='Password123!',
            role='FARMER', municipality='ASUNCION', barangay='Ising')
        self.other_barangay_farmer = User.objects.create_user(
            username='farmer6', password='Password123!',
            role='FARMER', municipality='ASUNCION', barangay='Mangalcal')
        self.kagawad = User.objects.create_user(
            username='kagawad3', password='Password123!',
            role='KAGAWAD', municipality='ASUNCION', barangay='Ising')

        scan = LeafScan.objects.create(
            reporter=self.farmer, image='leaf_scans/x.jpg', detected_disease='BLAST',
            confidence_score=0.9, latitude='7.000000', longitude='125.000000')
        self.hotspot = DiseaseHotspot.objects.create(
            scan=scan, status='CRITICAL', temperature=30.0, humidity=80.0,
            wind_speed=5.0, wind_direction_deg=45, wind_cardinal='NE')
        self.url = reverse('hotspot_broadcast', args=[self.hotspot.pk])

    def test_farmer_cannot_broadcast(self):
        self.client.force_authenticate(self.farmer)
        resp = self.client.post(self.url, {'scope': 'ALL'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_barangay_scope_only_notifies_matching_farmers(self):
        self.client.force_authenticate(self.kagawad)
        resp = self.client.post(self.url, {'scope': 'BARANGAY'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        notified = set(Alert.objects.filter(hotspot=self.hotspot).values_list('recipient__username', flat=True))
        self.assertEqual(notified, {'farmer4', 'farmer5'})

    def test_all_scope_notifies_every_farmer(self):
        self.client.force_authenticate(self.kagawad)
        resp = self.client.post(self.url, {'scope': 'ALL'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        notified = set(Alert.objects.filter(hotspot=self.hotspot).values_list('recipient__username', flat=True))
        self.assertEqual(notified, {'farmer4', 'farmer5', 'farmer6'})


class HotspotPredictTestCase(APITestCase):
    """Heat Map Mode: farms downwind of the hotspot get a warning, nearby
    farms outside the projected cone get an all-clear, and farms far away
    get nothing."""

    def setUp(self):
        from farms.models import Farm

        self.kagawad = User.objects.create_user(
            username='kagawad4', password='Password123!', role='KAGAWAD', municipality='ASUNCION')
        self.reporter = User.objects.create_user(
            username='farmer7', password='Password123!', role='FARMER', municipality='ASUNCION', barangay='Ising')
        self.farmer_north = User.objects.create_user(
            username='farmer8', password='Password123!', role='FARMER', municipality='ASUNCION', barangay='North')
        self.farmer_south = User.objects.create_user(
            username='farmer9', password='Password123!', role='FARMER', municipality='ASUNCION', barangay='South')
        self.farmer_far = User.objects.create_user(
            username='farmer10', password='Password123!', role='FARMER', municipality='ASUNCION', barangay='Far')

        scan = LeafScan.objects.create(
            reporter=self.reporter, image='leaf_scans/x.jpg', detected_disease='BLB',
            confidence_score=0.9, latitude='7.000000', longitude='125.000000')
        # Wind blowing due North (0 degrees).
        self.hotspot = DiseaseHotspot.objects.create(
            scan=scan, status='CRITICAL', temperature=30.0, humidity=80.0,
            wind_speed=5.0, wind_direction_deg=0, wind_cardinal='N')

        deg_per_km = 1 / 111.0
        Farm.objects.create(farmer=self.farmer_north, latitude=7.0 + 1 * deg_per_km, longitude=125.0, size_hectares=1)
        Farm.objects.create(farmer=self.farmer_south, latitude=7.0 - 1 * deg_per_km, longitude=125.0, size_hectares=1)
        Farm.objects.create(farmer=self.farmer_far, latitude=7.0 + 50 * deg_per_km, longitude=125.0, size_hectares=1)

        self.url = reverse('hotspot_predict', args=[self.hotspot.pk])

    def test_anonymous_cannot_trigger_prediction(self):
        resp = self.client.post(self.url, {}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch('analytics.views.fetch_weather', return_value=FAKE_WEATHER)
    def test_farmer_can_trigger_prediction(self, _mock_weather):
        # Any authenticated user can run Heat Map Mode - it's their own
        # safety at stake, and per-recipient deduping prevents alert-spam.
        self.client.force_authenticate(self.farmer_north)
        resp = self.client.post(self.url, {}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    @patch('analytics.views.fetch_weather', return_value=FAKE_WEATHER_NORTH_WIND)
    def test_predict_classifies_and_notifies_farms(self, _mock_weather):
        self.client.force_authenticate(self.kagawad)
        resp = self.client.post(self.url, {}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['farms_in_cone'], 1)
        self.assertEqual(resp.data['farms_outside_cone'], 1)
        self.assertTrue(len(resp.data['cone']) >= 3)

        warning = Alert.objects.get(recipient=self.farmer_north, hotspot=self.hotspot)
        self.assertEqual(warning.severity, 'CRITICAL')
        self.assertEqual(warning.title, 'Incoming Outbreak Warning')

        all_clear = Alert.objects.get(recipient=self.farmer_south, hotspot=self.hotspot)
        self.assertEqual(all_clear.severity, 'INFO')

        self.assertFalse(Alert.objects.filter(recipient=self.farmer_far, hotspot=self.hotspot).exists())

    @patch('analytics.views.fetch_weather', return_value=FAKE_WEATHER_NORTH_WIND)
    def test_predict_logs_forecast_prediction(self, _mock_weather):
        from analytics.models import ForecastPrediction
        self.client.force_authenticate(self.kagawad)
        self.client.post(self.url, {}, format='json')
        self.assertEqual(ForecastPrediction.objects.filter(predicted_disease='BLB').count(), 1)


class NotifyReportFallbackTestCase(APITestCase):
    """A report must never vanish silently just because no Kagawad/Admin's
    barangay or municipality happens to match the farmer's exactly - it
    should fall back all the way to every Kagawad/Admin in the system."""

    def setUp(self):
        self.farmer = User.objects.create_user(
            username='farmer11', password='Password123!',
            role='FARMER', municipality='ASUNCION', barangay='Ising')
        # The only admin in the system is in a completely different
        # municipality/barangay - no exact match at any level.
        self.admin = User.objects.create_user(
            username='admin2', password='Password123!',
            role='MAO_ADMIN', municipality='CARMEN', barangay='Poblacion')
        self.scan = LeafScan.objects.create(
            reporter=self.farmer, image='leaf_scans/x.jpg', detected_disease='BLB',
            confidence_score=0.9, latitude='7.000000', longitude='125.000000')
        self.url = reverse('active_hotspots')

    @patch('analytics.views.fetch_weather', return_value=FAKE_WEATHER)
    def test_report_still_reaches_admin_with_no_matching_barangay_or_municipality(self, _mock_weather):
        self.client.force_authenticate(self.farmer)
        resp = self.client.post(self.url, {'scan': self.scan.id}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

        hotspot = DiseaseHotspot.objects.get(scan=self.scan)
        alert = Alert.objects.get(recipient=self.admin, hotspot=hotspot)
        self.assertEqual(alert.severity, 'CRITICAL')
        self.assertIn('Bacterial Leaf Blight', alert.message)

    @patch('analytics.views.fetch_weather', return_value=FAKE_WEATHER)
    def test_report_matches_case_insensitively(self, _mock_weather):
        # Barangay is free text - a Kagawad registered as "ising" (lowercase)
        # must still match a farmer's "Ising".
        kagawad = User.objects.create_user(
            username='kagawad5', password='Password123!',
            role='KAGAWAD', municipality='asuncion', barangay='ising')
        self.client.force_authenticate(self.farmer)
        resp = self.client.post(self.url, {'scan': self.scan.id}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

        hotspot = DiseaseHotspot.objects.get(scan=self.scan)
        self.assertTrue(Alert.objects.filter(recipient=kagawad, hotspot=hotspot).exists())


class HotspotWeatherRefreshAlertTestCase(APITestCase):
    """Regression: the on-demand hotspot weather refresh must actually fire
    the Weather Risk / Dispersal Update alerts. It previously referenced an
    undefined `old_humidity`, and the bare `except` swallowed the NameError -
    so neither alert ever went out."""

    def setUp(self):
        self.farmer = User.objects.create_user(
            username='wr_farmer', password='Password123!',
            role='FARMER', municipality='ASUNCION', barangay='Ising')
        self.kagawad = User.objects.create_user(
            username='wr_kagawad', password='Password123!',
            role='KAGAWAD', municipality='ASUNCION', barangay='Ising')
        scan = LeafScan.objects.create(
            reporter=self.farmer, image='leaf_scans/x.jpg', detected_disease='BLB',
            confidence_score=0.9, latitude='7.000000', longitude='125.000000')
        self.hotspot = DiseaseHotspot.objects.create(
            scan=scan, status='CRITICAL', temperature=30.0, humidity=60.0,
            wind_speed=5.0, wind_direction_deg=45, wind_cardinal='NE')
        # updated_at is auto_now - backdate it past WEATHER_STALE_AFTER so the
        # list view actually performs the refresh.
        DiseaseHotspot.objects.filter(pk=self.hotspot.pk).update(
            updated_at=timezone.now() - timedelta(hours=1))

    @patch('analytics.views.fetch_weather')
    def test_humidity_crossing_threshold_sends_weather_risk_alert(self, mock_weather):
        # BLB humidity_threshold is 70.0; stored reading was 60.0.
        mock_weather.return_value = {
            **FAKE_WEATHER, 'humidity': 85.0, 'wind_cardinal': 'W', 'wind_direction_deg': 270,
        }
        self.client.force_authenticate(self.kagawad)
        resp = self.client.get(reverse('active_hotspots'))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        risk = Alert.objects.get(recipient=self.kagawad, hotspot=self.hotspot, title='Weather Risk')
        self.assertEqual(risk.severity, 'WARNING')
        # Wind also swung NE -> W, so the dispersal alert goes out too.
        self.assertTrue(Alert.objects.filter(
            recipient=self.kagawad, hotspot=self.hotspot, title='Dispersal Update').exists())
        # Weather alerts reach every role in the area, not just management -
        # the reporting farmer gets both as well.
        self.assertTrue(Alert.objects.filter(
            recipient=self.farmer, hotspot=self.hotspot, title='Weather Risk').exists())
        self.assertTrue(Alert.objects.filter(
            recipient=self.farmer, hotspot=self.hotspot, title='Dispersal Update').exists())
