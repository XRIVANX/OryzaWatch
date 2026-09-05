"""Derive a YOLO-format lesion-detection dataset from the pixel-level masks.

There are no hand-drawn bounding boxes in this dataset, only per-pixel lesion
masks. This command finds each connected blob in a mask (``scipy.ndimage.label``),
drops blobs too small to be a real lesion (JPEG compression noise around mask
edges), and emits one YOLO box per remaining blob. Healthy photos are copied in
as negative examples - no label file, so YOLO also learns what "nothing to
detect" looks like.

Output layout (standard Ultralytics):

    datasets/rice_leaf_yolo/images/{train,val}/*.jpg
    datasets/rice_leaf_yolo/labels/{train,val}/*.txt
    datasets/rice_leaf_yolo/data.yaml
"""

import shutil
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from ._dataset_layout import collect_pairs, stratified_split

MIN_BLOB_AREA_RATIO = 0.0015  # drop connected components smaller than this fraction of the mask area
CLASS_IDS = {'blb': 0, 'rice_blast': 1}
CLASS_NAMES = ['blb_lesion', 'blast_lesion']


class Command(BaseCommand):
    help = 'Build a YOLO-format lesion-detection dataset from the pixel-level segmentation masks.'

    def add_arguments(self, parser):
        parser.add_argument('--dataset', default=str(Path(settings.BASE_DIR) / 'datasets' / 'rice_leaf'))
        parser.add_argument('--output', default=str(Path(settings.BASE_DIR) / 'datasets' / 'rice_leaf_yolo'))
        parser.add_argument('--val-ratio', type=float, default=0.15)
        parser.add_argument('--seed', type=int, default=42)
        parser.add_argument('--min-area-ratio', type=float, default=MIN_BLOB_AREA_RATIO,
                            help='Connected components smaller than this fraction of the image are dropped as noise.')
        parser.add_argument('--no-healthy', dest='include_healthy', action='store_false', default=True,
                            help='Exclude healthy photos as negative (no-lesion) examples.')

    def handle(self, *args, **options):
        try:
            import numpy as np
            from PIL import Image
            from scipy import ndimage
        except ImportError as exc:
            raise CommandError('Install scipy and Pillow before building the YOLO dataset.') from exc

        dataset_dir = Path(options['dataset'])
        output_dir = Path(options['output'])
        pairs = collect_pairs(dataset_dir, include_healthy=options['include_healthy'])
        if not pairs:
            raise CommandError(
                f'No image/mask pairs found under {dataset_dir}. Run '
                '"manage.py migrate_dataset_layout" first.'
            )
        train_pairs, val_pairs = stratified_split(pairs, options['val_ratio'], options['seed'])

        for sub in ('images/train', 'images/val', 'labels/train', 'labels/val'):
            (output_dir / sub).mkdir(parents=True, exist_ok=True)

        total_boxes = 0
        images_with_boxes = 0
        for split_name, split_pairs in (('train', train_pairs), ('val', val_pairs)):
            for pair in split_pairs:
                boxes = self._boxes_for(np, ndimage, Image, pair, options['min_area_ratio'])
                dest_image = output_dir / 'images' / split_name / pair.image_path.name
                shutil.copy2(pair.image_path, dest_image)
                if boxes:
                    label_path = (
                        output_dir / 'labels' / split_name / pair.image_path.name
                    ).with_suffix('.txt')
                    label_path.write_text(
                        '\n'.join(
                            f'{cls} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}' for cls, cx, cy, w, h in boxes
                        ) + '\n',
                        encoding='utf-8',
                    )
                    total_boxes += len(boxes)
                    images_with_boxes += 1

        data_yaml = output_dir / 'data.yaml'
        names_block = '\n'.join(f'  {i}: {name}' for i, name in enumerate(CLASS_NAMES))
        data_yaml.write_text(
            f'path: {output_dir.resolve().as_posix()}\n'
            f'train: images/train\n'
            f'val: images/val\n'
            f'nc: {len(CLASS_NAMES)}\n'
            f'names:\n{names_block}\n',
            encoding='utf-8',
        )
        self.stdout.write(self.style.SUCCESS(
            f'Wrote {len(train_pairs)} train / {len(val_pairs)} val images '
            f'({images_with_boxes} with lesion boxes, {total_boxes} boxes total) and {data_yaml}'
        ))

    def _boxes_for(self, np, ndimage, Image, pair, min_area_ratio):
        if pair.mask_path is None:
            return []
        class_id = CLASS_IDS[pair.class_name]
        with Image.open(pair.mask_path) as mask_img:
            mask = np.asarray(mask_img.convert('L'), dtype=np.uint8)
        binary = mask > 127
        height, width = binary.shape
        min_area = min_area_ratio * height * width
        labeled, n_components = ndimage.label(binary)
        boxes = []
        for component_id in range(1, n_components + 1):
            ys, xs = np.where(labeled == component_id)
            if ys.size < min_area:
                continue
            x_min, x_max = int(xs.min()), int(xs.max())
            y_min, y_max = int(ys.min()), int(ys.max())
            cx = (x_min + x_max + 1) / 2.0 / width
            cy = (y_min + y_max + 1) / 2.0 / height
            box_w = (x_max - x_min + 1) / width
            box_h = (y_max - y_min + 1) / height
            boxes.append((class_id, cx, cy, box_w, box_h))
        return boxes
