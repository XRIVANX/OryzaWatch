"""
Build the "is this really a rice leaf?" check that runs before the classifier
(see diagnostics/leaf_gate.py):

    ../.venv/Scripts/python.exe manage.py build_leaf_gate
    ../.venv/Scripts/python.exe manage.py build_leaf_gate --negatives path/to/non_rice_photos

Embeds every training photo with a generic ImageNet MobileNetV2, saves those
embeddings plus a TorchScript copy of the extractor to ai_models/, then scores
the validation photos, and optionally a folder of non-rice photos, to show how
the threshold behaves. Re-run it whenever the rice_leaf training set changes.
"""
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

IMAGE_SUFFIXES = {'.jpg', '.jpeg', '.png', '.webp', '.bmp'}


def _images(folder):
    return sorted(p for p in Path(folder).rglob('*') if p.suffix.lower() in IMAGE_SUFFIXES)


class Command(BaseCommand):
    help = 'Build the rice-leaf check (generic image features + nearest training photos) used before diagnosis.'

    def add_arguments(self, parser):
        parser.add_argument('--dataset', default=str(Path(settings.BASE_DIR) / 'datasets' / 'rice_leaf'),
                            help='Dataset root with train/ and validation/ (default datasets/rice_leaf).')
        parser.add_argument('--negatives', help='Optional folder of non-rice photos to report false accepts on.')
        parser.add_argument('--threshold', type=float, default=None,
                            help='Similarity cut-off (default 0.70, see diagnostics/leaf_gate.py).')
        parser.add_argument('--device', default='auto', choices=['auto', 'cpu', 'cuda'])
        parser.add_argument('--batch-size', type=int, default=64)

    def handle(self, *args, **options):
        try:
            import numpy as np
            import torch
            from PIL import Image
            from torch import nn
            from torchvision import models
        except ImportError as exc:
            raise CommandError(f'PyTorch runtime missing ({exc}).')

        from diagnostics import leaf_gate

        dataset = Path(options['dataset'])
        train_images = _images(dataset / 'train')
        val_images = _images(dataset / 'validation')
        if not train_images:
            raise CommandError(f'No training images under {dataset / "train"}.')

        device = options['device']
        if device == 'auto':
            device = 'cuda' if torch.cuda.is_available() else 'cpu'
        threshold = options['threshold'] if options['threshold'] is not None else leaf_gate.DEFAULT_THRESHOLD

        class GenericEmbedder(nn.Module):
            """ImageNet MobileNetV2 features -> 1280-d pooled embedding. Takes
            (N, 3, 224, 224) in [0, 1]; normalises inside the graph."""

            def __init__(self):
                super().__init__()
                weights = models.MobileNet_V2_Weights.IMAGENET1K_V1
                self.features = models.mobilenet_v2(weights=weights).features
                self.register_buffer('mean', torch.tensor(leaf_gate.IMAGENET_MEAN).view(1, 3, 1, 1))
                self.register_buffer('std', torch.tensor(leaf_gate.IMAGENET_STD).view(1, 3, 1, 1))

            def forward(self, x):
                x = self.features((x - self.mean) / self.std)
                return nn.functional.adaptive_avg_pool2d(x, 1).flatten(1)

        embedder = GenericEmbedder().eval().to(device)

        def embed(paths):
            out = []
            batch_size = options['batch_size']
            for start in range(0, len(paths), batch_size):
                tensors = []
                for path in paths[start:start + batch_size]:
                    with Image.open(path) as source:
                        tensors.append(leaf_gate.image_tensor(source))
                with torch.no_grad():
                    out.append(embedder(torch.cat(tensors).to(device)).cpu().numpy())
            return np.concatenate(out) if out else np.zeros((0, 1280), dtype='float32')

        self.stdout.write(f'Embedding {len(train_images)} training photos on {device}...')
        reference = embed(train_images)
        reference /= np.clip(np.linalg.norm(reference, axis=1, keepdims=True), 1e-12, None)

        def scores(paths):
            return np.array([leaf_gate.top_k_similarity(e, reference) for e in embed(paths)])

        stats = {}
        if val_images:
            val = scores(val_images)
            rejected = int((val < threshold).sum())
            stats.update(val_min=float(val.min()), val_q001=float(np.quantile(val, 0.001)))
            self.stdout.write(
                f'Validation ({len(val)}): lowest {val.min():.3f}, 0.1% quantile {stats["val_q001"]:.3f}, '
                f'rejected at {threshold:.2f}: {rejected}'
            )
            if rejected > 0.01 * len(val):
                self.stdout.write(self.style.WARNING(
                    'More than 1% of genuine validation photos would be rejected. Lower --threshold.'
                ))
        if options['negatives']:
            negatives = _images(options['negatives'])
            if negatives:
                neg = scores(negatives)
                accepted = int((neg >= threshold).sum())
                stats.update(neg_max=float(neg.max()), neg_count=len(neg))
                self.stdout.write(
                    f'Non-rice photos ({len(neg)}): highest {neg.max():.3f}, accepted at {threshold:.2f}: {accepted}'
                )

        model_path, reference_path = leaf_gate.gate_paths()
        model_path.parent.mkdir(parents=True, exist_ok=True)
        embedder_cpu = embedder.to('cpu').eval()
        with torch.no_grad():
            traced = torch.jit.trace(embedder_cpu, torch.zeros(1, 3, *leaf_gate.INPUT_SIZE))
        traced.save(str(model_path))
        np.savez_compressed(
            reference_path,
            reference=reference.astype('float16'),
            threshold=np.float32(threshold),
            neighbours=np.int32(leaf_gate.NEIGHBOURS),
            train_count=np.int32(len(train_images)),
            **{key: np.float32(value) for key, value in stats.items()},
        )
        leaf_gate.reset_cache()
        self.stdout.write(self.style.SUCCESS(f'Saved {model_path.name} and {reference_path.name} to {model_path.parent}'))
