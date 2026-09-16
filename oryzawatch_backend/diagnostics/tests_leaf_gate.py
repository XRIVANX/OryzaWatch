"""
Tests for the rice-leaf gate (diagnostics/leaf_gate.py). No trained models are
needed: artifacts are faked with a tiny TorchScript module and a hand-made
reference set.
"""
import io
import tempfile
from pathlib import Path
from unittest.mock import patch

import numpy as np
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, override_settings
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from diagnostics import leaf_gate
from diagnostics.ai import _looks_like_leaf
from users.models import User


def image_upload(color, name='leaf.png'):
    buffer = io.BytesIO()
    Image.new('RGB', (64, 64), color).save(buffer, 'PNG')
    return SimpleUploadedFile(name, buffer.getvalue(), content_type='image/png')


GREEN = (40, 160, 40)
GREY = (128, 128, 128)


class SimilarityTests(SimpleTestCase):
    def test_top_k_mean_of_normalised_reference(self):
        reference = np.eye(4, dtype='float32')
        self.assertAlmostEqual(leaf_gate.top_k_similarity([1, 0, 0, 0], reference, neighbours=1), 1.0)
        # Nearest two rows score 1 and 0.
        self.assertAlmostEqual(leaf_gate.top_k_similarity([1, 0, 0, 0], reference, neighbours=2), 0.5)
        self.assertEqual(leaf_gate.top_k_similarity([0, 0, 0, 0], reference), 0.0)

    def test_neighbours_capped_to_reference_size(self):
        reference = np.eye(2, dtype='float32')
        self.assertAlmostEqual(leaf_gate.top_k_similarity([1, 1], reference, neighbours=50), 2 ** -0.5, places=5)


class GateArtifactTests(SimpleTestCase):
    def tearDown(self):
        leaf_gate.reset_cache()

    def test_missing_artifacts_accept_without_score(self):
        with override_settings(AI_LEAF_GATE_MODEL_PATH='does/not/exist.pt',
                               AI_LEAF_GATE_REFERENCE_PATH='does/not/exist.npz'):
            leaf_gate.reset_cache()
            self.assertEqual(leaf_gate.is_rice_leaf(image_upload(GREEN)), (True, None))

    def test_loaded_artifacts_apply_threshold(self):
        import torch

        class MeanColour(torch.nn.Module):
            def forward(self, x):
                return x.mean(dim=(2, 3))  # (N, 3) embedding: mean R, G, B

        with tempfile.TemporaryDirectory() as tmp:
            model_path, reference_path = Path(tmp) / 'gate.pt', Path(tmp) / 'gate.npz'
            torch.jit.trace(MeanColour(), torch.zeros(1, 3, 224, 224)).save(str(model_path))
            # Reference "rice photos" are pure green; threshold 0.9 cosine.
            np.savez(reference_path, reference=np.array([[0, 1, 0]], dtype='float16'),
                     threshold=np.float32(0.9), neighbours=np.int32(1))
            with override_settings(AI_LEAF_GATE_MODEL_PATH=str(model_path),
                                   AI_LEAF_GATE_REFERENCE_PATH=str(reference_path)):
                leaf_gate.reset_cache()
                accepted, similarity = leaf_gate.is_rice_leaf(image_upload((0, 200, 0)))
                self.assertTrue(accepted)
                self.assertGreater(similarity, 0.99)
                accepted, similarity = leaf_gate.is_rice_leaf(image_upload((200, 200, 200)))
                self.assertFalse(accepted)
                self.assertLess(similarity, 0.9)
                leaf_gate.reset_cache()  # release file handles before the temp dir is removed


class LooksLikeLeafTests(SimpleTestCase):
    def test_low_vegetation_rejected_before_gate(self):
        with patch('diagnostics.leaf_gate.is_rice_leaf') as gate:
            self.assertFalse(_looks_like_leaf(image_upload(GREY)))
            gate.assert_not_called()

    def test_gate_decides_for_green_images(self):
        with patch('diagnostics.leaf_gate.is_rice_leaf', return_value=(False, 0.61)):
            self.assertFalse(_looks_like_leaf(image_upload(GREEN)))
        with patch('diagnostics.leaf_gate.is_rice_leaf', return_value=(True, 0.84)):
            self.assertTrue(_looks_like_leaf(image_upload(GREEN)))

    def test_broken_gate_falls_back_to_vegetation_check(self):
        with patch('diagnostics.leaf_gate.is_rice_leaf', side_effect=RuntimeError('corrupt')):
            self.assertTrue(_looks_like_leaf(image_upload(GREEN)))


class NotALeafUploadTests(APITestCase):
    def test_rejected_photo_returns_422_without_classifying(self):
        user = User.objects.create_user(username='gate-user', password='Password123!', role='FARMER')
        self.client.force_authenticate(user)
        with patch('diagnostics.leaf_gate.is_rice_leaf', return_value=(False, 0.6)), \
                patch('diagnostics.ai._load_backend', side_effect=AssertionError('classifier must not run')):
            response = self.client.post(
                '/api/diagnostics/upload/',
                {'image': image_upload(GREEN), 'latitude': '7.448300', 'longitude': '125.809400'},
                format='multipart',
            )
        self.assertEqual(response.status_code, 422)
        self.assertIn('rice leaf', response.data['detail'])
