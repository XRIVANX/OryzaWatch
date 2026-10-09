"""Export human-confirmed samples for later dataset curation; never retrain automatically."""
import csv
from pathlib import Path

from django.core.management.base import BaseCommand

from diagnostics.data_exports import MANIFEST_FIELDS, verified_scan_rows, csv_safe_row


class Command(BaseCommand):
    help = 'Export verified leaf scans and provenance as a CSV manifest for dataset curation.'

    def add_arguments(self, parser):
        parser.add_argument('--output', required=True, help='Destination CSV path.')

    def handle(self, *args, **options):
        path = Path(options['output'])
        path.parent.mkdir(parents=True, exist_ok=True)
        count, missing = 0, 0
        with path.open('w', newline='', encoding='utf-8') as handle:
            writer = csv.DictWriter(handle, fieldnames=MANIFEST_FIELDS)
            writer.writeheader()
            for row in verified_scan_rows():
                writer.writerow(csv_safe_row(row))
                missing += not row['image_available']
                count += 1
        self.stdout.write(self.style.SUCCESS(f'Exported {count} verified scans to {path}. Missing images: {missing}.'))
