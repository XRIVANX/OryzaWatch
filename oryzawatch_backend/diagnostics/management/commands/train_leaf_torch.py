"""Train the rice leaf classifier with PyTorch (torchvision MobileNetV2).

This is the primary training path; ``train_leaf_model`` (Keras) is kept as a
fallback and as the source model for the mobile TFLite export. Both read the same
``datasets/rice_leaf/{train,validation}`` split produced by ``split_dataset``.

The saved ``rice_leaf.pt`` is a TorchScript module whose graph already does input
normalisation and softmax, so serving code feeds a ``(N, 3, 224, 224)`` tensor of
raw ``[0, 1]`` pixels and gets probabilities back. A companion ``rice_leaf.state.pt``
keeps the raw weights for re-export.
"""

import json
from collections import Counter
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

IMAGE_SIZE = 224
IMAGE_SUFFIXES = {'.jpg', '.jpeg', '.png', '.webp', '.bmp'}
# torchvision.datasets.ImageFolder sorts folder names; map them to serving labels.
FOLDER_TO_LABEL = {'blb': 'BLB', 'healthy': 'HEALTHY', 'rice_blast': 'BLAST'}
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


class Command(BaseCommand):
    help = 'Train the rice leaf classifier with PyTorch (MobileNetV2 transfer learning).'

    def add_arguments(self, parser):
        parser.add_argument('--dataset', default=str(Path(settings.BASE_DIR) / 'datasets' / 'rice_leaf'))
        parser.add_argument('--epochs', type=int, default=8,
                            help='Head-only epochs with the backbone frozen (default 8).')
        parser.add_argument('--fine-tune-epochs', type=int, default=12,
                            help='Epochs after unfreezing the backbone at a low LR (default 12).')
        parser.add_argument('--batch-size', type=int, default=32)
        parser.add_argument('--seed', type=int, default=42)
        parser.add_argument('--workers', type=int, default=0,
                            help='DataLoader worker processes (default 0 - safest on Windows).')
        parser.add_argument('--device', default='auto', choices=['auto', 'cuda', 'cpu'],
                            help='auto uses the GPU when available (default).')
        parser.add_argument('--no-amp', action='store_true',
                            help='Disable mixed precision (only relevant on CUDA).')
        parser.add_argument('--output', default=settings.AI_TORCH_MODEL_PATH)

    def handle(self, *args, **options):
        try:
            import numpy as np
            import torch
            from torch import nn
            from torch.utils.data import DataLoader
            from torchvision import datasets, models, transforms
        except ImportError as exc:
            raise CommandError('Install torch and torchvision before training the PyTorch model.') from exc

        torch.manual_seed(options['seed'])
        np.random.seed(options['seed'])

        if options['device'] == 'cuda' and not torch.cuda.is_available():
            raise CommandError(
                'CUDA requested but torch.cuda.is_available() is False. Install the CUDA build:\n'
                '  uv pip install --python .\\.venv\\Scripts\\python.exe --reinstall torch torchvision '
                '--index-url https://download.pytorch.org/whl/cu128'
            )
        use_cuda = options['device'] != 'cpu' and torch.cuda.is_available()
        device = torch.device('cuda' if use_cuda else 'cpu')
        amp = use_cuda and not options['no_amp']
        if use_cuda:
            torch.backends.cudnn.benchmark = True
            free_b, total_b = torch.cuda.mem_get_info()
            free_mb, total_mb = free_b / 1024**2, total_b / 1024**2
            self.stdout.write(
                f'Device: cuda ({torch.cuda.get_device_name(0)}) - '
                f'{free_mb:.0f} MiB free / {total_mb:.0f} MiB total, amp={amp}'
            )
            if free_mb < 1100:
                raise CommandError(
                    f'Only {free_mb:.0f} MiB of GPU memory free - not enough to train. Close GPU-heavy '
                    f'apps (browsers, Electron) or run with --device cpu.'
                )
            if free_mb < 2200 and options['batch_size'] > 16:
                options['batch_size'] = 16
                self.stdout.write(self.style.WARNING('  low VRAM -> capping --batch-size at 16'))
        else:
            self.stdout.write(f'Device: cpu (torch {torch.__version__})')

        dataset_dir = Path(options['dataset'])
        train_dir = dataset_dir / 'train'
        val_dir = dataset_dir / 'validation'
        if not train_dir.is_dir() or not val_dir.is_dir():
            raise CommandError('Dataset must contain train/ and validation/ directories.')
        self._assert_disjoint(train_dir, val_dir)

        train_tf = transforms.Compose([
            transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
            transforms.RandomHorizontalFlip(),
            transforms.RandomVerticalFlip(),
            transforms.RandomRotation(20),
            transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.05),
            # Field photos are often slightly out of focus or motion-blurred; train
            # on some blurred copies so the classifier doesn't overfit to crisp shots.
            transforms.RandomApply([transforms.GaussianBlur(kernel_size=5, sigma=(0.1, 2.0))], p=0.3),
            transforms.ToTensor(),  # -> float [0, 1], CHW
        ])
        eval_tf = transforms.Compose([
            transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
            transforms.ToTensor(),
        ])
        train_ds = datasets.ImageFolder(str(train_dir), transform=train_tf)
        val_ds = datasets.ImageFolder(str(val_dir), transform=eval_tf)
        if train_ds.classes != val_ds.classes:
            raise CommandError(f'Class folders differ: {train_ds.classes} vs {val_ds.classes}.')
        try:
            class_names = [FOLDER_TO_LABEL[name] for name in train_ds.classes]
        except KeyError as exc:
            raise CommandError(f'Unexpected class folder {exc}; expected {sorted(FOLDER_TO_LABEL)}.')
        self.stdout.write(f'Class index order: {list(enumerate(class_names))}')

        generator = torch.Generator().manual_seed(options['seed'])
        train_loader = DataLoader(
            train_ds, batch_size=options['batch_size'], shuffle=True,
            num_workers=options['workers'], generator=generator, pin_memory=use_cuda,
        )
        val_loader = DataLoader(
            val_ds, batch_size=options['batch_size'], shuffle=False,
            num_workers=options['workers'], pin_memory=use_cuda,
        )

        counts = Counter(label for _, label in train_ds.samples)
        n_classes = len(class_names)
        total = sum(counts.values())
        class_weight = torch.tensor(
            [total / (n_classes * counts[i]) for i in range(n_classes)], dtype=torch.float32
        )
        self.stdout.write(f'Class weights: {class_weight.tolist()}')

        LeafNet, ServingWrapper = _model_classes(torch, nn, models)
        model = LeafNet(n_classes).to(device)
        criterion = nn.CrossEntropyLoss(weight=class_weight.to(device))

        output_path = Path(options['output'])
        output_path.parent.mkdir(parents=True, exist_ok=True)

        scaler = torch.amp.GradScaler('cuda', enabled=amp)
        best_acc = -1.0
        best_state = None

        def run_phase(name, epochs, start_epoch, trainable_backbone, lr):
            nonlocal best_acc, best_state
            for param in model.backbone.features.parameters():
                param.requires_grad = trainable_backbone
            params = [p for p in model.parameters() if p.requires_grad]
            optimizer = torch.optim.Adam(params, lr=lr)
            scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
                optimizer, mode='max', factor=0.3, patience=2, min_lr=1e-6,
            )
            self.stdout.write(self.style.MIGRATE_HEADING(name))
            for epoch in range(start_epoch, start_epoch + epochs):
                model.train()
                running = 0.0
                for images, targets in train_loader:
                    images = images.to(device, non_blocking=True)
                    targets = targets.to(device, non_blocking=True)
                    optimizer.zero_grad()
                    with torch.amp.autocast('cuda', enabled=amp):
                        loss = criterion(model(images), targets)
                    scaler.scale(loss).backward()
                    scaler.step(optimizer)
                    scaler.update()
                    running += loss.item() * images.size(0)
                train_loss = running / len(train_ds)
                val_acc, val_loss = self._evaluate_loss(
                    torch, model, criterion, val_loader, len(val_ds), device, amp
                )
                scheduler.step(val_acc)
                self.stdout.write(
                    f'  epoch {epoch:2d}  train_loss {train_loss:.4f}  '
                    f'val_loss {val_loss:.4f}  val_acc {val_acc:.4f}'
                )
                if val_acc > best_acc:
                    best_acc = val_acc
                    best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}

        try:
            run_phase('Phase 1: training the classifier head (backbone frozen)',
                      options['epochs'], 1, trainable_backbone=False, lr=1e-3)
            if options['fine_tune_epochs'] > 0:
                run_phase('Phase 2: fine-tuning the whole backbone',
                          options['fine_tune_epochs'], options['epochs'] + 1,
                          trainable_backbone=True, lr=1e-5)
        except torch.cuda.OutOfMemoryError as exc:
            torch.cuda.empty_cache()
            raise CommandError(
                f'GPU ran out of memory at batch size {options["batch_size"]}. Retry with a smaller '
                f'--batch-size (e.g. 8) or --device cpu.'
            ) from exc

        if best_state is not None:
            model.load_state_dict(best_state)
        model.to('cpu').eval()  # serving (ai.py) loads on CPU

        # Held-out report on the best weights (run before we drop the GPU copy).
        self._report(np, torch, model, val_loader, class_names, torch.device('cpu'))
        self.stdout.write(f'Best held-out accuracy: {best_acc:.4f}')

        # TorchScript serving artifact: normalises + softmaxes inside the graph.
        # Trace (not script) - the classifier has no data-dependent control flow.
        serving = ServingWrapper(model).eval()
        example = torch.rand(1, 3, IMAGE_SIZE, IMAGE_SIZE)
        with torch.no_grad():
            scripted = torch.jit.trace(serving, example)
        scripted.save(str(output_path))
        torch.save(
            {'state_dict': model.state_dict(), 'classes': class_names,
             'mean': IMAGENET_MEAN, 'std': IMAGENET_STD, 'arch': 'mobilenet_v2'},
            str(output_path.with_suffix('.state.pt')),
        )
        labels_path = Path(settings.AI_LABELS_PATH)
        labels_path.parent.mkdir(parents=True, exist_ok=True)
        labels_path.write_text(
            json.dumps({str(i): name for i, name in enumerate(class_names)}),
            encoding='utf-8',
        )
        self.stdout.write(self.style.SUCCESS(f'TorchScript model saved to {output_path}'))
        self.stdout.write(self.style.SUCCESS(f'Weights saved to {output_path.with_suffix(".state.pt")}'))
        self.stdout.write(self.style.SUCCESS(f'Labels saved to {labels_path}'))

    # ------------------------------------------------------------------ helpers

    def _assert_disjoint(self, train_dir: Path, val_dir: Path):
        def names(folder: Path):
            if not folder.is_dir():
                return set()
            return {
                p.name for p in folder.iterdir()
                if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES
            }

        overlap = set()
        for class_dir in sorted(p for p in train_dir.iterdir() if p.is_dir()):
            overlap |= names(class_dir) & names(val_dir / class_dir.name)
        if overlap:
            sample = ', '.join(sorted(overlap)[:5])
            raise CommandError(
                f'{len(overlap)} image name(s) appear in the SAME class under both train/ and '
                f'validation/ (e.g. {sample}). Run "manage.py split_dataset" first.'
            )

    def _evaluate_loss(self, torch, model, criterion, loader, n, device, amp):
        model.eval()
        correct = 0
        running = 0.0
        with torch.no_grad():
            for images, targets in loader:
                images = images.to(device, non_blocking=True)
                targets = targets.to(device, non_blocking=True)
                with torch.amp.autocast('cuda', enabled=amp):
                    logits = model(images)
                    loss = criterion(logits, targets)
                running += loss.item() * images.size(0)
                correct += (logits.argmax(dim=1) == targets).sum().item()
        return correct / n, running / n

    def _report(self, np, torch, model, loader, class_names, device):
        n = len(class_names)
        confusion = np.zeros((n, n), dtype=int)
        model.eval()
        with torch.no_grad():
            for images, targets in loader:
                images = images.to(device, non_blocking=True)
                preds = model(images).argmax(dim=1).cpu().numpy()
                for true_label, pred_label in zip(targets.numpy(), preds):
                    confusion[int(true_label), int(pred_label)] += 1

        support = confusion.sum(axis=1)
        predicted = confusion.sum(axis=0)
        correct = np.diag(confusion)
        total = confusion.sum()
        accuracy = correct.sum() / total if total else 0.0

        self.stdout.write('')
        self.stdout.write(self.style.MIGRATE_HEADING('Held-out validation report (PyTorch)'))
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


def _model_classes(torch, nn, models):
    """Build the model classes lazily so importing this command never needs torch."""

    class LeafNet(nn.Module):
        """MobileNetV2 with a 3-way head and in-graph ImageNet normalisation."""

        def __init__(self, n_classes: int):
            super().__init__()
            backbone = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.IMAGENET1K_V1)
            backbone.classifier = nn.Sequential(
                nn.Dropout(0.2),
                nn.Linear(backbone.last_channel, n_classes),
            )
            self.backbone = backbone
            self.register_buffer('mean', torch.tensor(IMAGENET_MEAN).view(1, 3, 1, 1))
            self.register_buffer('std', torch.tensor(IMAGENET_STD).view(1, 3, 1, 1))

        def forward(self, x):
            x = (x - self.mean) / self.std
            return self.backbone(x)

    class ServingWrapper(nn.Module):
        """Wraps LeafNet so the scripted graph returns probabilities."""

        def __init__(self, core):
            super().__init__()
            self.core = core
            self.softmax = nn.Softmax(dim=1)

        def forward(self, x):
            return self.softmax(self.core(x))

    return LeafNet, ServingWrapper
