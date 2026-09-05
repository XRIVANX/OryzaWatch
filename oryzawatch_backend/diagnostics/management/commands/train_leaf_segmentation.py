"""Train a standalone lesion-segmentation model (PyTorch, U-Net w/ MobileNetV2
transfer-learning encoder) from the pixel-level masks paired with
``train/{blb,rice_blast}/`` photos by ``migrate_dataset_layout``.

Unlike the classifier, this reads its own train/val split (``--val-ratio``)
instead of the shared ``validation/`` folder, since mask coverage differs per
class. Healthy photos are included with a synthetic all-zero mask so the model
also learns what "no lesion" looks like, instead of only ever seeing diseased
leaves.

The saved ``rice_leaf_segmentation.pt`` is a TorchScript module that already
applies sigmoid, so serving code feeds a ``(N, 3, 224, 224)`` tensor of raw
``[0, 1]`` pixels and gets a ``(N, 1, 224, 224)`` lesion-probability mask back.
"""

from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from ._dataset_layout import collect_pairs, stratified_split

IMAGE_SIZE = 224
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


class Command(BaseCommand):
    help = 'Train a lesion-segmentation model (U-Net, MobileNetV2 encoder transfer learning).'

    def add_arguments(self, parser):
        parser.add_argument('--dataset', default=str(Path(settings.BASE_DIR) / 'datasets' / 'rice_leaf'))
        parser.add_argument('--epochs', type=int, default=10,
                            help='Decoder-only epochs with the encoder frozen (default 10).')
        parser.add_argument('--fine-tune-epochs', type=int, default=10,
                            help='Epochs after unfreezing the encoder at a low LR (default 10).')
        parser.add_argument('--batch-size', type=int, default=16)
        parser.add_argument('--val-ratio', type=float, default=0.15)
        parser.add_argument('--seed', type=int, default=42)
        parser.add_argument('--workers', type=int, default=0,
                            help='DataLoader worker processes (default 0 - safest on Windows).')
        parser.add_argument('--device', default='auto', choices=['auto', 'cuda', 'cpu'])
        parser.add_argument('--no-amp', action='store_true')
        parser.add_argument('--output', default=settings.AI_SEGMENTATION_MODEL_PATH)

    def handle(self, *args, **options):
        try:
            import numpy as np
            import torch
            from torch import nn
            from torch.utils.data import DataLoader
        except ImportError as exc:
            raise CommandError('Install torch and torchvision before training.') from exc
        try:
            import segmentation_models_pytorch as smp
        except ImportError as exc:
            raise CommandError(
                'Install segmentation-models-pytorch: uv pip install --python '
                '.\\.venv\\Scripts\\python.exe segmentation-models-pytorch'
            ) from exc

        torch.manual_seed(options['seed'])
        np.random.seed(options['seed'])

        dataset_dir = Path(options['dataset'])
        pairs = collect_pairs(dataset_dir, include_healthy=True)
        if not pairs:
            raise CommandError(
                f'No image/mask pairs found under {dataset_dir}. Run '
                '"manage.py migrate_dataset_layout" first.'
            )
        train_pairs, val_pairs = stratified_split(pairs, options['val_ratio'], options['seed'])
        n_masked = sum(1 for p in pairs if p.mask_path is not None)
        self.stdout.write(
            f'Pairs: {len(train_pairs)} train, {len(val_pairs)} val '
            f'({n_masked} with a real mask, {len(pairs) - n_masked} healthy/empty)'
        )

        device = self._resolve_device(torch, options)
        amp = device.type == 'cuda' and not options['no_amp']

        LeafSegDataset = _dataset_class(torch)
        train_ds = LeafSegDataset(train_pairs, IMAGE_SIZE, augment=True)
        val_ds = LeafSegDataset(val_pairs, IMAGE_SIZE, augment=False)
        train_loader = DataLoader(
            train_ds, batch_size=options['batch_size'], shuffle=True,
            num_workers=options['workers'], pin_memory=device.type == 'cuda',
        )
        val_loader = DataLoader(
            val_ds, batch_size=options['batch_size'], shuffle=False,
            num_workers=options['workers'], pin_memory=device.type == 'cuda',
        )

        unet = smp.Unet(encoder_name='mobilenet_v2', encoder_weights='imagenet', in_channels=3, classes=1)
        model = _NormalizedUnet(nn, torch, unet, IMAGENET_MEAN, IMAGENET_STD).to(device)

        def dice_bce_loss(logits, targets):
            bce = nn.functional.binary_cross_entropy_with_logits(logits, targets)
            probs = torch.sigmoid(logits)
            intersection = (probs * targets).sum(dim=(1, 2, 3))
            union = probs.sum(dim=(1, 2, 3)) + targets.sum(dim=(1, 2, 3))
            dice_loss = 1.0 - ((2.0 * intersection + 1.0) / (union + 1.0)).mean()
            return bce + dice_loss

        output_path = Path(options['output'])
        output_path.parent.mkdir(parents=True, exist_ok=True)
        scaler = torch.amp.GradScaler('cuda', enabled=amp)
        best_iou = -1.0
        best_state = None

        def run_phase(name, epochs, start_epoch, trainable_encoder, lr):
            nonlocal best_iou, best_state
            for param in model.unet.encoder.parameters():
                param.requires_grad = trainable_encoder
            params = [p for p in model.parameters() if p.requires_grad]
            optimizer = torch.optim.Adam(params, lr=lr)
            self.stdout.write(self.style.MIGRATE_HEADING(name))
            for epoch in range(start_epoch, start_epoch + epochs):
                model.train()
                running = 0.0
                for images, masks in train_loader:
                    images = images.to(device, non_blocking=True)
                    masks = masks.to(device, non_blocking=True)
                    optimizer.zero_grad()
                    with torch.amp.autocast('cuda', enabled=amp):
                        loss = dice_bce_loss(model(images), masks)
                    scaler.scale(loss).backward()
                    scaler.step(optimizer)
                    scaler.update()
                    running += loss.item() * images.size(0)
                train_loss = running / max(len(train_ds), 1)
                val_iou, val_dice, val_loss = self._evaluate(
                    torch, model, dice_bce_loss, val_loader, len(val_ds), device, amp
                )
                self.stdout.write(
                    f'  epoch {epoch:2d}  train_loss {train_loss:.4f}  val_loss {val_loss:.4f}  '
                    f'val_iou {val_iou:.4f}  val_dice {val_dice:.4f}'
                )
                if val_iou > best_iou:
                    best_iou = val_iou
                    best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}

        try:
            run_phase('Phase 1: training the decoder (encoder frozen)',
                      options['epochs'], 1, trainable_encoder=False, lr=1e-3)
            if options['fine_tune_epochs'] > 0:
                run_phase('Phase 2: fine-tuning the whole network',
                          options['fine_tune_epochs'], options['epochs'] + 1,
                          trainable_encoder=True, lr=1e-5)
        except torch.cuda.OutOfMemoryError as exc:
            torch.cuda.empty_cache()
            raise CommandError(
                f'GPU ran out of memory at batch size {options["batch_size"]}. Retry with a smaller '
                f'--batch-size (e.g. 8) or --device cpu.'
            ) from exc

        if best_state is not None:
            model.load_state_dict(best_state)
        model.to('cpu').eval()
        self.stdout.write(self.style.SUCCESS(f'Best held-out IoU: {best_iou:.4f}'))

        serving = _ServingWrapper(nn, torch, model).eval()
        example = torch.rand(1, 3, IMAGE_SIZE, IMAGE_SIZE)
        with torch.no_grad():
            scripted = torch.jit.trace(serving, example)
        scripted.save(str(output_path))
        self.stdout.write(self.style.SUCCESS(f'TorchScript segmentation model saved to {output_path}'))

    # ------------------------------------------------------------------ helpers

    def _resolve_device(self, torch, options):
        if options['device'] == 'cuda' and not torch.cuda.is_available():
            raise CommandError('CUDA requested but torch.cuda.is_available() is False.')
        use_cuda = options['device'] != 'cpu' and torch.cuda.is_available()
        device = torch.device('cuda' if use_cuda else 'cpu')
        if use_cuda:
            torch.backends.cudnn.benchmark = True
            free_b, total_b = torch.cuda.mem_get_info()
            self.stdout.write(
                f'Device: cuda ({torch.cuda.get_device_name(0)}) - '
                f'{free_b / 1024**2:.0f} MiB free / {total_b / 1024**2:.0f} MiB total'
            )
        else:
            self.stdout.write(f'Device: cpu (torch {torch.__version__})')
        return device

    def _evaluate(self, torch, model, loss_fn, loader, n, device, amp):
        model.eval()
        running_loss = 0.0
        iou_sum = 0.0
        dice_sum = 0.0
        count = 0
        with torch.no_grad():
            for images, masks in loader:
                images = images.to(device, non_blocking=True)
                masks = masks.to(device, non_blocking=True)
                with torch.amp.autocast('cuda', enabled=amp):
                    logits = model(images)
                    loss = loss_fn(logits, masks)
                running_loss += loss.item() * images.size(0)
                preds = (torch.sigmoid(logits) > 0.5).float()
                inter = (preds * masks).sum(dim=(1, 2, 3))
                pred_sum = preds.sum(dim=(1, 2, 3))
                mask_sum = masks.sum(dim=(1, 2, 3))
                union = pred_sum + mask_sum - inter
                # A correctly-predicted all-background image (healthy leaf) has
                # union == 0 - that's a perfect match, not an undefined 0/0.
                iou = torch.where(union > 0, inter / union, torch.ones_like(union))
                dice = torch.where(
                    (pred_sum + mask_sum) > 0,
                    2.0 * inter / (pred_sum + mask_sum).clamp(min=1e-8),
                    torch.ones_like(union),
                )
                iou_sum += iou.sum().item()
                dice_sum += dice.sum().item()
                count += images.size(0)
        val_iou = iou_sum / count if count else 0.0
        val_dice = dice_sum / count if count else 0.0
        return val_iou, val_dice, running_loss / max(n, 1)


def _NormalizedUnet(nn, torch, unet, mean, std):
    class NormalizedUnet(nn.Module):
        """Wraps smp.Unet with in-graph ImageNet normalisation, matching the encoder's
        pretraining and keeping serving code's raw-[0,1]-pixel contract consistent
        with the classifier."""

        def __init__(self):
            super().__init__()
            self.unet = unet
            self.register_buffer('mean', torch.tensor(mean).view(1, 3, 1, 1))
            self.register_buffer('std', torch.tensor(std).view(1, 3, 1, 1))

        def forward(self, x):
            x = (x - self.mean) / self.std
            return self.unet(x)

    return NormalizedUnet()


def _ServingWrapper(nn, torch, core):
    class ServingWrapper(nn.Module):
        def __init__(self):
            super().__init__()
            self.core = core

        def forward(self, x):
            return torch.sigmoid(self.core(x))

    return ServingWrapper()


def _dataset_class(torch):
    """Build the paired image/mask Dataset class lazily so importing this command
    never needs torch or Pillow."""
    import random

    import numpy as np
    from torch.utils.data import Dataset

    class LeafSegDataset(Dataset):
        def __init__(self, pairs, image_size, augment):
            self.pairs = pairs
            self.image_size = image_size
            self.augment = augment

        def __len__(self):
            return len(self.pairs)

        def __getitem__(self, idx):
            from PIL import Image, ImageFilter

            pair = self.pairs[idx]
            image = Image.open(pair.image_path).convert('RGB').resize(
                (self.image_size, self.image_size), Image.BILINEAR
            )
            if pair.mask_path is not None:
                mask = Image.open(pair.mask_path).convert('L').resize(
                    (self.image_size, self.image_size), Image.NEAREST
                )
            else:
                mask = Image.new('L', (self.image_size, self.image_size), 0)

            if self.augment:
                if random.random() < 0.5:
                    image = image.transpose(Image.FLIP_LEFT_RIGHT)
                    mask = mask.transpose(Image.FLIP_LEFT_RIGHT)
                if random.random() < 0.5:
                    image = image.transpose(Image.FLIP_TOP_BOTTOM)
                    mask = mask.transpose(Image.FLIP_TOP_BOTTOM)
                angle = random.uniform(-20, 20)
                image = image.rotate(angle, resample=Image.BILINEAR, fillcolor=(0, 0, 0))
                mask = mask.rotate(angle, resample=Image.NEAREST, fillcolor=0)
                if random.random() < 0.3:
                    image = image.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.3, 1.5)))

            image_arr = np.asarray(image, dtype=np.float32) / 255.0
            mask_arr = (np.asarray(mask, dtype=np.float32) > 127).astype(np.float32)
            image_tensor = torch.from_numpy(np.ascontiguousarray(image_arr.transpose(2, 0, 1)))
            mask_tensor = torch.from_numpy(mask_arr).unsqueeze(0)
            return image_tensor, mask_tensor

    return LeafSegDataset
