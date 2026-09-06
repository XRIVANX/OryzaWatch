from rest_framework import status
from rest_framework.test import APITestCase

from users.models import User

from .models import Farm, polygon_area_hectares

# A ~1 hectare square, roughly 100m x 100m, centered near Asuncion, Davao del Norte.
SQUARE_BOUNDARY = [
    [7.4500, 125.5700],
    [7.4509, 125.5700],
    [7.4509, 125.5709],
    [7.4500, 125.5709],
]


class PolygonAreaTestCase(APITestCase):
    def test_area_of_open_shape_is_zero(self):
        self.assertEqual(polygon_area_hectares([[0, 0], [0, 1]]), 0.0)

    def test_area_of_square_is_roughly_one_hectare(self):
        area = polygon_area_hectares(SQUARE_BOUNDARY)
        self.assertAlmostEqual(area, 1.0, delta=0.15)


class MyFarmViewTestCase(APITestCase):
    def setUp(self):
        self.farmer = User.objects.create_user(
            username='farmer1', password='Password123!', role='FARMER',
            municipality='ASUNCION', barangay='Ising',
        )

    def test_get_before_setup_is_404(self):
        self.client.force_authenticate(self.farmer)
        response = self.client.get('/api/farms/me/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_put_creates_farm_with_manual_hectares(self):
        self.client.force_authenticate(self.farmer)
        response = self.client.put('/api/farms/me/', {
            'latitude': '7.450000', 'longitude': '125.570000', 'size_hectares': 2.5,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['size_hectares'], 2.5)
        self.assertEqual(Farm.objects.count(), 1)

    def test_put_derives_hectares_from_boundary(self):
        self.client.force_authenticate(self.farmer)
        response = self.client.put('/api/farms/me/', {
            'latitude': '7.450000', 'longitude': '125.570000',
            'boundary': SQUARE_BOUNDARY, 'size_hectares': 999,  # server value should win
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertAlmostEqual(response.data['size_hectares'], 1.0, delta=0.15)

    def test_put_without_boundary_or_size_is_rejected(self):
        self.client.force_authenticate(self.farmer)
        response = self.client.put('/api/farms/me/', {
            'latitude': '7.450000', 'longitude': '125.570000',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_second_put_updates_rather_than_duplicates(self):
        self.client.force_authenticate(self.farmer)
        self.client.put('/api/farms/me/', {
            'latitude': '7.450000', 'longitude': '125.570000', 'size_hectares': 1,
        }, format='json')
        response = self.client.put('/api/farms/me/', {
            'latitude': '7.451000', 'longitude': '125.571000', 'size_hectares': 3,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Farm.objects.count(), 1)
        self.assertEqual(Farm.objects.first().size_hectares, 3)


class FarmAccessControlTestCase(APITestCase):
    def setUp(self):
        self.farmer = User.objects.create_user(
            username='farmer2', password='Password123!', role='FARMER',
        )
        self.other_farmer = User.objects.create_user(
            username='farmer3', password='Password123!', role='FARMER',
        )
        self.kagawad = User.objects.create_user(
            username='kagawad1', password='Password123!', role='KAGAWAD',
        )
        self.farm = Farm.objects.create(
            farmer=self.farmer, latitude='7.450000', longitude='125.570000', size_hectares=1,
        )

    def test_farmer_cannot_list_all_farms(self):
        self.client.force_authenticate(self.farmer)
        response = self.client.get('/api/farms/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_kagawad_can_list_all_farms(self):
        self.client.force_authenticate(self.kagawad)
        response = self.client.get('/api/farms/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_other_farmer_cannot_view_someone_elses_farm(self):
        self.client.force_authenticate(self.other_farmer)
        response = self.client.get(f'/api/farms/{self.farm.pk}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_kagawad_can_edit_any_farm(self):
        self.client.force_authenticate(self.kagawad)
        response = self.client.patch(f'/api/farms/{self.farm.pk}/', {'size_hectares': 5}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['size_hectares'], 5)
