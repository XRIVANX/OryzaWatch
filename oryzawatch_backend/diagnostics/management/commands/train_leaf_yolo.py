"""Train a YOLO lesion-detection model on the dataset built by
``build_yolo_dataset``.

Thin wrapper around ``ultralytics``: fine-tuning a COCO-pretrained ``yolov8n.pt``
on our 2-class (blb_lesion, blast_lesion) dataset is itself transfer learning,
extending the same pattern as the classifier and segmentation model.
"""

import shutil
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Train a YOLO lesion-detection model (ultralytics, transfer learning from COCO weights).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--data',
            default=str(Path(settings.BASE_DIR) / 'datasets' / 'rice_leaf_yolo' / 'data.yaml'),
        )
        parser.add_argument('--epochs', type=int, default=50)
        parser.add_argument('--imgsz', type=int, default=224)
        parser.add_argument('--batch-size', type=int, default=16)
        parser.add_argument('--model', default='yolov8n.pt', help='Pretrained checkpoint to fine-tune from.')
        parser.add_argument('--device', default=None,
                            help='Ultralytics device string, e.g. "0" or "cpu". Default: auto-detect.')
        parser.add_argument('--output', default=settings.AI_YOLO_MODEL_PATH)

    def handle(self, *args, **options):
        try:
            from ultralytics import YOLO
        except ImportError as exc:
            raise CommandError(
                'Install ultralytics: uv pip install --python .\\.venv\\Scripts\\python.exe ultralytics'
            ) from exc

        data_yaml = Path(options['data'])
        if not data_yaml.is_file():
            raise CommandError(f'{data_yaml} not found. Run "manage.py build_yolo_dataset" first.')

        model = YOLO(options['model'])
        train_kwargs = dict(
            data=str(data_yaml),
            epochs=options['epochs'],
            imgsz=options['imgsz'],
            batch=options['batch_size'],
            seed=42,
            project=str(Path(settings.BASE_DIR) / 'runs'),
            name='rice_leaf_yolo',
        )
        if options['device']:
            train_kwargs['device'] = options['device']

        self.stdout.write(self.style.MIGRATE_HEADING(f'Fine-tuning {options["model"]} on {data_yaml}'))
        model.train(**train_kwargs)

        best = Path(model.trainer.save_dir) / 'weights' / 'best.pt'
        if not best.is_file():
            raise CommandError(f'Training finished but {best} was not produced.')

        output_path = Path(options['output'])
        output_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(best, output_path)
        self.stdout.write(self.style.SUCCESS(f'Copied best weights to {output_path}'))
