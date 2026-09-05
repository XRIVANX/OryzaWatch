"""Convert the trained Keras model to TensorFlow Lite for on-device mobile inference.

The PyTorch model (``train_leaf_torch``) serves the backend; the mobile app runs
offline on a ``.tflite`` built here from the Keras model (``train_leaf_model``).
Both are trained on the same ``datasets/rice_leaf`` split, so they share an
architecture, label order, and roughly the same accuracy.

The Keras graph already rescales ``[0, 255]`` inputs and applies softmax, so the
emitted ``.tflite`` takes a ``(1, 224, 224, 3)`` float32 tensor of raw RGB pixels
and returns 3 class probabilities in the order ``["BLB", "HEALTHY", "BLAST"]``.
"""

import json
import os
import shutil
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

os.environ.setdefault('TF_CPP_MIN_LOG_LEVEL', '3')

DEFAULT_MOBILE_ASSETS = (
    Path(settings.BASE_DIR).parent / 'oryzawatch_mobile' / 'assets' / 'model'
)


class Command(BaseCommand):
    help = 'Convert the Keras rice-leaf model to a .tflite bundle for the mobile app.'

    def add_arguments(self, parser):
        parser.add_argument('--keras-model', default=settings.AI_MODEL_PATH)
        parser.add_argument('--labels', default=settings.AI_LABELS_PATH)
        parser.add_argument(
            '--output',
            default=str(Path(settings.BASE_DIR) / 'ai_models' / 'rice_leaf.tflite'),
        )
        parser.add_argument(
            '--mobile-assets', default=str(DEFAULT_MOBILE_ASSETS),
            help='Directory to also copy the .tflite + labels into (the RN app bundles these).',
        )
        parser.add_argument(
            '--quantize', action='store_true',
            help='Apply dynamic-range quantisation (~4x smaller, tiny accuracy cost).',
        )
        parser.add_argument('--no-copy', action='store_true', help='Skip the mobile-assets copy.')

    def handle(self, *args, **options):
        try:
            import tensorflow as tf
        except ImportError as exc:
            raise CommandError('Install tensorflow-cpu before exporting to TFLite.') from exc
        tf.get_logger().setLevel('ERROR')

        keras_model_path = Path(options['keras_model'])
        labels_path = Path(options['labels'])
        if not keras_model_path.is_file():
            raise CommandError(
                f'Keras model not found at {keras_model_path}. Run "manage.py train_leaf_model" first.'
            )
        if not labels_path.is_file():
            raise CommandError(f'Labels not found at {labels_path}.')

        # The saved model's augmentation stage includes the custom RandomGaussianBlur
        # layer from train_leaf_model. Registering it (a side effect of calling the
        # factory) is required before load_model can deserialize it in this process.
        from .train_leaf_model import _random_gaussian_blur_layer
        _random_gaussian_blur_layer(tf)

        model = tf.keras.models.load_model(keras_model_path)
        converter = tf.lite.TFLiteConverter.from_keras_model(model)
        if options['quantize']:
            converter.optimizations = [tf.lite.Optimize.DEFAULT]
        tflite_bytes = converter.convert()

        output_path = Path(options['output'])
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(tflite_bytes)
        size_kb = len(tflite_bytes) / 1024
        self.stdout.write(self.style.SUCCESS(f'Wrote {output_path}  ({size_kb:.0f} KB)'))

        self._sanity_check(tf, tflite_bytes, labels_path)

        if not options['no_copy']:
            assets_dir = Path(options['mobile_assets'])
            assets_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(output_path, assets_dir / 'rice_leaf.tflite')
            shutil.copy2(labels_path, assets_dir / 'rice_leaf_labels.json')
            self.stdout.write(self.style.SUCCESS(f'Copied .tflite + labels into {assets_dir}'))

    def _sanity_check(self, tf, tflite_bytes, labels_path):
        interpreter = tf.lite.Interpreter(model_content=tflite_bytes)
        interpreter.allocate_tensors()
        inp = interpreter.get_input_details()[0]
        out = interpreter.get_output_details()[0]
        labels = json.loads(labels_path.read_text(encoding='utf-8'))
        self.stdout.write(f'  input  {inp["name"]}: shape={list(inp["shape"])} dtype={inp["dtype"].__name__}')
        self.stdout.write(f'  output {out["name"]}: shape={list(out["shape"])} dtype={out["dtype"].__name__}')
        if list(inp['shape']) != [1, 224, 224, 3]:
            self.stdout.write(self.style.WARNING(
                '  expected input shape [1, 224, 224, 3] - the mobile preprocessing assumes it.'
            ))
        if list(out['shape']) != [1, len(labels)]:
            self.stdout.write(self.style.WARNING(
                f'  expected output shape [1, {len(labels)}] to match rice_leaf_labels.json.'
            ))
