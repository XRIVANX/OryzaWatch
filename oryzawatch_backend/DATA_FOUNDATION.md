# Rice variety and scan data foundation

This foundation collects sourced variety information and human-reviewed leaf samples for later model training. It starts with an empty variety catalogue and unknown verification status for every existing scan. No resistance ratings or disease confirmations are fabricated.

## Enter rice variety data

Sign in to the web app as a MAO admin and open **MAO Console → Rice Varieties**.

1. Add the variety name. Other names, maturity days, source and description are optional. Unknown maturity remains blank.
2. Add a disease evidence record when you have a source: disease, reported response, evidence type, citation/report reference and conditions or notes.
3. Record separate evidence for BLB and Rice Blast. Multiple sources can be retained, including conflicting findings; the system does not silently collapse them into one rating.
4. Use **Edit variety** or **Edit evidence** to correct records. Turn off **Available for new scans** to retire a variety while retaining its identity on previous samples.

Evidence entries are claims linked to their sources. Current weather forecasts do not apply a numerical variety discount. A variety without evidence has an unknown disease response. These records need validation before they become model features or personalized risk estimates.

The same records can be managed by an authorized Django staff account at `/admin/diagnostics/ricevariety/`.

## Capture leaf samples

The web and mobile scanners accept an optional variety, growth stage, date inspected and symptom notes. Leave unknown values blank. The observation date is the actual plant inspection date, not the upload date; future dates are rejected using Philippine local time.

The web scanner accepts explicit sample coordinates or the current device location. The mobile scanner requires location access. When uploading an older or off-site photo, check that its location is represented correctly; the mobile current-location flow is intended for field use at the sample location.

The image, AI classification, confidence and per-class probabilities are saved. AI results remain separate from the human review fields. Old scans have no stored probability breakdown, because the previous implementation did not persist it.

## Review actual disease outcomes

Open **MAO Console → Scan Review**. For each pending sample:

- Select a confirmed BLB, Rice Blast, or healthy result and record the confirmation method.
- Choose inconclusive with an explanation when the available evidence does not support a diagnosis. Inconclusive samples have no confirmed label.
- Save the human review. The reviewer and review time are recorded automatically, and the original AI prediction is preserved.

MAO admins and Agri-Kagawads can use the review API. Farmers cannot set verification fields through image upload or access the review queue. Confirmations should come from an actual inspection, qualified reviewer or lab result; agreeing with the AI alone is not independent ground truth.

The web pending queue removes reviewed samples. Authorized staff can correct previous reviews through Django admin. The API also permits a management reviewer to correct a prior diagnosis and stamps the latest reviewer and review time.

## Download data for future training

MAO admins can use **Download verified data (CSV)** in Scan Review. The export includes only scans with a confirmed human diagnosis and a review timestamp/method. It excludes AI-only and inconclusive samples.

Each row contains the confirmed label, image storage path, image hash and availability flag, observation and upload dates, location, variety, growth stage, notes, reviewer and separate AI outputs. The CSV is a manifest; original images remain in the backend media storage. Missing images are flagged, not silently treated as valid image training samples.

Free-text cells beginning with a spreadsheet formula marker are prefixed with an apostrophe in the CSV. The original stored notes are preserved.

The same export is available from the backend directory:

```powershell
..\.venv\Scripts\python.exe manage.py export_verified_scans --output datasets\verified_scans.csv
```

Before training an image classifier, remove duplicates using the image hash, inspect annotation quality, and group photos from the same farm/visit so related samples do not land on both sides of validation. For a real outbreak forecast, supplement sample records with dated field inspections, field-level outcomes and healthy checks; a healthy photographed leaf alone does not establish that the whole field is disease-free. No automatic retraining or model promotion is performed by this collection workflow.

## API routes

All routes require authentication.

| Route | Usage |
| --- | --- |
| `GET /api/diagnostics/varieties/` | Active varieties and sourced evidence |
| `POST /api/diagnostics/varieties/` | MAO admin adds a variety |
| `PATCH /api/diagnostics/varieties/<id>/` | MAO admin updates or retires a variety |
| `POST /api/diagnostics/varieties/<id>/evidence/` | MAO admin adds a sourced disease response |
| `PATCH /api/diagnostics/variety-evidence/<id>/` | MAO admin corrects evidence |
| `POST /api/diagnostics/upload/` | Image upload with optional `variety`, `growth_stage`, `observed_on`, `symptom_notes` |
| `GET /api/diagnostics/review-queue/` | Management lists unreviewed scans |
| `PATCH /api/diagnostics/scans/<id>/verify/` | Management records a human diagnosis or inconclusive review |
| `GET /api/diagnostics/verified-data/` | MAO admin downloads the confirmed sample manifest |

Example review body:

```json
{
  "verification_status": "VERIFIED",
  "verified_disease": "BLB",
  "verification_method": "FIELD_EXPERT",
  "verification_notes": "Reference to the independent field inspection."
}
```

New installations must apply `diagnostics.0004_ricevariety_leafscan_growth_stage_and_more` using the usual `manage.py migrate` command before using these features.
