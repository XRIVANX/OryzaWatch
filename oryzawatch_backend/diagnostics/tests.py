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

    def _upload(self):
        self.client.force_authenticate(self.user)
        image = SimpleUploadedFile(
            'leaf.png',
            base64.b64decode(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
            ),
            content_type='image/png',
        )
        return self.client.post(
            '/api/diagnostics/upload/',
            {'image': image, 'latitude': '7.448300', 'longitude': '125.809400'},
            format='multipart',
        )

    @patch(
        'diagnostics.views.predict_leaf',
        return_value=('BLAST', 0.91, {'HEALTHY': 0.02, 'BLB': 0.07, 'BLAST': 0.91}),
    )
    @patch('diagnostics.views.generate_gradcam', return_value=None)
    @patch('diagnostics.views.run_segmentation', return_value=None)
    @patch('diagnostics.views.run_lesion_detection', return_value=[])
    def test_upload_stores_ai_result(self, run_lesion_detection, run_segmentation, generate_gradcam, predict_leaf):
        response = self._upload()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['detected_disease'], 'BLAST')
        self.assertEqual(response.data['confidence_score'], 0.91)
        self.assertEqual(response.data['probabilities'], {'HEALTHY': 0.02, 'BLB': 0.07, 'BLAST': 0.91})
        predict_leaf.assert_called_once()

        # The explainability/segmentation/YOLO add-ons are best-effort and only
        # populate once their own models are trained - an install without them
        # must still succeed with just these fields left null, never a failed
        # upload. Mocked here (rather than relying on ai_models/ being empty) so
        # this assertion holds regardless of what's actually been trained.
        self.assertIsNone(response.data['heatmap'])
        self.assertIsNone(response.data['segmentation_mask'])
        self.assertIsNone(response.data['affected_area_ratio'])
        self.assertIsNone(response.data['lesion_boxes'])

    @patch(
        'diagnostics.views.predict_leaf',
        return_value=('BLB', 0.85, {'HEALTHY': 0.05, 'BLB': 0.85, 'BLAST': 0.10}),
    )
    @patch('diagnostics.views.generate_gradcam', return_value=b'fake-jpeg-bytes')
    @patch('diagnostics.views.run_segmentation', return_value=(b'fake-png-bytes', 0.234))
    @patch(
        'diagnostics.views.run_lesion_detection',
        return_value=[{'class': 'blb_lesion', 'confidence': 0.8, 'x': 0.1, 'y': 0.1, 'w': 0.2, 'h': 0.2}],
    )
    def test_upload_populates_addons_once_trained(
        self, run_lesion_detection, run_segmentation, generate_gradcam, predict_leaf
    ):
        response = self._upload()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNotNone(response.data['heatmap'])
        self.assertIsNotNone(response.data['segmentation_mask'])
        self.assertEqual(response.data['affected_area_ratio'], 0.234)
        self.assertEqual(
            response.data['lesion_boxes'],
            [{'class': 'blb_lesion', 'confidence': 0.8, 'x': 0.1, 'y': 0.1, 'w': 0.2, 'h': 0.2}],
        )
