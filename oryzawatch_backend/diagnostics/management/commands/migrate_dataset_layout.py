"""One-time migration of the new train/<Class Name>/{Reality, Masks} dataset layout.

The dataset was reorganised to add pixel-level segmentation masks per disease:

    train/Healthy Rice Leaf/*.jpg
    train/Bacterial Leaf Blight/Reality BLB/*.jpg
    train/Bacterial Leaf Blight/Pixel-Level Segmentation Masks BLB/*.jpg
    train/Rice Blast/Reality Rice Blast/*.jpg
    train/Rice Blast/Pixel-Level Segmentation Masks Rice Blast/*.jpg

``train_leaf_torch``/``train_leaf_model`` use ``ImageFolder``/
``image_dataset_from_directory``, which treat the top-level folder name as the
class label and recurse into every subfolder for images. Left as-is, that layout
either crashes (unexpected class folder names) or - worse - silently feeds
grayscale lesion masks into the classifier as if they were photos.

This command moves the real photos into the flat ``train/{healthy,blb,
rice_blast}/`` folders the rest of the pipeline already expects, and the masks
into a parallel ``masks/{blb,rice_blast}/`` tree (used by ``train_leaf_segmentation``
and ``build_yolo_dataset``), filename-paired with the class photos. It never
touches ``validation/`` or ``_excluded/``.
"""

import hashlib
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

IMAGE_SUFFIXES = {'.jpg', '.jpeg', '.png', '.webp', '.bmp'}

# canonical class -> photo source dir(s) under train/, and mask source dir under
# train/ (None if the class has no lesions to mask, i.e. healthy).
LAYOUT = {
    'healthy': {
        'photo_dirs': ['Healthy Rice Leaf'],
        'mask_dir': None,
    },
    'blb': {
        'photo_dirs': ['Bacterial Leaf Blight/Reality BLB'],
        'mask_dir': 'Bacterial Leaf Blight/Pixel-Level Segmentation Masks BLB',
    },
    'rice_blast': {
        'photo_dirs': ['Rice Blast/Reality Rice Blast'],
        'mask_dir': 'Rice Blast/Pixel-Level Segmentation Masks Rice Blast',
    },
}


class Command(BaseCommand):
    help = (
        'One-time migration of the train/<Class Name>/{Reality, Masks} dataset layout '
        'into flat train/{healthy,blb,rice_blast}/ + masks/{blb,rice_blast}/ trees.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--dataset', default=str(Path(settings.BASE_DIR) / 'datasets' / 'rice_leaf'))
        parser.add_argument('--dry-run', action='store_true',
                            help='Print the move plan without touching any files.')

    def handle(self, *args, **options):
        dataset_dir = Path(options['dataset'])
        train_dir = dataset_dir / 'train'
        masks_dir = dataset_dir / 'masks'
        dry_run = options['dry_run']
        if not train_dir.is_dir():
            raise CommandError(f'No train/ directory under {dataset_dir}.')

        candidates = []  # (kind, class_name, src, dest)
        for class_name, spec in LAYOUT.items():
            dest_photo_dir = train_dir / class_name
            for rel in spec['photo_dirs']:
                src_dir = train_dir / rel
                if src_dir.is_dir():
                    for src in self._images(src_dir):
                        candidates.append(('photo', class_name, src, dest_photo_dir / src.name))
            if spec['mask_dir']:
                src_mask_dir = train_dir / spec['mask_dir']
                dest_mask_dir = masks_dir / class_name
                if src_mask_dir.is_dir():
                    for src in self._images(src_mask_dir):
                        candidates.append(('mask', class_name, src, dest_mask_dir / src.name))

        if not candidates:
            self.stdout.write(self.style.WARNING(
                'Nothing to migrate - no "Reality"/"Pixel-Level Segmentation Masks" '
                'subfolders found under train/. Layout may already be flat.'
            ))
            return

        moves, skipped_dupes = self._resolve_moves(candidates)

        photo_count = sum(1 for k, *_ in moves if k == 'photo')
        mask_count = sum(1 for k, *_ in moves if k == 'mask')
        self.stdout.write(f'Dataset: {dataset_dir}')
        for class_name in LAYOUT:
            p = sum(1 for k, c, *_ in moves if k == 'photo' and c == class_name)
            m = sum(1 for k, c, *_ in moves if k == 'mask' and c == class_name)
            self.stdout.write(f'  {class_name:12s} photos -> train/{class_name:<12s} +{p:5d}   '
                              f'masks -> masks/{class_name:<12s} +{m:5d}')
        self.stdout.write(f'Total: {photo_count} photos, {mask_count} masks.')
        if skipped_dupes:
            self.stdout.write(f'Exact-duplicate files already at destination, skipped: {skipped_dupes}')

        if dry_run:
            self.stdout.write(self.style.WARNING('Dry run - no files changed.'))
            return

        for _kind, _class_name, src, dest in moves:
            dest.parent.mkdir(parents=True, exist_ok=True)
            src.replace(dest)

        self._remove_empty_dirs(train_dir)
        self.stdout.write(self.style.SUCCESS(
            f'Moved {photo_count} photos into train/<class>/ and {mask_count} masks into masks/<class>/.'
        ))

    # ------------------------------------------------------------------ helpers

    def _images(self, folder: Path):
        return sorted(
            p for p in folder.iterdir()
            if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES
        )

    def _same_bytes(self, a: Path, b: Path) -> bool:
        return hashlib.md5(a.read_bytes()).hexdigest() == hashlib.md5(b.read_bytes()).hexdigest()

    def _resolve_moves(self, candidates):
        """Drop exact-duplicate destinations, rename on genuine name clashes."""
        moves = []
        seen_dest = set()
        skipped_dupes = 0
        for kind, class_name, src, dest in candidates:
            if dest.exists() and self._same_bytes(src, dest):
                skipped_dupes += 1
                continue
            final_dest = dest
            suffix_n = 1
            while final_dest in seen_dest or (final_dest.exists() and not self._same_bytes(src, final_dest)):
                final_dest = dest.with_stem(f'{dest.stem}_{suffix_n}')
                suffix_n += 1
            seen_dest.add(final_dest)
            moves.append((kind, class_name, src, final_dest))
        return moves, skipped_dupes

    def _remove_empty_dirs(self, root: Path):
        # Legacy folders (e.g. "Reality BLB") often hold nothing but a .gitkeep
        # placeholder once their real images are moved out; those must be cleared
        # too, or ImageFolder/image_dataset_from_directory will pick the leftover
        # directory up as a spurious, empty class.
        for dirpath in sorted(root.rglob('*'), key=lambda p: len(p.parts), reverse=True):
            if not dirpath.is_dir():
                continue
            entries = list(dirpath.iterdir())
            if entries and all(p.name == '.gitkeep' and p.is_file() for p in entries):
                for gitkeep in entries:
                    gitkeep.unlink()
                entries = []
            if not entries:
                dirpath.rmdir()
