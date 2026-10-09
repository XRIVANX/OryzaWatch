import base64
import csv
import tempfile
from datetime import timedelta
from io import StringIO
from pathlib import Path
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.files.base import ContentFile
import hashlib
from django.core.management import call_command
from django.conf import settings
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from diagnostics.models import LeafScan, RiceVariety
from users.models import User


class ScanDataFoundationTests(APITestCase):
    def setUp(self):
        self.media = tempfile.TemporaryDirectory(dir=settings.BASE_DIR)
        assert Path(self.media.name).resolve().is_relative_to(Path(settings.BASE_DIR).resolve())
        self.addCleanup(self.media.cleanup)
        self.settings_override = override_settings(MEDIA_ROOT=self.media.name)
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        self.farmer = User.objects.create_user(username='data-farmer', role='FARMER')
        self.reviewer = User.objects.create_user(username='data-reviewer', role='MAO_ADMIN')
        self.variety = RiceVariety.objects.create(name='Test cultivar')
        self.scan = LeafScan.objects.create(
            reporter=self.farmer, image='leaf_scans/sample.png', latitude=7, longitude=125,
            detected_disease='BLAST', confidence_score=0.8,
        )

    def test_farmer_cannot_review_or_access_queue(self):
        self.client.force_authenticate(self.farmer)
        self.assertEqual(self.client.get('/api/diagnostics/review-queue/').status_code, 403)
        response = self.client.patch(f'/api/diagnostics/scans/{self.scan.pk}/verify/',
                                     {'verification_status': 'VERIFIED', 'verified_disease': 'HEALTHY',
                                      'verification_method': 'FIELD_EXPERT'})
        self.assertEqual(response.status_code, 403)
        self.scan.refresh_from_db()
        self.assertEqual(self.scan.verification_status, 'UNREVIEWED')

    def test_review_keeps_ai_prediction_and_records_confirmed_healthy(self):
        self.client.force_authenticate(self.reviewer)
        response = self.client.patch(f'/api/diagnostics/scans/{self.scan.pk}/verify/',
                                     {'verification_status': 'VERIFIED', 'verified_disease': 'HEALTHY',
                                      'verification_method': 'FIELD_EXPERT'})
        self.assertEqual(response.status_code, 200)
        self.scan.refresh_from_db()
        self.assertEqual(self.scan.detected_disease, 'BLAST')
        self.assertEqual(self.scan.verified_disease, 'HEALTHY')
        self.assertEqual(self.scan.verified_by, self.reviewer)
        self.assertIsNotNone(self.scan.verified_at)
        self.assertEqual(self.client.get('/api/diagnostics/review-queue/').data, [])

    def test_verified_review_requires_diagnosis_and_method(self):
        self.client.force_authenticate(self.reviewer)
        for payload in ({'verification_status': 'VERIFIED'},
                        {'verification_status': 'VERIFIED', 'verified_disease': 'BLB'}):
            response = self.client.patch(f'/api/diagnostics/scans/{self.scan.pk}/verify/', payload)
            self.assertEqual(response.status_code, 400)
        self.scan.refresh_from_db()
        self.assertEqual(self.scan.verification_status, 'UNREVIEWED')

    def test_inconclusive_review_cannot_create_a_negative_label(self):
        self.client.force_authenticate(self.reviewer)
        response = self.client.patch(f'/api/diagnostics/scans/{self.scan.pk}/verify/',
                                     {'verification_status': 'INCONCLUSIVE', 'verified_disease': 'HEALTHY',
                                      'verification_notes': 'Insufficient photo detail.'})
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data['verified_disease'])

    @patch('diagnostics.views.predict_leaf', return_value=('BLB', 0.8, {'BLB': 0.8, 'HEALTHY': 0.1, 'BLAST': 0.1}))
    @patch('diagnostics.views.generate_gradcam', return_value=None)
    @patch('diagnostics.views.run_segmentation', return_value=None)
    @patch('diagnostics.views.run_lesion_detection', return_value=[])
    def test_capture_metadata_and_probabilities_survive_history_and_ignore_forged_review(self, *_mocks):
        self.client.force_authenticate(self.farmer)
        image = SimpleUploadedFile('leaf.png', base64.b64decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),
            content_type='image/png')
        observed_on = (timezone.localdate() - timedelta(days=2)).isoformat()
        response = self.client.post('/api/diagnostics/upload/', {
            'image': image, 'latitude': '7.000000', 'longitude': '125.000000',
            'variety': self.variety.pk, 'growth_stage': 'TILLERING',
            'symptom_notes': 'Yellowing margins', 'observed_on': observed_on,
            'verification_status': 'VERIFIED', 'verified_disease': 'HEALTHY',
        }, format='multipart')
        self.assertEqual(response.status_code, 201)
        history = self.client.get('/api/diagnostics/history/').data[0]
        self.assertEqual(history['variety_name'], 'Test cultivar')
        self.assertEqual(history['symptom_notes'], 'Yellowing margins')
        self.assertEqual(history['observed_on'], observed_on)
        self.assertEqual(history['probabilities']['BLB'], 0.8)
        self.assertEqual(history['verification_status'], 'UNREVIEWED')
        self.assertIsNone(history['verified_disease'])

    def test_catalog_does_not_invent_tolerance_for_unknown_evidence(self):
        RiceVariety.objects.create(name='Inactive cultivar', is_active=False)
        self.client.force_authenticate(self.farmer)
        data = self.client.get('/api/diagnostics/varieties/').data
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['disease_evidence'], [])
        self.assertIsNone(data[0]['maturity_days'])

    def test_variety_data_entry_is_admin_only_and_evidence_requires_source(self):
        for role in (self.farmer, User.objects.create_user(username='data-kagawad', role='KAGAWAD')):
            self.client.force_authenticate(role)
            self.assertEqual(self.client.post('/api/diagnostics/varieties/', {'name': 'New cultivar'}).status_code, 403)
            self.assertEqual(self.client.patch(f'/api/diagnostics/varieties/{self.variety.pk}/', {'name': 'Changed'}).status_code, 403)
            self.assertEqual(self.client.post(f'/api/diagnostics/varieties/{self.variety.pk}/evidence/', {}).status_code, 403)
        self.client.force_authenticate(self.reviewer)
        created = self.client.post('/api/diagnostics/varieties/', {'name': 'New cultivar'})
        self.assertEqual(created.status_code, 201)
        payload = {'disease': 'BLB', 'response': 'TOLERANT', 'evidence_type': 'FIELD_OBSERVATION'}
        url = f'/api/diagnostics/varieties/{created.data["id"]}/evidence/'
        self.assertEqual(self.client.post(url, payload).status_code, 400)
        payload['source'] = 'Test field report reference'
        evidence = self.client.post(url, payload)
        self.assertEqual(evidence.status_code, 201)
        variety_data = self.client.get(f'/api/diagnostics/varieties/{created.data["id"]}/').data
        self.assertEqual(variety_data['disease_evidence'][0]['source'], payload['source'])

    def test_verified_data_download_is_admin_only_and_hashes_available_images(self):
        self.scan.image.save('sample.png', ContentFile(b'manifest-hash-test'), save=False)
        self.scan.verification_status = 'VERIFIED'
        self.scan.verified_disease = 'BLB'
        self.scan.verification_method = 'FIELD_EXPERT'
        self.scan.verified_by = self.reviewer
        self.scan.verified_at = timezone.now()
        self.scan.symptom_notes = '=1+1'
        self.scan.save()
        self.client.force_authenticate(self.farmer)
        self.assertEqual(self.client.get('/api/diagnostics/verified-data/').status_code, 403)
        self.client.force_authenticate(self.reviewer)
        response = self.client.get('/api/diagnostics/verified-data/')
        self.assertEqual(response.status_code, 200)
        data = b''.join(response.streaming_content).decode('utf-8')
        rows = list(csv.DictReader(StringIO(data)))
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['image_sha256'], hashlib.sha256(b'manifest-hash-test').hexdigest())
        self.assertEqual(rows[0]['image_available'], 'True')
        self.assertEqual(rows[0]['symptom_notes'], "'=1+1")

    def test_export_excludes_ai_only_and_inconclusive_labels_and_flags_missing_image(self):
        self.scan.verification_status = 'VERIFIED'
        self.scan.verified_disease = 'HEALTHY'
        self.scan.verification_method = 'MAO_INSPECTION'
        self.scan.verified_by = self.reviewer
        self.scan.verified_at = timezone.now()
        self.scan.save()
        LeafScan.objects.create(reporter=self.farmer, image='pending.png', latitude=7, longitude=125)
        LeafScan.objects.create(reporter=self.farmer, image='unclear.png', latitude=7, longitude=125,
                                verification_status='INCONCLUSIVE')
        output = Path(self.media.name) / 'manifest.csv'
        call_command('export_verified_scans', output=str(output), stdout=StringIO())
        with output.open(encoding='utf-8', newline='') as handle:
            rows = list(csv.DictReader(handle))
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['confirmed_disease'], 'HEALTHY')
        self.assertEqual(rows[0]['ai_predicted_disease'], 'BLAST')
        self.assertEqual(rows[0]['variety_id'], '')
        self.assertEqual(rows[0]['image_available'], 'False')
