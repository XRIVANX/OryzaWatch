"""Human-confirmed sample manifest shared by the web download and CLI."""
import csv
import hashlib
import json

from .models import LeafScan


MANIFEST_FIELDS = [
    'scan_id', 'image', 'image_sha256', 'image_available', 'reporter_id',
    'observed_on', 'uploaded_at', 'latitude', 'longitude', 'variety_id',
    'variety_name', 'growth_stage', 'symptom_notes', 'confirmed_disease',
    'verification_method', 'verification_notes', 'verified_by_id', 'verified_at',
    'ai_predicted_disease', 'ai_confidence', 'ai_probabilities',
]


def verified_scan_rows():
    scans = LeafScan.objects.filter(
        verification_status='VERIFIED', verified_at__isnull=False,
        verified_disease__in=dict(LeafScan.DISEASE_CHOICES),
    ).exclude(verification_method='').select_related('variety').order_by('pk')
    for scan in scans.iterator():
        digest = ''
        try:
            hasher = hashlib.sha256()
            with scan.image.open('rb') as image:
                for block in iter(lambda: image.read(1024 * 1024), b''):
                    hasher.update(block)
            digest = hasher.hexdigest()
        except (OSError, ValueError):
            pass
        yield {
            'scan_id': scan.pk, 'image': scan.image.name, 'image_sha256': digest,
            'image_available': bool(digest), 'reporter_id': scan.reporter_id,
            'observed_on': scan.observed_on or '', 'uploaded_at': scan.created_at.isoformat(),
            'latitude': scan.latitude, 'longitude': scan.longitude,
            'variety_id': scan.variety_id or '', 'variety_name': scan.variety.name if scan.variety else '',
            'growth_stage': scan.growth_stage, 'symptom_notes': scan.symptom_notes,
            'confirmed_disease': scan.verified_disease,
            'verification_method': scan.verification_method,
            'verification_notes': scan.verification_notes,
            'verified_by_id': scan.verified_by_id or '', 'verified_at': scan.verified_at.isoformat(),
            'ai_predicted_disease': scan.detected_disease, 'ai_confidence': scan.confidence_score,
            'ai_probabilities': json.dumps(scan.probabilities) if scan.probabilities is not None else '',
        }


class _CSVBuffer:
    def write(self, value):
        return value


def csv_safe_row(row):
    row = dict(row)
    for field in ('variety_name', 'symptom_notes', 'verification_notes'):
        value = row[field]
        if value and value.lstrip().startswith(('=', '+', '-', '@')):
            row[field] = "'" + value
    return row


def verified_csv():
    writer = csv.DictWriter(_CSVBuffer(), fieldnames=MANIFEST_FIELDS)
    yield writer.writeheader()
    for row in verified_scan_rows():
        yield writer.writerow(csv_safe_row(row))
