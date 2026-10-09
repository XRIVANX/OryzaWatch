"""Train a separate candidate disease forecast using PAGASA station data."""
import json
import shutil
from pathlib import Path

import pandas as pd
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Train a candidate forecast with PAGASA daily measurements and supplementary hourly weather.'

    def add_arguments(self, parser):
        parser.add_argument('--daily', required=True)
        parser.add_argument('--monthly')
        parser.add_argument('--readme')
        parser.add_argument('--jobs', type=int, default=4)
        parser.add_argument('--device', choices=('cpu', 'cuda'), default='cpu',
                            help='XGBoost training device (Random Forest remains on CPU).')

    def handle(self, *args, **options):
        from analytics.ml.config import DATA_DIR, MODEL_DIR
        from analytics.ml.dataset import load_training_table
        from analytics.ml.epidemiology import label_columns
        from analytics.ml.pagasa import build_station_rows
        from analytics.ml.train import train_all

        data_dir = DATA_DIR / 'pagasa_davao'
        output_dir = MODEL_DIR / 'pagasa_davao_candidate'
        data_dir.mkdir(parents=True, exist_ok=True)
        paths = {}
        for key in ('daily', 'monthly', 'readme'):
            if options.get(key):
                source = Path(options[key])
                if not source.is_file():
                    raise CommandError(f'File not found: {source}')
                target = data_dir / source.name
                if source.resolve() != target.resolve():
                    shutil.copy2(source, target)
                paths[key] = target
        try:
            rows, audit = build_station_rows(paths['daily'], paths.get('monthly'), say=print)
        except ValueError as exc:
            raise CommandError(str(exc)) from exc
        # Preserve geographic variety but evaluate only the period shared by
        # the station records and the existing regional training table.
        regional = load_training_table()
        regional = regional.loc[regional.date.between(rows.date.min(), rows.date.max())]
        regional = regional.loc[regional.location != 'DAVAO_CITY']
        start = max(rows.date.min(), regional.date.min())
        rows = rows.loc[rows.date >= start]
        combined = pd.concat([regional, rows], ignore_index=True).sort_values(['date', 'location']).reset_index(drop=True)
        required = set(label_columns())
        combined = combined.drop(columns=[c for c in combined if c.endswith(('_infection', '_severity', '_outbreak')) and c not in required])
        combined.to_csv(data_dir / 'training.csv', index=False)
        audit['station_rows_in_combined_table'] = len(rows)
        (data_dir / 'data_audit.json').write_text(json.dumps(audit, indent=2), encoding='utf-8')
        self.stdout.write(f'Training candidate on {len(combined):,} days across {combined.location.nunique()} locations.')
        metadata = train_all(combined, output_dir=output_dir, n_jobs=options['jobs'],
                             xgb_device=options['device'],
                             data_metadata={'source': 'PAGASA Davao daily station + Open-Meteo hourly reanalysis',
                                            'station_audit': audit, 'monthly_role': 'quality check only',
                                            'history_years': None})
        for disease, result in metadata['diseases'].items():
            score = result['test']['ensemble']
            self.stdout.write(f'{disease}: held-out F1={score["f1"]:.3f}, PR-AUC={score["average_precision"]:.3f}')
        self.stdout.write(self.style.SUCCESS(f'Candidate saved to {output_dir}. Active models were preserved.'))
