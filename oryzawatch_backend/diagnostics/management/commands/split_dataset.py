"""Carve a real held-out validation split out of the training images.

The shipped dataset had ``validation/`` as a byte-for-byte copy of ``train/``,
which makes every ``val_accuracy`` number meaningless. This command wipes the
duplicated validation images and *moves* a stratified, seeded fraction of the
unique training images into ``validation/`` so the two sets never share a photo.
"""

import hashlib
import random
import shutil
from collections import defaultdict
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

CLASS_DIRS = ('healthy', 'blb', 'rice_blast')
IMAGE_SUFFIXES = {'.jpg', '.jpeg', '.png', '.webp', '.bmp'}


def _images(folder: Path):
    if not folder.is_dir():
        return []
    return sorted(p for p in folder.iterdir() if p.suffix.lower() in IMAGE_SUFFIXES)


class Command(BaseCommand):
    help = 'Move a stratified fraction of train/ images into validation/ (held-out split).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dataset',
            default=str(Path(settings.BASE_DIR) / 'datasets' / 'rice_leaf'),
        )
        parser.add_argument('--ratio', type=float, default=0.15,
                            help='Fraction of each class moved to validation (default 0.15).')
        parser.add_argument('--seed', type=int, default=42)
        parser.add_argument('--dry-run', action='store_true',
                            help='Print what would move without touching any files.')
        parser.add_argument('--force', action='store_true',
                            help='Re-split even if validation already holds non-duplicate images.')

    def handle(self, *args, **options):
        dataset_dir = Path(options['dataset'])
        train_dir = dataset_dir / 'train'
        validation_dir = dataset_dir / 'validation'
        ratio = options['ratio']
        dry_run = options['dry_run']

        if not train_dir.is_dir():
            raise CommandError(f'No train/ directory under {dataset_dir}.')
        if not 0.0 < ratio < 0.9:
            raise CommandError('--ratio must be between 0 and 0.9.')

        exact_dupes = self._content_duplicates(dataset_dir)
        if exact_dupes:
            self.stdout.write(
                f'Exact-duplicate image files (same bytes, different names): {len(exact_dupes)}'
            )
            if not dry_run:
                for path in exact_dupes:
                    path.unlink()
                self.stdout.write(self.style.SUCCESS(f'Deleted {len(exact_dupes)} duplicate files.'))

        rng = random.Random(options['seed'])
        plan = []
        stale_validation = []

        for class_name in CLASS_DIRS:
            train_class = train_dir / class_name
            val_class = validation_dir / class_name
            train_files = _images(train_class)
            val_files = _images(val_class)
            if not train_files:
                raise CommandError(f'train/{class_name}/ has no images.')

            train_names = {p.name for p in train_files}
            duplicates = [p for p in val_files if p.name in train_names]
            genuine = [p for p in val_files if p.name not in train_names]
            stale_validation.extend(duplicates)

            if genuine and not options['force']:
                raise CommandError(
                    f'validation/{class_name}/ already has {len(genuine)} image(s) that are not '
                    f'copies of train/. A real split may already exist - pass --force to redo it.'
                )

            # Only the images that will still be in train/ after we drop the dupes
            # are eligible to move. (Duplicates get deleted, not moved.)
            pool = sorted(train_files, key=lambda p: p.name)
            rng.shuffle(pool)
            move_count = max(1, round(len(pool) * ratio))
            to_move = sorted(pool[:move_count], key=lambda p: p.name)
            plan.append((class_name, train_class, val_class, to_move, len(pool), len(duplicates)))

        self.stdout.write(f'Dataset: {dataset_dir}')
        self.stdout.write(f'Stale (duplicate) validation images to delete: {len(stale_validation)}')
        for class_name, _, _, to_move, pool_size, dup_count in plan:
            remaining = pool_size - len(to_move)
            self.stdout.write(
                f'  {class_name:12s} train {pool_size:4d} -> train {remaining:4d} + '
                f'validation {len(to_move):4d}   (deleting {dup_count} duplicate val images)'
            )

        if dry_run:
            self.stdout.write(self.style.WARNING('Dry run - no files changed.'))
            return

        for path in stale_validation:
            path.unlink()

        moved_total = 0
        for class_name, train_class, val_class, to_move, _, _ in plan:
            val_class.mkdir(parents=True, exist_ok=True)
            for src in to_move:
                dest = val_class / src.name
                if dest.exists():
                    dest.unlink()
                shutil.move(str(src), str(dest))
                moved_total += 1

        self.stdout.write(self.style.SUCCESS(
            f'Moved {moved_total} images into validation/. train/ and validation/ are now disjoint.'
        ))

    def _content_duplicates(self, dataset_dir: Path):
        """Return the redundant copies when the same bytes exist under several names.

        Keeps the first path in sorted order (prefer train/ over validation/) and
        returns every other copy so the caller can delete them.
        """
        by_hash = defaultdict(list)
        for path in sorted(dataset_dir.rglob('*')):
            if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES:
                digest = hashlib.md5(path.read_bytes()).hexdigest()
                by_hash[digest].append(path)
        redundant = []
        for paths in by_hash.values():
            if len(paths) > 1:
                keep = min(paths, key=lambda p: (0 if 'train' in p.parts else 1, str(p)))
                redundant.extend(p for p in paths if p != keep)
        return redundant
