# Rice disease AI scanner

The scanner recognizes three classes: `HEALTHY`, `BLB` (bacterial leaf blight), and `BLAST` (rice blast). The upload endpoint only saves a scan after inference succeeds, so an untrained or missing model cannot silently report a healthy leaf.

## 1. Add images

Put labeled images under `datasets/rice_leaf/`:

```text
train/healthy/*.jpg
train/blb/*.jpg
train/rice_blast/*.jpg
validation/healthy/*.jpg
validation/blb/*.jpg
validation/rice_blast/*.jpg
```

Use real field images with different lighting, leaf ages, backgrounds, and symptom severity. Keep images from the same plant or photo session in only one split. Start with roughly equal class counts; include at least several hundred images per class before relying on results in the field.

## 2. Install the runtime

From `oryzawatch_backend`, install the requirements into the configured environment:

```powershell
uv pip install -r requirements.txt
```

## 3. Train the model

```powershell
uv run manage.py train_leaf_model --epochs 10
```

This writes `ai_models/rice_leaf.keras` and `ai_models/rice_leaf_labels.json`. These generated files are ignored by Git. Review validation accuracy and test new field photos before deploying the model.

## 4. Use the scanner

Send an authenticated multipart request to `POST /api/diagnostics/upload/` with `image`, `latitude`, and `longitude`. The response contains `detected_disease` and `confidence_score`. The existing `LeafScanSerializer` keeps those fields read-only so clients cannot fake an AI result.

If the model files are missing, the endpoint returns HTTP `503` with setup instructions. This is intentional: confidence values are not meaningful until the model has been trained and evaluated.
