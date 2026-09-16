"""
Configuration for the airborne-disease forecast model.

One place for every knob the pipeline uses: where data and artifacts live,
which points get sampled, which diseases are modelled, and the agronomic
constants behind the training labels. Importable without Django so the
pipeline can also be driven from a plain script or a notebook.
"""
from pathlib import Path

# .../oryzawatch_backend - matches Django's BASE_DIR without importing settings.
BASE_DIR = Path(__file__).resolve().parents[2]

# Raw + assembled data. One CSV per location-year of hourly weather, plus the
# assembled training table. Safe to delete; the fetcher re-downloads.
DATA_DIR = BASE_DIR / 'datasets' / 'weather'
HOURLY_CACHE_DIR = DATA_DIR / 'hourly'
TRAINING_TABLE = DATA_DIR / 'disease_forecast_training.csv'

# Trained artifacts, alongside the leaf-scanner models.
MODEL_DIR = BASE_DIR / 'ai_models' / 'disease_forecast'
METADATA_PATH = MODEL_DIR / 'metadata.json'

# --- Open-Meteo -------------------------------------------------------------
# Both endpoints are free and keyless, same as analytics/weather.py.
ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive'
FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
TIMEZONE = 'Asia/Manila'
REQUEST_TIMEOUT_SECONDS = 120

# Everything the pipeline needs is derived from these hourly variables, so
# training and inference never depend on which *daily* aggregates a given
# Open-Meteo endpoint happens to expose.
HOURLY_VARIABLES = [
    'temperature_2m',
    'relative_humidity_2m',
    'dew_point_2m',
    'precipitation',
    'wind_speed_10m',
    'wind_direction_10m',
    'shortwave_radiation',
]

# ERA5 reanalysis lands a few days behind real time; stop short of the edge so
# a run never fails on a half-populated final day.
ARCHIVE_LAG_DAYS = 7
HISTORY_YEARS = 5

# --- Sampled locations ------------------------------------------------------
# Carmen and Asuncion are the municipalities the app actually monitors
# (alerts/weather_monitor.py). The rest are rice-growing points across Davao
# del Norte and the western edge of Davao de Oro, included so the model sees a
# range of microclimates instead of memorising two grid cells. Coordinates are
# town-centre approximations - Open-Meteo snaps them to its own ~9 km grid.
TRAINING_LOCATIONS = {
    'CARMEN': (7.36, 125.70),
    'ASUNCION': (7.45, 125.57),
    'TAGUM': (7.45, 125.81),
    'PANABO': (7.31, 125.68),
    'NEW_CORELLA': (7.58, 125.83),
    'KAPALONG': (7.60, 125.70),
    'STO_TOMAS': (7.53, 125.61),
    'DUJALI': (7.43, 125.68),
    'SAN_ISIDRO': (7.63, 125.93),
    'TALAINGOD': (7.70, 125.58),
    'MONTEVISTA': (7.82, 125.98),
    'COMPOSTELA': (7.67, 126.09),
}

# The two points the running app already knows about, for inference by name.
MUNICIPALITY_POINTS = {
    'CARMEN': TRAINING_LOCATIONS['CARMEN'],
    'ASUNCION': TRAINING_LOCATIONS['ASUNCION'],
}

# Predictions are only served inside this box (roughly Mindanao). The model
# learned Davao del Norte's climate. Far outside it the answers would be
# extrapolation, and an open-ended box would let any caller aim outbound
# weather calls anywhere.
SERVICE_AREA = {'lat_min': 5.0, 'lat_max': 10.5, 'lng_min': 121.5, 'lng_max': 127.0}

# --- Diseases ---------------------------------------------------------------
# Matches diagnostics.models.LeafScan.DISEASE_CHOICES minus HEALTHY: the three
# airborne/splash-dispersed diseases the scanner classifies.
DISEASES = ('BLB', 'BLAST', 'BROWN_SPOT')

DISEASE_LABELS = {
    'BLB': 'Bacterial Leaf Blight',
    'BLAST': 'Rice Blast',
    'BROWN_SPOT': 'Brown Spot',
}

# --- Forecast horizon -------------------------------------------------------
# Open-Meteo serves 16 forecast days; skill past ~7 is poor, so that is the
# default the API and the CLI expose.
DEFAULT_FORECAST_DAYS = 7
MAX_FORECAST_DAYS = 14

# Days of observed weather pulled in ahead of the forecast at inference time.
# Must exceed the longest rolling window in features.py (60 days) plus slack,
# because a target day's features look back two months. Open-Meteo allows
# up to 92.
PAST_DAYS = 75

# --- Risk bands -------------------------------------------------------------
# Probability multiples of a disease's tuned operating threshold. Keeps the
# bands meaningful even though each disease's base rate differs.
RISK_BANDS = (
    ('SEVERE', 1.60),
    ('HIGH', 1.00),
    ('MODERATE', 0.55),
    ('LOW', 0.0),
)

RANDOM_SEED = 1337
