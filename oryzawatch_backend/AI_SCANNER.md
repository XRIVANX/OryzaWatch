# Rice disease AI scanner

Recognizes three classes: `HEALTHY`, `BLB` (bacterial leaf blight), `BLAST` (rice blast).
The upload endpoint only saves a scan after inference succeeds, so an untrained or
missing model can never silently report a healthy leaf. Three optional add-ons -
lesion segmentation (severity), lesion detection (YOLO), and a Grad-CAM
explainability overlay - enrich the same response but are individually
best-effort: a scan still succeeds with just the core classification if any of
them isn't trained yet.

## Architecture (hybrid)

| Where | Framework | Artifact | Trained by |
|---|---|---|---|
| Django backend (authoritative classifier) | **PyTorch** (primary) | `ai_models/rice_leaf.pt` (TorchScript) | `train_leaf_torch` |
| Django backend (fallback classifier) | Keras / TF | `ai_models/rice_leaf.keras` | `train_leaf_model` |
| Mobile app (offline estimate) | TensorFlow Lite | `ai_models/rice_leaf.tflite` -> bundled in the RN app | `export_tflite` (from the Keras model) |
| Django backend (severity, optional) | PyTorch (U-Net) | `ai_models/rice_leaf_segmentation.pt` (TorchScript) | `train_leaf_segmentation` |
| Django backend (lesion boxes, optional) | PyTorch (YOLO) | `ai_models/rice_leaf_lesions.pt` | `build_yolo_dataset` + `train_leaf_yolo` |
| Django backend (explainability, optional) | PyTorch (Grad-CAM) | reuses `rice_leaf.state.pt` - no separate artifact | `train_leaf_torch` |

`diagnostics/ai.py` loads `rice_leaf.pt` when present and only falls back to
`rice_leaf.keras` if the PyTorch model is missing or fails to load. All three
classification artifacts are MobileNetV2 transfer-learning models trained on the
same `datasets/rice_leaf` split and share `rice_leaf_labels.json`
(`{"0": "BLB", "1": "HEALTHY", "2": "BLAST"}`). The segmentation model and the
YOLO detector are separate, additive models - the classifier keeps working
identically whether or not either has been trained.

## 0. Environment

Torch, torchvision, TensorFlow, Keras and NumPy live in the **repo-root** virtualenv
`../.venv/` (uv-managed), not in `oryzawatch_backend/env/`. Run every command with it:

```powershell
..\.venv\Scripts\python.exe manage.py <command>
```

Install / update the runtime from the repo root:

```powershell
uv pip install --python .\.venv\Scripts\python.exe -r oryzawatch_backend\requirements.txt
# CPU-only torch:
uv pip install --python .\.venv\Scripts\python.exe torch torchvision --index-url https://download.pytorch.org/whl/cpu
# ...or NVIDIA GPU (CUDA 12.x driver): far faster training. Pick the cuXXX matching your driver.
uv pip install --python .\.venv\Scripts\python.exe --reinstall torch torchvision --index-url https://download.pytorch.org/whl/cu128
```

`requirements.txt` also pulls in `segmentation-models-pytorch` (U-Net + pretrained
encoders, for step 6), `scipy` (mask -> bounding-box derivation, for step 7), and
`ultralytics` (YOLO, for step 7).

`train_leaf_torch` auto-detects the GPU (`--device auto`, the default) and uses mixed
precision on CUDA. On a small (<=4 GB) GPU close browsers/Electron apps first - it needs
~2 GB free and caps the batch size automatically when VRAM is tight. `--device cpu` forces
CPU; `--batch-size 8` if the GPU still OOMs. TensorFlow has **no** GPU support on native
Windows, so `train_leaf_model` and `export_tflite` always run on CPU.
`train_leaf_segmentation` and `train_leaf_yolo` auto-detect the GPU the same way.

## 1. Add images

Labeled photos go under `datasets/rice_leaf/train/{healthy,blb,rice_blast}/`, one flat
folder per class - real field photos with varied lighting, leaf age, background and
severity. Roughly equal class counts; several hundred+ per class before trusting field
results. You do **not** populate `validation/` by hand - step 2 does.

If you have pixel-level lesion masks (e.g. for a new BLB/Rice Blast batch), drop them
under `datasets/rice_leaf/train/<Class Name>/Reality <X>/` (photos) and
`.../Pixel-Level Segmentation Masks <X>/` (masks, filename-matched to the photos) and
run:

```powershell
..\.venv\Scripts\python.exe manage.py migrate_dataset_layout --dry-run   # preview
..\.venv\Scripts\python.exe manage.py migrate_dataset_layout             # apply
```

This moves the photos into the flat `train/{healthy,blb,rice_blast}/` folders above and
the masks into a parallel `datasets/rice_leaf/masks/{blb,rice_blast}/` tree (used by
steps 4-5). It's a one-time migration per batch of new masked photos - safe to re-run,
a no-op once the layout is already flat.

## 2. Held-out validation split

```powershell
..\.venv\Scripts\python.exe manage.py split_dataset --ratio 0.15
```

Deletes exact-duplicate image files, drops `validation/` images that are copies of
`train/`, then moves a stratified, seeded 15% of each class into `validation/`.
`--dry-run` previews; `--force` re-splits over an existing genuine split (needed after
`migrate_dataset_layout` adds a lot of new photos to `train/`). Both trainers refuse to
run while an image name appears in the same class under both folders.

## 3. Train the classifier

**PyTorch (primary backend):**

```powershell
..\.venv\Scripts\python.exe manage.py train_leaf_torch
```

torchvision MobileNetV2, two phases (head with `--epochs`, default 8; then the whole
backbone at 1e-5 for `--fine-tune-epochs`, default 12). In-graph ImageNet
normalisation + augmentation (flip / rotation / colour jitter / a 30%-of-batches
Gaussian blur, so the classifier doesn't overfit to tripod-sharp training shots).
Best-`val_acc` weights are kept. Runs on the GPU automatically when one is present
(`--device auto`), with mixed precision. Writes `rice_leaf.pt` (TorchScript, CPU,
normalises + softmaxes internally - feed a `(N,3,224,224)` tensor of `[0,1]` pixels),
`rice_leaf.state.pt` (raw weights - also what the Grad-CAM explainability layer in
step 6 loads), and `rice_leaf_labels.json`. Prints a held-out report (accuracy,
per-class precision/recall/F1, confusion matrix).

**Keras (fallback backend + source for the mobile TFLite):**

```powershell
..\.venv\Scripts\python.exe manage.py train_leaf_model
```

Same recipe in Keras, including the Gaussian blur augmentation (a small custom
`RandomGaussianBlur` layer - Keras has no built-in one). Writes `rice_leaf.keras`
(rescales `[0,255]` internally) and the same labels file.

## 4. Train the lesion segmentation model (optional)

```powershell
..\.venv\Scripts\python.exe manage.py train_leaf_segmentation
```

Requires `datasets/rice_leaf/masks/{blb,rice_blast}/` (step 1's
`migrate_dataset_layout`). U-Net (`segmentation-models-pytorch`) with a MobileNetV2
encoder pretrained on ImageNet - transfer learning again, same backbone family as the
classifier. Healthy photos are included with a synthetic all-zero mask so the model
also learns what "no lesion" looks like. Own seeded train/val split (`--val-ratio`,
default 0.15) independent of the classifier's `validation/` folder, since mask
coverage differs per class. Two phases like the classifier (decoder-only, then the
whole network fine-tuned). Reports held-out IoU/Dice. Writes
`rice_leaf_segmentation.pt` (TorchScript, sigmoid output - feed the same
`(N,3,224,224)` `[0,1]` tensor, get a `(N,1,224,224)` lesion-probability mask back).

## 5. Train the lesion detector / YOLO (optional)

```powershell
..\.venv\Scripts\python.exe manage.py build_yolo_dataset
..\.venv\Scripts\python.exe manage.py train_leaf_yolo
```

`build_yolo_dataset` derives YOLO bounding boxes from the same masks - there are no
hand-drawn boxes, so it finds each connected blob per mask (`scipy.ndimage.label`),
drops blobs too small to be a real lesion, and emits one box per remaining blob
(`--min-area-ratio` to tune the noise cutoff). Healthy photos are included as
negative examples (no label file). Writes a standard Ultralytics layout under
`datasets/rice_leaf_yolo/`. `train_leaf_yolo` fine-tunes a COCO-pretrained
`yolov8n.pt` (`--model` to pick a different checkpoint) on that 2-class
(`blb_lesion`, `blast_lesion`) dataset - transfer learning once more - and copies the
best checkpoint to `rice_leaf_lesions.pt`.

## 6. Explainability (Grad-CAM)

No separate training step - `diagnostics.ai.generate_gradcam` loads the classifier's
own `rice_leaf.state.pt` (step 3), hooks MobileNetV2's last conv block, and produces
a heat-overlay JPEG highlighting the region that drove the predicted class. It's only
available while the PyTorch classifier (not the Keras fallback) has been trained.

## 7. Export the mobile model

```powershell
..\.venv\Scripts\python.exe manage.py export_tflite
```

Converts `rice_leaf.keras` -> `rice_leaf.tflite` with the native
`tf.lite.TFLiteConverter`, sanity-checks the interpreter (`input [1,224,224,3] f32`,
`output [1,3] f32`), and copies the `.tflite` + labels into
`../oryzawatch_mobile/assets/model/`. `--quantize` for a ~4x smaller dynamic-range
model; `--no-copy` to skip the mobile copy. See `oryzawatch_mobile/OFFLINE_AI.md` for
the app side and the native build.

## 8. Use the scanner

Authenticated multipart `POST /api/diagnostics/upload/` with `image`, `latitude`,
`longitude`. Response has `detected_disease`, `confidence_score` and `probabilities`
(`LeafScanSerializer` keeps all AI-derived fields read-only - clients cannot fake a
result), plus four best-effort fields that populate only once their model exists:

| Field | Populated once... | Meaning |
|---|---|---|
| `heatmap` | step 3's PyTorch classifier is trained | URL to a Grad-CAM overlay JPEG |
| `segmentation_mask` | step 4's model is trained | URL to a lesion-highlight overlay PNG |
| `affected_area_ratio` | step 4's model is trained | fraction (0-1) of the leaf's lesion area |
| `lesion_boxes` | steps 4-5's YOLO model is trained | list of `{class, confidence, x, y, w, h}` (normalised 0-1) |

Missing add-on models never fail the upload - those fields are simply `null`
(`diagnostics/tests.py` asserts this for a fresh install). Retraining any of them
takes effect on the very next scan, no server restart needed.

If no *classifier* is found, the endpoint returns HTTP `503` with setup instructions
(`ai.py` checks paths up front because Keras 3 raises `ValueError`, not
`FileNotFoundError`, for an absent file). Confidence values are meaningless until a
model has been trained and evaluated on the held-out split.
