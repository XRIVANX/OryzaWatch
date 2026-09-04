# Rice disease AI scanner

Recognizes three classes: `HEALTHY`, `BLB` (bacterial leaf blight), `BLAST` (rice blast).
The upload endpoint only saves a scan after inference succeeds, so an untrained or
missing model can never silently report a healthy leaf.

## Architecture (hybrid)

| Where | Framework | Artifact | Trained by |
|---|---|---|---|
| Django backend (authoritative) | **PyTorch** (primary) | `ai_models/rice_leaf.pt` (TorchScript) | `train_leaf_torch` |
| Django backend (fallback) | Keras / TF | `ai_models/rice_leaf.keras` | `train_leaf_model` |
| Mobile app (offline estimate) | TensorFlow Lite | `ai_models/rice_leaf.tflite` -> bundled in the RN app | `export_tflite` (from the Keras model) |

`diagnostics/ai.py` loads `rice_leaf.pt` when present and only falls back to
`rice_leaf.keras` if the PyTorch model is missing or fails to load. All three
artifacts are MobileNetV2 transfer-learning models trained on the same
`datasets/rice_leaf` split and share `rice_leaf_labels.json`
(`{"0": "BLB", "1": "HEALTHY", "2": "BLAST"}`).

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

`train_leaf_torch` auto-detects the GPU (`--device auto`, the default) and uses mixed
precision on CUDA. On a small (<=4 GB) GPU close browsers/Electron apps first - it needs
~2 GB free and caps the batch size automatically when VRAM is tight. `--device cpu` forces
CPU; `--batch-size 8` if the GPU still OOMs. TensorFlow has **no** GPU support on native
Windows, so `train_leaf_model` and `export_tflite` always run on CPU.

## 1. Add images

Labeled images under `datasets/rice_leaf/train/{healthy,blb,rice_blast}/`. Use real
field photos with varied lighting, leaf age, background and severity. Roughly equal
class counts; several hundred+ per class before trusting field results. You do **not**
populate `validation/` by hand - step 2 does.

## 2. Held-out validation split

```powershell
..\.venv\Scripts\python.exe manage.py split_dataset --ratio 0.15
```

Deletes exact-duplicate image files, drops `validation/` images that are copies of
`train/`, then moves a stratified, seeded 15% of each class into `validation/`.
`--dry-run` previews; `--force` re-splits over an existing genuine split. Both trainers
refuse to run while an image name appears in the same class under both folders.

## 3. Train

**PyTorch (primary backend):**

```powershell
..\.venv\Scripts\python.exe manage.py train_leaf_torch
```

torchvision MobileNetV2, two phases (head with `--epochs`, default 8; then the whole
backbone at 1e-5 for `--fine-tune-epochs`, default 12). In-graph ImageNet
normalisation + augmentation (flip / rotation / colour jitter). Best-`val_acc` weights
are kept. Runs on the GPU automatically when one is present (`--device auto`), with
mixed precision. Writes `rice_leaf.pt` (TorchScript, CPU, normalises + softmaxes
internally - feed a `(N,3,224,224)` tensor of `[0,1]` pixels), `rice_leaf.state.pt`
(raw weights), and `rice_leaf_labels.json`. Prints a held-out report (accuracy,
per-class precision/recall/F1, confusion matrix).

**Keras (fallback backend + source for the mobile TFLite):**

```powershell
..\.venv\Scripts\python.exe manage.py train_leaf_model
```

Same recipe in Keras. Writes `rice_leaf.keras` (rescales `[0,255]` internally) and the
same labels file.

## 4. Export the mobile model

```powershell
..\.venv\Scripts\python.exe manage.py export_tflite
```

Converts `rice_leaf.keras` -> `rice_leaf.tflite` with the native
`tf.lite.TFLiteConverter`, sanity-checks the interpreter (`input [1,224,224,3] f32`,
`output [1,3] f32`), and copies the `.tflite` + labels into
`../oryzawatch_mobile/assets/model/`. `--quantize` for a ~4x smaller dynamic-range
model; `--no-copy` to skip the mobile copy. See `oryzawatch_mobile/OFFLINE_AI.md` for
the app side and the native build.

## 5. Use the scanner

Authenticated multipart `POST /api/diagnostics/upload/` with `image`, `latitude`,
`longitude`. Response has `detected_disease` and `confidence_score`
(`LeafScanSerializer` keeps them read-only - clients cannot fake an AI result).

If no model is found, the endpoint returns HTTP `503` with setup instructions
(`ai.py` checks paths up front because Keras 3 raises `ValueError`, not
`FileNotFoundError`, for an absent file). Confidence values are meaningless until a
model has been trained and evaluated on the held-out split.
