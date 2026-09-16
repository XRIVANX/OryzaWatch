"""
"Is this really a rice-leaf photo?" check, run before the disease classifier.

Why it exists: the classifier only knows HEALTHY, BLB and BLAST. Anything else
still gets forced into one of those labels, often with high confidence. Phone
uploads showed a face as "BLB 86%", a mousepad as "BLAST 88%" and a computer
mouse as "BLB 76%". The older vegetation check could not stop them: it only
needs 3% green pixels, which a green shirt or a green LED already provides.

How it works: embed the photo with a *generic* ImageNet MobileNetV2 and measure
cosine similarity to the rice training photos (mean of the nearest
NEIGHBOURS). Below the threshold, the photo is rejected. The fine-tuned
classifier's own features are not used, because fine-tuning to three classes
collapses them and they can no longer tell a face from a leaf. Generic
features still can.

Calibration (17 Sept 2026, threshold 0.70):
  * 525 validation photos:                   lowest similarity 0.731
  * 19 real phone and web rice photos:       lowest similarity 0.745
  * 115 non-rice photos (110 stock photos,
    5 phone uploads incl. houseplant, sweet
    potato leaves, face, mouse, mousepad):   highest similarity 0.674

Artifacts, both built by `manage.py build_leaf_gate`:
  * ai_models/rice_leaf_gate.pt   TorchScript feature extractor. Normalisation
                                  is inside the graph, and the server never
                                  downloads weights at runtime.
  * ai_models/rice_leaf_gate.npz  Reference embeddings (float16), threshold,
                                  neighbour count, and calibration stats.

If the artifacts are missing, the check is skipped and only the vegetation
check applies, which is the behaviour before this module existed.
"""
from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path

from django.conf import settings

logger = logging.getLogger(__name__)

DEFAULT_THRESHOLD = 0.70
NEIGHBOURS = 10
INPUT_SIZE = (224, 224)
IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


def gate_paths():
    return Path(settings.AI_LEAF_GATE_MODEL_PATH), Path(settings.AI_LEAF_GATE_REFERENCE_PATH)


def top_k_similarity(embedding, reference, neighbours=NEIGHBOURS):
    """Mean cosine similarity between one embedding and its nearest rows in
    `reference`. The rows must already be L2-normalised."""
    import numpy as np

    vector = np.asarray(embedding, dtype='float32').ravel()
    norm = float(np.linalg.norm(vector))
    if norm == 0.0:
        return 0.0
    similarities = reference @ (vector / norm)
    k = max(1, min(int(neighbours), similarities.shape[0]))
    return float(np.partition(similarities, -k)[-k:].mean())


@lru_cache(maxsize=1)
def _load_gate():
    model_path, reference_path = gate_paths()
    if not model_path.is_file() or not reference_path.is_file():
        logger.warning(
            'Rice-leaf gate not built (%s, %s missing); only the vegetation check applies. '
            'Run "manage.py build_leaf_gate".', model_path.name, reference_path.name,
        )
        return None

    import numpy as np
    import torch

    extractor = torch.jit.load(str(model_path), map_location='cpu')
    extractor.eval()
    with np.load(reference_path) as data:
        reference = data['reference'].astype('float32')
        threshold = float(data['threshold']) if 'threshold' in data else DEFAULT_THRESHOLD
        neighbours = int(data['neighbours']) if 'neighbours' in data else NEIGHBOURS
    reference /= np.clip(np.linalg.norm(reference, axis=1, keepdims=True), 1e-12, None)
    return extractor, reference, threshold, neighbours


def reset_cache():
    _load_gate.cache_clear()


def image_tensor(image):
    """PIL image -> (1, 3, 224, 224) float tensor in [0, 1]."""
    import numpy as np
    import torch

    array = np.asarray(image.convert('RGB').resize(INPUT_SIZE), dtype='float32') / 255.0
    return torch.from_numpy(np.ascontiguousarray(array.transpose(2, 0, 1))).unsqueeze(0)


def is_rice_leaf(image_file):
    """
    Returns (accepted, similarity). similarity is None when the gate is not
    built, in which case the photo is accepted and the vegetation check alone
    decides.
    """
    loaded = _load_gate()
    if loaded is None:
        return True, None
    extractor, reference, threshold, neighbours = loaded

    import torch
    from PIL import Image

    image_file.seek(0)
    with Image.open(image_file) as source:
        tensor = image_tensor(source)
    image_file.seek(0)
    with torch.no_grad():
        embedding = extractor(tensor)[0].cpu().numpy()
    similarity = top_k_similarity(embedding, reference, neighbours)
    return similarity >= threshold, similarity
