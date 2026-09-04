"""Rice-leaf disease inference.

Two interchangeable backends:

* **PyTorch** (``rice_leaf.pt``, a TorchScript module) - the primary backend, used
  whenever the file is present. Its graph normalises the input and applies softmax,
  so it expects a ``(1, 3, 224, 224)`` float tensor with values in ``[0, 1]``.
* **Keras** (``rice_leaf.keras``) - the fallback, used only when the PyTorch model
  is missing or fails to load. It rescales inside the graph, so it expects a
  ``(1, 224, 224, 3)`` float array with values in ``[0, 255]``.

Both share ``rice_leaf_labels.json`` (``{"0": "BLB", "1": "HEALTHY", "2": "BLAST"}``).
"""

import json
import logging
from functools import lru_cache
from pathlib import Path

from django.conf import settings
from rest_framework.exceptions import APIException

logger = logging.getLogger(__name__)

VALID_LABELS = {'HEALTHY', 'BLB', 'BLAST'}
INPUT_SIZE = (224, 224)
IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)

# The classifier only knows BLB/HEALTHY/BLAST - it has no "other" class, so an
# unrelated photo (a face, a wall, ...) still gets forced into one of those three
# labels. This rejects anything that doesn't plausibly look like a leaf before
# trusting the model's answer. Calibrated against the full training + validation
# set (1996 photos, all three classes): real field photos score 0.25+, the lowest
# score of 0.044 belongs to a synthetic (colour-jittered) augmentation, and
# synthetic skin-tone/wall test patches score ~0.01-0.04. 0.03 sits below every
# genuine leaf photo while still rejecting non-leaf images.
MIN_VEGETATION_RATIO = 0.03


class AIModelUnavailable(APIException):
    status_code = 503
    default_detail = 'The rice disease AI model is not installed yet.'
    default_code = 'ai_model_unavailable'


class NotALeafError(APIException):
    status_code = 422
    default_detail = "This doesn't look like a rice leaf. Please take a clear photo of a rice leaf."
    default_code = 'not_a_leaf'


def _read_labels(labels_path: Path) -> dict:
    with open(labels_path, encoding='utf-8') as handle:
        return json.load(handle)


def _build_torch_predictor(model_path: Path, labels: dict):
    try:
        import torch
    except ImportError as exc:  # pragma: no cover - environment issue
        raise AIModelUnavailable('Install the PyTorch runtime (torch, torchvision).') from exc
    import numpy as np
    from PIL import Image

    model = torch.jit.load(str(model_path), map_location='cpu')
    model.eval()

    def predict(image_file):
        image_file.seek(0)
        with Image.open(image_file) as source:
            array = np.asarray(source.convert('RGB').resize(INPUT_SIZE), dtype='float32') / 255.0
        chw = np.ascontiguousarray(array.transpose(2, 0, 1))
        tensor = torch.from_numpy(chw).unsqueeze(0)
        with torch.no_grad():
            probabilities = model(tensor)[0].cpu().numpy()
        return probabilities

    return predict, labels


def _build_keras_predictor(model_path: Path, labels: dict):
    try:
        from tensorflow import keras
    except ImportError as exc:  # pragma: no cover - environment issue
        raise AIModelUnavailable('Install the TensorFlow runtime.') from exc
    import numpy as np
    from PIL import Image

    model = keras.models.load_model(model_path)

    def predict(image_file):
        image_file.seek(0)
        with Image.open(image_file) as source:
            array = np.asarray(source.convert('RGB').resize(INPUT_SIZE), dtype='float32')
        probabilities = model.predict(np.expand_dims(array, axis=0), verbose=0)[0]
        return probabilities

    return predict, labels


@lru_cache(maxsize=1)
def _load_backend():
    """Return ``(backend_name, predict_fn, labels)``. Prefer PyTorch, fall back to Keras."""
    labels_path = Path(settings.AI_LABELS_PATH)
    torch_path = Path(settings.AI_TORCH_MODEL_PATH)
    keras_path = Path(settings.AI_MODEL_PATH)

    if not labels_path.is_file():
        raise AIModelUnavailable(
            f'AI label file is missing ({labels_path}). Run "manage.py train_leaf_torch" '
            f'(PyTorch, preferred) or "manage.py train_leaf_model" (Keras).'
        )
    labels = _read_labels(labels_path)

    if torch_path.is_file():
        try:
            predict, labels = _build_torch_predictor(torch_path, labels)
            return 'torch', predict, labels
        except AIModelUnavailable:
            raise
        except Exception:
            logger.exception(
                'PyTorch model at %s failed to load; falling back to Keras', torch_path
            )

    if keras_path.is_file():
        try:
            predict, labels = _build_keras_predictor(keras_path, labels)
            return 'keras', predict, labels
        except Exception as exc:
            logger.exception('Keras model at %s failed to load', keras_path)
            raise AIModelUnavailable('AI model could not be loaded.') from exc

    raise AIModelUnavailable(
        'No AI model found. Train one with "manage.py train_leaf_torch" (PyTorch, preferred) '
        f'or "manage.py train_leaf_model" (Keras). Looked for {torch_path} and {keras_path}.'
    )


def _looks_like_leaf(image_file) -> bool:
    """Cheap sanity check: does the image contain enough green/vegetation pixels?

    The model has no "not a leaf" class, so anything (a face, a document, a wall)
    gets forced into HEALTHY/BLB/BLAST. This rejects images that are overwhelmingly
    not plant-colored before we bother asking the classifier.
    """
    import numpy as np
    from PIL import Image

    image_file.seek(0)
    with Image.open(image_file) as source:
        array = np.asarray(source.convert('RGB').resize(INPUT_SIZE), dtype='float32')
    image_file.seek(0)

    red, green, blue = array[..., 0], array[..., 1], array[..., 2]
    # Vegetation (healthy or diseased) reads as green-dominant; skin, walls, paper,
    # etc. do not. (A broader mask that also counted yellow/tan pixels was tried and
    # dropped - it let skin tones through too, since a warm tan and a warm brown
    # lesion land in the same R/G/B neighbourhood.)
    vegetation_mask = (green > red + 8) & (green > blue + 8)
    vegetation_ratio = float(vegetation_mask.mean())
    return vegetation_ratio >= MIN_VEGETATION_RATIO


def predict_leaf(image):
    try:
        import numpy as np  # noqa: F401 - surfaces a clear error if the runtime is missing
        from PIL import Image  # noqa: F401
    except ImportError as exc:
        raise AIModelUnavailable('Install the AI runtime dependencies first.') from exc

    if not _looks_like_leaf(image):
        raise NotALeafError()

    backend, predict, labels = _load_backend()
    try:
        probabilities = predict(image)
    except AIModelUnavailable:
        raise
    except Exception as exc:
        logger.exception('%s inference failed', backend)
        raise AIModelUnavailable('AI inference failed on this image.') from exc

    class_index = max(range(len(probabilities)), key=lambda i: probabilities[i])
    disease = labels[str(class_index)]
    if disease not in VALID_LABELS:
        raise AIModelUnavailable('AI model labels are invalid.')
    class_probabilities = {labels[str(i)]: float(probabilities[i]) for i in range(len(probabilities))}
    return disease, float(probabilities[class_index]), class_probabilities
