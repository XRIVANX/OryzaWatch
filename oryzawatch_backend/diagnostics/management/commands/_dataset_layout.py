"""Shared helpers for reading the flat dataset layout produced by
``migrate_dataset_layout``:

    datasets/rice_leaf/train/{healthy,blb,rice_blast}/*.jpg
    datasets/rice_leaf/masks/{blb,rice_blast}/*.jpg      (filename-paired with train/)

Used by ``train_leaf_segmentation`` and ``build_yolo_dataset`` - anything that
needs image+mask pairs rather than the plain classification folders that
``train_leaf_torch``/``train_leaf_model`` read directly.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from pathlib import Path

IMAGE_SUFFIXES = {'.jpg', '.jpeg', '.png', '.webp', '.bmp'}
LESION_CLASSES = ('blb', 'rice_blast')  # classes with segmentation masks / lesions
ALL_CLASSES = ('healthy', 'blb', 'rice_blast')


@dataclass(frozen=True)
class ImageMaskPair:
    class_name: str
    image_path: Path
    mask_path: Path | None  # None => no lesion (healthy) - treat as an all-zero mask


def list_images(folder: Path) -> list[Path]:
    if not folder.is_dir():
        return []
    return sorted(p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES)


def collect_pairs(dataset_dir: Path, include_healthy: bool = True) -> list[ImageMaskPair]:
    """Pair every masked lesion photo with its mask (by filename), plus - unless
    disabled - every healthy photo with a synthetic empty mask, so a segmentation
    model also sees "no lesion" examples."""
    train_dir = dataset_dir / 'train'
    masks_dir = dataset_dir / 'masks'
    pairs: list[ImageMaskPair] = []
    for class_name in LESION_CLASSES:
        images_by_name = {p.name: p for p in list_images(train_dir / class_name)}
        for mask_path in list_images(masks_dir / class_name):
            image_path = images_by_name.get(mask_path.name)
            if image_path is not None:
                pairs.append(ImageMaskPair(class_name, image_path, mask_path))
    if include_healthy:
        for image_path in list_images(train_dir / 'healthy'):
            pairs.append(ImageMaskPair('healthy', image_path, None))
    return pairs


def stratified_split(
    pairs: list[ImageMaskPair], val_ratio: float, seed: int
) -> tuple[list[ImageMaskPair], list[ImageMaskPair]]:
    """Seeded, per-class shuffle/split. Independent of the classifier's
    train/validation folders - mask coverage differs per class."""
    rng = random.Random(seed)
    by_class: dict[str, list[ImageMaskPair]] = {}
    for pair in pairs:
        by_class.setdefault(pair.class_name, []).append(pair)

    train_pairs: list[ImageMaskPair] = []
    val_pairs: list[ImageMaskPair] = []
    for items in by_class.values():
        items = sorted(items, key=lambda p: p.image_path.name)
        rng.shuffle(items)
        n_val = max(1, round(len(items) * val_ratio)) if len(items) > 1 else 0
        val_pairs.extend(items[:n_val])
        train_pairs.extend(items[n_val:])
    return train_pairs, val_pairs
