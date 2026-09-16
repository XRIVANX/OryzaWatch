"""
Train the airborne rice disease forecast (Random Forest + XGBoost) on five
years of Open-Meteo weather:

    ../.venv/Scripts/python.exe manage.py train_disease_forecast

Downloads any missing history (cached under datasets/weather/hourly/), builds
the feature/label table, trains one ensemble per disease, prints held-out-year
metrics, and saves the models to ai_models/disease_forecast/.

    --use-cache      reuse datasets/weather/disease_forecast_training.csv
    --refresh        re-download all history, even if cached
    --tune           randomized hyperparameter search (much slower)
    --no-final-refit keep the train-years model instead of refitting on all data
"""
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Train the Random Forest + XGBoost airborne rice disease forecast on 5 years of Open-Meteo data.'

    def add_arguments(self, parser):
        parser.add_argument('--years', type=int, default=5, help='Years of history to train on (default 5).')
        parser.add_argument('--use-cache', action='store_true', help='Reuse the cached training table.')
        parser.add_argument('--refresh', action='store_true', help='Re-download weather history.')
        parser.add_argument('--tune', action='store_true', help='Run randomized hyperparameter search.')
        parser.add_argument('--tune-iter', type=int, default=20, help='Search iterations per model (default 20).')
        parser.add_argument('--test-days', type=int, default=365, help='Held-out final days (default 365).')
        parser.add_argument('--no-final-refit', action='store_true', help='Do not refit on all rows before saving.')
        parser.add_argument('--jobs', type=int, default=-1, help='CPU cores for training (default all).')

    def handle(self, *args, **options):
        try:
            from analytics.ml.dataset import build_training_table, load_training_table
            from analytics.ml.train import train_all
        except ImportError as exc:
            raise CommandError(
                f'ML dependencies missing ({exc}). Install them into the repo-root venv:\n'
                '  uv pip install --python ./.venv/Scripts/python.exe scikit-learn xgboost pandas joblib'
            )

        say = self.stdout.write
        if options['years'] < 2:
            raise CommandError('--years must be at least 2 (one for training, one held out).')

        if options['use_cache']:
            try:
                table = load_training_table()
            except FileNotFoundError as exc:
                raise CommandError(str(exc))
            say(f'Loaded cached training table ({len(table):,} rows)')
        else:
            table = build_training_table(years=options['years'], refresh=options['refresh'], progress=say)

        metadata = train_all(
            table,
            test_days=options['test_days'],
            tune=options['tune'],
            tune_iter=options['tune_iter'],
            final_refit=not options['no_final_refit'],
            n_jobs=options['jobs'],
            say=say,
        )
        self._report(metadata)

    def _report(self, metadata):
        say = self.stdout.write
        say('')
        say(self.style.MIGRATE_HEADING(
            f'Held-out year ({metadata["data"]["end"]} back {metadata["validation"]["holdout_days"]} days)'
        ))
        header = f'{"disease":<11} {"model":<24} {"ROC-AUC":>8} {"PR-AUC":>7} {"F1":>6} {"prec":>6} {"recall":>6} {"acc":>6}'
        say(header)
        say('-' * len(header))
        names = {
            'random_forest': 'Random Forest',
            'xgboost': 'XGBoost',
            'ensemble': 'RF + XGB ensemble',
            'humidity_rule_baseline': 'current humidity rule',
        }
        for disease, result in metadata['diseases'].items():
            for key, label in names.items():
                m = result['test'][key]
                fmt = lambda v: f'{v:.3f}' if v is not None else '  n/a'
                say(f'{disease:<11} {label:<24} {fmt(m["roc_auc"]):>8} {fmt(m["average_precision"]):>7} '
                    f'{m["f1"]:>6.3f} {m["precision"]:>6.3f} {m["recall"]:>6.3f} {m["accuracy"]:>6.3f}')
            top = ', '.join(f['feature'] for f in result['top_features'][:5])
            say(f'{"":<11} top drivers: {top}')
        say(self.style.SUCCESS(f'Models saved. Details: ai_models/disease_forecast/metadata.json'))
