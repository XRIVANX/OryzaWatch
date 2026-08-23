import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Train the rice leaf classifier from train/ and validation/ folders.'

    def add_arguments(self, parser):
        parser.add_argument('--dataset', default=str(Path(settings.BASE_DIR) / 'datasets' / 'rice_leaf'))
        parser.add_argument('--epochs', type=int, default=10)
        parser.add_argument('--output', default=settings.AI_MODEL_PATH)

    def handle(self, *args, **options):
        try:
            import tensorflow as tf
        except ImportError as exc:
            raise CommandError('Install tensorflow-cpu before training the model.') from exc

        dataset_dir = Path(options['dataset'])
        train_dir = dataset_dir / 'train'
        validation_dir = dataset_dir / 'validation'
        if not train_dir.is_dir() or not validation_dir.is_dir():
            raise CommandError('Dataset must contain train/ and validation/ directories.')

        image_size = (224, 224)
        train = tf.keras.utils.image_dataset_from_directory(
            train_dir, image_size=image_size, batch_size=32, seed=42
        )
        validation = tf.keras.utils.image_dataset_from_directory(
            validation_dir, image_size=image_size, batch_size=32, seed=42,
            class_names=train.class_names,
        )
        class_names = [name.upper().replace('RICE_BLAST', 'BLAST') for name in train.class_names]
        if set(class_names) != {'HEALTHY', 'BLB', 'BLAST'}:
            raise CommandError('Expected exactly healthy, blb, and rice_blast classes.')

        base = tf.keras.applications.MobileNetV2(
            input_shape=(*image_size, 3), include_top=False, weights='imagenet'
        )
        base.trainable = False
        inputs = tf.keras.Input(shape=(*image_size, 3))
        features = base(inputs, training=False)
        features = tf.keras.layers.GlobalAveragePooling2D()(features)
        outputs = tf.keras.layers.Dense(3, activation='softmax')(features)
        model = tf.keras.Model(inputs, outputs)
        model.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])
        model.fit(train, validation_data=validation, epochs=options['epochs'])

        output_path = Path(options['output'])
        output_path.parent.mkdir(parents=True, exist_ok=True)
        model.save(output_path)
        labels_path = Path(settings.AI_LABELS_PATH)
        labels_path.parent.mkdir(parents=True, exist_ok=True)
        labels_path.write_text(
            json.dumps({str(index): label for index, label in enumerate(class_names)}),
            encoding='utf-8',
        )
        self.stdout.write(self.style.SUCCESS(f'Model saved to {output_path}'))
