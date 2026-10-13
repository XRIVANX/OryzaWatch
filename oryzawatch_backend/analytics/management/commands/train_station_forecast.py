"""Train the existing disease forecast using uploaded station exports."""
import json
from pathlib import Path

import pandas as pd
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Audit station CSVs and train a candidate with station weather and cached regional history.'
    requires_system_checks = []  # Offline ML preparation does not use the database.

    def add_arguments(self, parser):
        parser.add_argument('--directory', required=True)
        parser.add_argument('--jobs', type=int, default=4)
        parser.add_argument('--prepare-only', action='store_true')
        parser.add_argument('--use-prepared', action='store_true')

    def handle(self, *args, **options):
        from analytics.ml.config import DATA_DIR, MODEL_DIR
        from analytics.ml.dataset import load_training_table
        from analytics.ml.stations import build_station_table
        from analytics.ml.train import train_all

        source = Path(options['directory'])
        if not source.is_dir():
            raise CommandError(f'Dataset directory not found: {source}')
        data_dir = DATA_DIR / 'station_exports'
        data_dir.mkdir(parents=True, exist_ok=True)
        audit_path = data_dir / 'data_audit.json'
        table_path = data_dir / 'training.csv'
        if options['use_prepared']:
            combined = pd.read_csv(table_path, parse_dates=['date'])
            audit = json.loads(audit_path.read_text(encoding='utf-8'))
            if Path(audit['source_directory']).resolve() != source.resolve():
                raise CommandError('Prepared data belongs to a different source directory; prepare this directory first.')
        else:
            try:
                station, audit = build_station_table(source)
            except ValueError as exc:
                raise CommandError(str(exc)) from exc
            regional = load_training_table()
            replaced = pd.MultiIndex.from_frame(station[['date', 'location']])
            regional = regional.loc[~pd.MultiIndex.from_frame(regional[['date', 'location']]).isin(replaced)]
            combined = pd.concat([regional, station], ignore_index=True).sort_values(['date', 'location']).reset_index(drop=True)
            audit['source_directory'] = str(source.resolve())
            audit['regional_rows'] = len(regional)
            audit['combined_rows'] = len(combined)
            combined.to_csv(table_path, index=False)
            audit_path.write_text(json.dumps(audit, indent=2), encoding='utf-8')
        self.stdout.write(f'Prepared {len(combined):,} rows, including {audit["training_rows"]:,} station rows. Audit: {audit_path}')
        if options['prepare_only']:
            return
        metadata = train_all(combined, n_jobs=options['jobs'], output_dir=MODEL_DIR / 'station_candidate',
                             data_metadata={'source': 'Station interval weather exports plus cached Open-Meteo regional history',
                                            'station_audit': audit, 'history_years': None})
        for disease, result in metadata['diseases'].items():
            score = result['test']['ensemble']
            self.stdout.write(f'{disease}: held-out F1={score["f1"]:.3f}, PR-AUC={score["average_precision"]:.3f}')
        self.stdout.write(self.style.SUCCESS('Trained candidate saved to ai_models/disease_forecast/station_candidate.'))
