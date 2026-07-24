from rest_framework.test import APITestCase
from django.urls import reverse
from rest_framework import status
from users.models import User
from diagnostics.models import LeafScan
from analytics.models import DiseaseHotspot


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
