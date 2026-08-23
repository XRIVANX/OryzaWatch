from unittest.mock import patch
import base64

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from users.models import User


class LeafScanUploadTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='scanner-user', password='Password123!', role='FARMER'
        )

    @patch('diagnostics.views.predict_leaf', return_value=('BLAST', 0.91))
    def test_upload_stores_ai_result(self, predict_leaf):
        self.client.force_authenticate(self.user)
        image = SimpleUploadedFile(
            'leaf.png',
            base64.b64decode(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
            ),
            content_type='image/png',
        )
        response = self.client.post(
            '/api/diagnostics/upload/',
            {'image': image, 'latitude': '7.448300', 'longitude': '125.809400'},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['detected_disease'], 'BLAST')
        self.assertEqual(response.data['confidence_score'], 0.91)
        predict_leaf.assert_called_once()
