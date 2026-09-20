from rest_framework.test import APITestCase
from django.urls import reverse
from django.core.cache import cache
from rest_framework import status
from users.models import User
from diagnostics.models import LeafScan
from analytics.models import DiseaseHotspot


def detail_of(resp):
    """Return the DRF response's 'detail' string.

    The test client's response is typed as a plain WSGIResponse by the static
    checker, which doesn't know about DRF's `.data`. Reading it here (typed as
    Any) keeps the type-checker quiet without scattering ignores everywhere.
    """
    # pyrefly: ignore [missing-attribute]
    return resp.data['detail']


class RegistrationRoleTestCase(APITestCase):
    """Registration is admin-only: there is no public self-registration, and
    no caller may grant a role above their own.

    Three layers enforce that, and each returns a different status, so the
    tests below pin all three rather than just the refusal:
      401  IsAuthenticated  - anonymous callers never reach the view
      403  the view         - non-admins, and a Kagawad reaching past FARMER
      400  the serializer   - MAO_ADMIN is not creatable here by anyone
    """

    def setUp(self):
        cache.clear()
        self.url = reverse('auth_register')
        self.admin = User.objects.create_user(
            username='admin_reg', password='Password123!', role='MAO_ADMIN',
            municipality='CARMEN', barangay='Ising')
        self.kagawad = User.objects.create_user(
            username='kagawad_reg', password='Password123!', role='KAGAWAD',
            municipality='CARMEN', barangay='Ising')
        self.farmer = User.objects.create_user(
            username='farmer_reg', password='Password123!', role='FARMER',
            municipality='CARMEN', barangay='Ising')

    def _payload(self, role):
        return {
            'username': f'user_{role.lower()}', 'email': f'{role}@x.com',
            'password': 'Password123!', 'role': role,
            'municipality': 'CARMEN', 'barangay': 'Ising',
        }

    def _was_not_created(self, role):
        return not User.objects.filter(username=f'user_{role.lower()}').exists()

    def test_anonymous_cannot_register_any_role(self):
        for role in ('MAO_ADMIN', 'KAGAWAD', 'FARMER'):
            with self.subTest(role=role):
                resp = self.client.post(self.url, self._payload(role), format='json')
                self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
                self.assertTrue(self._was_not_created(role))

    def test_farmer_cannot_register_anyone(self):
        self.client.force_authenticate(self.farmer)
        resp = self.client.post(self.url, self._payload('FARMER'), format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(self._was_not_created('FARMER'))

    def test_kagawad_can_register_a_farmer(self):
        self.client.force_authenticate(self.kagawad)
        resp = self.client.post(self.url, self._payload('FARMER'), format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(User.objects.get(username='user_farmer').role, 'FARMER')

    def test_kagawad_cannot_register_above_farmer(self):
        self.client.force_authenticate(self.kagawad)
        for role in ('KAGAWAD', 'MAO_ADMIN'):
            with self.subTest(role=role):
                resp = self.client.post(self.url, self._payload(role), format='json')
                self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
                self.assertTrue(self._was_not_created(role))

    def test_admin_can_register_a_kagawad(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.post(self.url, self._payload('KAGAWAD'), format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(User.objects.get(username='user_kagawad').role, 'KAGAWAD')

    def test_mao_admin_cannot_be_created_even_by_an_admin(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.post(self.url, self._payload('MAO_ADMIN'), format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(self._was_not_created('MAO_ADMIN'))

class LoginLockoutTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username='testuser',
            password='Password123!',
            role='FARMER',
            municipality='CARMEN',
            barangay='Ising'
        )
        self.login_url = reverse('auth_login')

    def test_three_failed_login_attempts_triggers_lockout(self):
        # Attempt 1: wrong password -> generic message, no attempt-count leak
        resp1 = self.client.post(self.login_url, {'username': 'testuser', 'password': 'wrongpassword'}, format='json')
        self.assertEqual(resp1.status_code, status.HTTP_401_UNAUTHORIZED, getattr(resp1, 'content', b'').decode())
        self.assertTrue(hasattr(resp1, 'data'), f"Response missing 'data'. Content: {getattr(resp1, 'content', b'').decode()}")
        self.assertNotIn("attempt(s) remaining", detail_of(resp1))
        self.assertIn("Invalid username or password", detail_of(resp1))

        # Attempt 2: wrong password -> still generic
        resp2 = self.client.post(self.login_url, {'username': 'testuser', 'password': 'wrongpassword'}, format='json')
        self.assertEqual(resp2.status_code, status.HTTP_401_UNAUTHORIZED, getattr(resp2, 'content', b'').decode())
        self.assertIn("Invalid username or password", detail_of(resp2))

        # Attempt 3: wrong password -> should trigger lockout
        resp3 = self.client.post(self.login_url, {'username': 'testuser', 'password': 'wrongpassword'}, format='json')
        self.assertEqual(resp3.status_code, status.HTTP_429_TOO_MANY_REQUESTS, getattr(resp3, 'content', b'').decode())
        self.assertTrue(hasattr(resp3, 'data'), f"Response missing 'data'. Content: {getattr(resp3, 'content', b'').decode()}")
        self.assertIn("Too many failed login attempts", detail_of(resp3))

        # Attempt 4 while locked out -> even with correct password, blocked during lockout
        resp4 = self.client.post(self.login_url, {'username': 'testuser', 'password': 'Password123!'}, format='json')
        self.assertEqual(resp4.status_code, status.HTTP_429_TOO_MANY_REQUESTS, getattr(resp4, 'content', b'').decode())
        self.assertTrue(hasattr(resp4, 'data'), f"Response missing 'data'. Content: {getattr(resp4, 'content', b'').decode()}")
        self.assertIn("Account is locked", detail_of(resp4))

    def test_successful_login_resets_failed_attempts(self):
        # Attempt 1: wrong password
        resp1 = self.client.post(self.login_url, {'username': 'testuser', 'password': 'wrongpassword'}, format='json')
        self.assertEqual(resp1.status_code, status.HTTP_401_UNAUTHORIZED, getattr(resp1, 'content', b'').decode())

        # Attempt 2: correct password -> resets counter
        resp2 = self.client.post(self.login_url, {'username': 'testuser', 'password': 'Password123!'}, format='json')
        self.assertEqual(resp2.status_code, status.HTTP_200_OK, getattr(resp2, 'content', b'').decode())

        # Attempt 3: wrong password after success -> counter was reset, so this is
        # attempt 1 again (not immediately locked out) and stays generic.
        resp3 = self.client.post(self.login_url, {'username': 'testuser', 'password': 'wrongpassword'}, format='json')
        self.assertEqual(resp3.status_code, status.HTTP_401_UNAUTHORIZED, getattr(resp3, 'content', b'').decode())
        self.assertTrue(hasattr(resp3, 'data'), f"Response missing 'data'. Content: {getattr(resp3, 'content', b'').decode()}")
        self.assertIn("Invalid username or password", detail_of(resp3))



class ListUsersHotspotStatusTestCase(APITestCase):
    """A farmer's CROP STATUS in the admin table follows their active
    hotspot, not just their latest scan - so resolving/reopening a hotspot
    is reflected here without a new scan."""

    def setUp(self):
        self.admin = User.objects.create_user(
            username='admin1', password='Password123!', role='MAO_ADMIN')
        self.farmer = User.objects.create_user(
            username='farmer1', password='Password123!', role='FARMER')
        self.scan = LeafScan.objects.create(
            reporter=self.farmer, image='leaf_scans/x.jpg', detected_disease='BLB',
            confidence_score=0.9, latitude='7.000000', longitude='125.000000')

    def _farmer_row(self, resp):
        return next(r for r in resp.data['results'] if r['username'] == 'farmer1')

    def test_no_hotspot_yet_is_safe(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.get('/api/users/', {'role': 'FARMER'})
        row = self._farmer_row(resp)
        self.assertEqual(row['status'], 'Safe')
        self.assertIsNone(row['active_hotspot_id'])

    def test_active_hotspot_shows_critical(self):
        hotspot = DiseaseHotspot.objects.create(
            scan=self.scan, status='CRITICAL', temperature=30.0, humidity=80.0,
            wind_speed=5.0, wind_direction_deg=45, wind_cardinal='NE')
        self.client.force_authenticate(self.admin)
        resp = self.client.get('/api/users/', {'role': 'FARMER'})
        row = self._farmer_row(resp)
        self.assertEqual(row['status'], 'Critical')
        self.assertEqual(row['active_hotspot_id'], hotspot.id)

    def test_resolved_hotspot_shows_safe_again(self):
        DiseaseHotspot.objects.create(
            scan=self.scan, status='RESOLVED', is_active=False, temperature=30.0,
            humidity=80.0, wind_speed=5.0, wind_direction_deg=45, wind_cardinal='NE')
        self.client.force_authenticate(self.admin)
        resp = self.client.get('/api/users/', {'role': 'FARMER'})
        row = self._farmer_row(resp)
        self.assertEqual(row['status'], 'Safe')
        self.assertIsNone(row['active_hotspot_id'])
