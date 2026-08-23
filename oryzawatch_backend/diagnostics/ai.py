import json
from functools import lru_cache

from django.conf import settings
from rest_framework.exceptions import APIException


class AIModelUnavailable(APIException):
    status_code = 503
    default_detail = 'The rice disease AI model is not installed yet.'
    default_code = 'ai_model_unavailable'


@lru_cache(maxsize=1)
def _load_model():
    try:
        # noinspection PyPackageRequirements
        from tensorflow import keras
        model = keras.models.load_model(settings.AI_MODEL_PATH)
        with open(settings.AI_LABELS_PATH, encoding='utf-8') as labels_file:
            labels = json.load(labels_file)
    except FileNotFoundError as exc:
        raise AIModelUnavailable(
            'AI model files are missing. Run train_leaf_model after adding the dataset.'
        ) from exc
    except Exception as exc:
        raise AIModelUnavailable('AI model could not be loaded.') from exc
    return model, labels


def predict_leaf(image):
    try:
        from PIL import Image
        # noinspection PyPackageRequirements
        import numpy as np
    except ImportError as exc:
        raise AIModelUnavailable('Install the AI runtime dependencies first.') from exc

    model, labels = _load_model()
    image.seek(0)
    with Image.open(image) as source:
        prepared = source.convert('RGB').resize((224, 224))
        batch = np.asarray(prepared, dtype='float32') / 255.0
    prediction = model.predict(np.expand_dims(batch, axis=0), verbose=0)[0]
    class_index = int(np.argmax(prediction))
    disease = labels[str(class_index)]
    if disease not in {'HEALTHY', 'BLB', 'BLAST'}:
        raise AIModelUnavailable('AI model labels are invalid.')
    return disease, float(prediction[class_index])
