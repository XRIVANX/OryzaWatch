import json
from collections import Counter
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

IMAGE_SIZE = (224, 224)
IMAGE_SUFFIXES = {'.jpg', '.jpeg', '.png', '.webp', '.bmp'}
# Canonical order the serving code expects; folder names map onto these.
CANONICAL_LABELS = {'HEALTHY', 'BLB', 'BLAST'}


class Command(BaseCommand):
    help = 'Train the rice leaf classifier from train/ and validation/ folders.'

    def add_arguments(self, parser):
        parser.add_argument('--dataset', default=str(Path(settings.BASE_DIR) / 'datasets' / 'rice_leaf'))
        parser.add_argument('--epochs', type=int, default=8,
                            help='Head-only epochs with the MobileNetV2 base frozen (default 8).')
        parser.add_argument('--fine-tune-epochs', type=int, default=12,
                            help='Extra epochs after unfreezing the top of the base (default 12).')
        parser.add_argument('--fine-tune-at', type=int, default=30,
                            help='Number of trailing base layers to unfreeze for fine-tuning (default 30).')
        parser.add_argument('--batch-size', type=int, default=32)
        parser.add_argument('--seed', type=int, default=42)
        parser.add_argument('--no-augment', action='store_true', help='Disable train-time augmentation.')
        parser.add_argument('--output', default=settings.AI_MODEL_PATH)

    def handle(self, *args, **options):
        try:
            import numpy as np
            import tensorflow as tf
        except ImportError as exc:
            raise CommandError('Install tensorflow-cpu and numpy before training the model.') from exc

        dataset_dir = Path(options['dataset'])
        train_dir = dataset_dir / 'train'
        validation_dir = dataset_dir / 'validation'
        if not train_dir.is_dir() or not validation_dir.is_dir():
            raise CommandError('Dataset must contain train/ and validation/ directories.')

        self._assert_disjoint(train_dir, validation_dir)

        batch_size = options['batch_size']
        seed = options['seed']
        tf.keras.utils.set_random_seed(seed)

        raw_train = tf.keras.utils.image_dataset_from_directory(
            train_dir, image_size=IMAGE_SIZE, batch_size=batch_size, seed=seed, shuffle=True,
        )
        raw_validation = tf.keras.utils.image_dataset_from_directory(
            validation_dir, image_size=IMAGE_SIZE, batch_size=batch_size, shuffle=False,
            class_names=raw_train.class_names,
        )
        folder_names = list(raw_train.class_names)
        class_names = [name.upper().replace('RICE_BLAST', 'BLAST') for name in folder_names]
        if set(class_names) != CANONICAL_LABELS:
            raise CommandError(
                f'Expected exactly healthy, blb, and rice_blast folders; got {folder_names}.'
            )
        self.stdout.write(f'Class index order: {list(enumerate(class_names))}')

        autotune = tf.data.AUTOTUNE
        train = raw_train.prefetch(autotune)
        validation = raw_validation.cache().prefetch(autotune)

        class_weight = self._class_weight(train_dir, folder_names)
        self.stdout.write(f'Class weights: {class_weight}')

        model, base = self._build_model(tf, augment=not options['no_augment'])
        model.compile(
            optimizer=tf.keras.optimizers.Adam(1e-3),
            loss='sparse_categorical_crossentropy',
            metrics=['accuracy'],
        )

        output_path = Path(options['output'])
        output_path.parent.mkdir(parents=True, exist_ok=True)
        labels_path = Path(settings.AI_LABELS_PATH)

        callbacks = [
            tf.keras.callbacks.EarlyStopping(
                monitor='val_accuracy', patience=5, restore_best_weights=True, mode='max',
            ),
            tf.keras.callbacks.ReduceLROnPlateau(
                monitor='val_loss', factor=0.3, patience=2, min_lr=1e-6,
            ),
            tf.keras.callbacks.ModelCheckpoint(
                str(output_path), monitor='val_accuracy', mode='max', save_best_only=True,
            ),
        ]

        self.stdout.write(self.style.MIGRATE_HEADING('Phase 1: training the classifier head (base frozen)'))
        history = model.fit(
            train, validation_data=validation, epochs=options['epochs'],
            class_weight=class_weight, callbacks=callbacks,
        )

        if options['fine_tune_epochs'] > 0 and options['fine_tune_at'] > 0:
            self.stdout.write(self.style.MIGRATE_HEADING(
                f'Phase 2: fine-tuning the top {options["fine_tune_at"]} base layers'
            ))
            base.trainable = True
            for layer in base.layers[:-options['fine_tune_at']]:
                layer.trainable = False
            # BatchNorm statistics must stay frozen when fine-tuning a small dataset.
            for layer in base.layers:
                if isinstance(layer, tf.keras.layers.BatchNormalization):
                    layer.trainable = False
            model.compile(
                optimizer=tf.keras.optimizers.Adam(1e-5),
                loss='sparse_categorical_crossentropy',
                metrics=['accuracy'],
            )
            total_epochs = len(history.epoch) + options['fine_tune_epochs']
            model.fit(
                train, validation_data=validation, epochs=total_epochs,
                initial_epoch=len(history.epoch), class_weight=class_weight, callbacks=callbacks,
            )

        # ModelCheckpoint already saved the best epoch to output_path; reload it so the
        # evaluation below reflects what will actually be served.
        model = tf.keras.models.load_model(output_path)
        labels_path.parent.mkdir(parents=True, exist_ok=True)
        labels_path.write_text(
            json.dumps({str(index): label for index, label in enumerate(class_names)}),
            encoding='utf-8',
        )

        self._report(np, model, validation, class_names)
        self.stdout.write(self.style.SUCCESS(f'Model saved to {output_path}'))
        self.stdout.write(self.style.SUCCESS(f'Labels saved to {labels_path}'))

    # ------------------------------------------------------------------ helpers

    def _assert_disjoint(self, train_dir: Path, validation_dir: Path):
        # Compare per class: augmented images across the dataset reuse generic names
        # like aug_0_14.jpg, so a name in train/blb and validation/blast is fine -
        # what must never happen is the same file in train/X and validation/X.
        def names(folder: Path):
            if not folder.is_dir():
                return set()
            return {
                p.name for p in folder.iterdir()
                if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES
            }

        overlap = set()
        for class_dir in sorted(p for p in train_dir.iterdir() if p.is_dir()):
            overlap |= names(class_dir) & names(validation_dir / class_dir.name)
        if overlap:
            sample = ', '.join(sorted(overlap)[:5])
            raise CommandError(
                f'{len(overlap)} image name(s) appear in the SAME class under both train/ and '
                f'validation/ (e.g. {sample}). Run "manage.py split_dataset" first so validation '
                f'is a genuine held-out set - otherwise val_accuracy is meaningless.'
            )

    def _class_weight(self, train_dir: Path, folder_names):
        counts = Counter()
        for index, folder in enumerate(folder_names):
            counts[index] = sum(
                1 for p in (train_dir / folder).iterdir()
                if p.suffix.lower() in IMAGE_SUFFIXES
            )
        total = sum(counts.values())
        n_classes = len(folder_names)
        return {i: total / (n_classes * counts[i]) for i in range(n_classes)}

    def _build_model(self, tf, augment: bool):
        inputs = tf.keras.Input(shape=(*IMAGE_SIZE, 3))
        x = inputs
        if augment:
            aug = tf.keras.Sequential([
                tf.keras.layers.RandomFlip('horizontal_and_vertical'),
                tf.keras.layers.RandomRotation(0.2),
                tf.keras.layers.RandomZoom(0.2),
                tf.keras.layers.RandomContrast(0.2),
                tf.keras.layers.RandomBrightness(0.2, value_range=(0, 255)),
            ], name='augmentation')
            x = aug(x)
        # image_dataset_from_directory yields raw 0-255 pixels and MobileNetV2 wants
        # [-1, 1]. Rescale inside the graph so serving code feeds plain pixels.
        x = tf.keras.layers.Rescaling(1.0 / 127.5, offset=-1.0)(x)

        base = tf.keras.applications.MobileNetV2(
            input_shape=(*IMAGE_SIZE, 3), include_top=False, weights='imagenet',
        )
        base.trainable = False
        x = base(x, training=False)
        x = tf.keras.layers.GlobalAveragePooling2D()(x)
        x = tf.keras.layers.Dropout(0.2)(x)
        outputs = tf.keras.layers.Dense(3, activation='softmax')(x)
        return tf.keras.Model(inputs, outputs), base

    def _report(self, np, model, validation, class_names):
        n = len(class_names)
        confusion = np.zeros((n, n), dtype=int)
        for images, labels in validation:
            preds = np.argmax(model.predict(images, verbose=0), axis=1)
            for true_label, pred_label in zip(labels.numpy(), preds):
                confusion[int(true_label), int(pred_label)] += 1

        support = confusion.sum(axis=1)
        predicted = confusion.sum(axis=0)
        correct = np.diag(confusion)
        total = confusion.sum()
        accuracy = correct.sum() / total if total else 0.0

        self.stdout.write('')
        self.stdout.write(self.style.MIGRATE_HEADING('Held-out validation report'))
        self.stdout.write(f'  overall accuracy: {accuracy:.4f}  ({int(correct.sum())}/{int(total)})')
        self.stdout.write(f'  {"class":10s} {"precision":>9s} {"recall":>7s} {"f1":>6s} {"support":>8s}')
        for i, name in enumerate(class_names):
            precision = correct[i] / predicted[i] if predicted[i] else 0.0
            recall = correct[i] / support[i] if support[i] else 0.0
            f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
            self.stdout.write(
                f'  {name:10s} {precision:9.3f} {recall:7.3f} {f1:6.3f} {int(support[i]):8d}'
            )
        self.stdout.write('  confusion matrix (rows = true, cols = predicted):')
        header = ' '.join(f'{name[:8]:>8s}' for name in class_names)
        self.stdout.write(f'    {"":10s} {header}')
        for i, name in enumerate(class_names):
            row = ' '.join(f'{int(v):>8d}' for v in confusion[i])
            self.stdout.write(f'    {name:10s} {row}')
