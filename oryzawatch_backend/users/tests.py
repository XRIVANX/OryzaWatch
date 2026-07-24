from rest_framework.test import APITestCase
from django.urls import reverse
from django.core.cache import cache
from rest_framework import status
from users.models import User


def detail_of(resp):
    """Return the DRF response's 'detail' string.

    The test client's response is typed as a plain WSGIResponse by the static
    checker, which doesn't know about DRF's `.data`. Reading it here (typed as
    Any) keeps the type-checker quiet without scattering ignores everywhere.
    """
    # pyrefly: ignore [missing-attribute]
    return resp.data['detail']


class RegistrationRoleTestCase(APITestCase):
    """Public registration must not be able to grant privileged roles."""

    def setUp(self):
        cache.clear()
        self.url = reverse('auth_register')

    def _payload(self, role):
        return {
            'username': f'user_{role.lower()}', 'email': f'{role}@x.com',
            'password': 'Password123!', 'role': role,
            'municipality': 'CARMEN', 'barangay': 'Ising',
        }

    def test_cannot_self_register_as_mao_admin(self):
        resp = self.client.post(self.url, self._payload('MAO_ADMIN'), format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_self_register_as_kagawad(self):
        resp = self.client.post(self.url, self._payload('KAGAWAD'), format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_can_self_register_as_farmer(self):
        resp = self.client.post(self.url, self._payload('FARMER'), format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(User.objects.get(username='user_farmer').role, 'FARMER')

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


