"""
Assemble the training table: five years of Open-Meteo hourly history per
location, converted to daily features plus epidemiological outbreak labels.
"""
from __future__ import annotations

import logging

import pandas as pd

from .config import HISTORY_YEARS, RANDOM_SEED, TRAINING_LOCATIONS, TRAINING_TABLE
from .epidemiology import simulate_outbreaks
from .features import build_features
from .sources import load_location_history, to_daily

logger = logging.getLogger(__name__)


def build_location_rows(name, latitude, longitude, *, years=HISTORY_YEARS, refresh=False, seed=RANDOM_SEED):
    hourly = load_location_history(name, latitude, longitude, years, refresh=refresh)
    daily = to_daily(hourly)
    labels = simulate_outbreaks(hourly, daily, location=name, seed=seed)
    features = build_features(daily)
    return features.merge(labels, on='date', how='inner')


def build_training_table(locations=None, *, years=HISTORY_YEARS, refresh=False, seed=RANDOM_SEED,
                         save=True, progress=None):
    """
    Build (and by default cache to CSV) the full training table.
    `progress` is an optional callable(str) for command-line feedback.
    """
    locations = locations or TRAINING_LOCATIONS
    say = progress or logger.info

    frames = []
    for index, (name, (latitude, longitude)) in enumerate(locations.items(), start=1):
        say(f'[{index}/{len(locations)}] {name}: fetching {years}y hourly history and building rows')
        rows = build_location_rows(name, latitude, longitude, years=years, refresh=refresh, seed=seed)
        frames.append(rows)
        say(f'    {len(rows):,} days, {rows["date"].min():%Y-%m-%d} to {rows["date"].max():%Y-%m-%d}')

    table = pd.concat(frames, ignore_index=True).sort_values(['date', 'location']).reset_index(drop=True)
    if save:
        TRAINING_TABLE.parent.mkdir(parents=True, exist_ok=True)
        table.to_csv(TRAINING_TABLE, index=False)
        say(f'Saved training table: {TRAINING_TABLE} ({len(table):,} rows)')
    return table


def load_training_table():
    if not TRAINING_TABLE.exists():
        raise FileNotFoundError(
            f'No cached training table at {TRAINING_TABLE}. '
            'Run `manage.py train_disease_forecast` without --use-cache first.'
        )
    return pd.read_csv(TRAINING_TABLE, parse_dates=['date'])
