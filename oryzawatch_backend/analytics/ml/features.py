"""
Feature engineering for the disease forecast model.

Input is the daily table from sources.to_daily, which is the same for
five-year history and for a live forecast. Output is one row per location-day
describing the weather *leading up to and including* that day. The model
predicts whether that day is an outbreak day.

At inference, a future target day's row is built from observed days plus
forecast days. The model therefore answers: "given the last three weeks and
the forecast through day T, how likely is an outbreak on day T?"

Nothing here reads hourly data or any label column. See the note in
sources.py on why that separation matters.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

WINDOWS = (3, 7, 14, 21)
# Epidemics build over one to two months of secondary infection cycles. These
# longer windows let the model estimate how much pressure has accumulated,
# which short windows cannot see.
LONG_WINDOWS = (30, 45, 60)
LAGS = (3, 5, 7, 10, 14)
# Rows need this many prior days before every rolling window is complete.
MIN_HISTORY_DAYS = max(WINDOWS + LONG_WINDOWS)

HUMID_DAY_RH = 85.0

SAME_DAY = [
    't_max', 't_min', 't_mean', 't_std', 't_range',
    'rh_max', 'rh_min', 'rh_mean', 'dew_mean', 'dew_depression',
    'vpd_mean', 'vpd_max', 'precip_sum', 'precip_max_hourly', 'precip_hours',
    'wind_mean', 'wind_max', 'wind_u', 'wind_v', 'radiation_mj', 'et0',
]

ROLLING_MEAN = [
    't_mean', 't_min', 't_range', 'rh_mean', 'rh_min', 'rh_max',
    'dew_depression', 'vpd_mean', 'wind_mean', 'radiation_mj',
]
ROLLING_SUM = [
    'precip_sum', 'precip_hours', 'rain_day', 'humid_day', 'water_balance', 'dewy_night',
    'blast_day', 'blb_day', 'storm_day',
]
LONG_MEAN = ['rh_mean', 't_min', 't_mean', 'vpd_mean']
LONG_SUM = ['humid_day', 'rain_day', 'water_balance', 'dewy_night', 'blast_day', 'blb_day', 'storm_day']
LAGGED = ['rh_mean', 'rh_min', 'precip_sum', 'precip_hours', 't_mean', 't_min']

LOCATION = ['latitude', 'longitude', 'elevation']


def _streak(flags):
    """Consecutive True values ending at each row."""
    flags = flags.astype(bool)
    groups = (~flags).cumsum()
    return flags.groupby(groups).cumsum().astype(float)


def _days_since(flags, cap=60):
    """Days since the flag was last True, capped."""
    flags = flags.astype(bool).to_numpy()
    out = np.empty(len(flags))
    count = cap
    for i, flag in enumerate(flags):
        count = 0 if flag else min(count + 1, cap)
        out[i] = count
    return out


def _location_features(daily):
    frame = daily.sort_values('date').reset_index(drop=True).copy()

    frame['humid_day'] = (frame['rh_mean'] >= HUMID_DAY_RH).astype(int)
    frame['water_balance'] = frame['precip_sum'] - frame['et0']
    # A dewy night at blast-friendly temperatures: near saturation overnight
    # with a mild minimum. Still a daily statistic.
    frame['dewy_night'] = (
        (frame['rh_max'] >= 95) & frame['t_min'].between(19.0, 26.0)
    ).astype(int)
    # Daily-resolution agronomic indicators: what an agronomist reads off a
    # daily forecast. They approximate, but do not reproduce, the hourly
    # wetness physics behind the labels.
    frame['blast_day'] = (
        (frame['rh_mean'] >= 85) & frame['t_min'].between(20.0, 25.0) & (frame['precip_sum'] < 12)
    ).astype(int)
    frame['blb_day'] = (
        (frame['precip_sum'] >= 15) & (frame['wind_max'] >= 15) & (frame['t_mean'] >= 25)
    ).astype(int)
    frame['storm_day'] = ((frame['precip_sum'] >= 20) & (frame['wind_max'] >= 18)).astype(int)
    balance_14 = frame['water_balance'].rolling(14, min_periods=14).sum()

    # Columns are gathered in a dict and assembled once. Inserting ~150
    # columns one at a time fragments the frame and is several times slower.
    columns = {'date': frame['date']}
    for column in SAME_DAY:
        columns[column] = frame[column]

    for window in WINDOWS:
        rolling = frame.rolling(window, min_periods=window)
        for column in ROLLING_MEAN:
            columns[f'{column}_mean_{window}d'] = rolling[column].mean()
        for column in ROLLING_SUM:
            columns[f'{column}_sum_{window}d'] = rolling[column].sum()
        columns[f'wind_max_{window}d'] = rolling['wind_max'].max()
        columns[f'precip_max_{window}d'] = rolling['precip_sum'].max()
        if window >= 7:
            columns[f't_mean_std_{window}d'] = rolling['t_mean'].std()
            columns[f'rh_mean_std_{window}d'] = rolling['rh_mean'].std()
        # Prevailing wind over the window, as a unit-vector average.
        columns[f'wind_u_mean_{window}d'] = rolling['wind_u'].mean()
        columns[f'wind_v_mean_{window}d'] = rolling['wind_v'].mean()

    for window in LONG_WINDOWS:
        rolling = frame.rolling(window, min_periods=window)
        for column in LONG_MEAN:
            columns[f'{column}_mean_{window}d'] = rolling[column].mean()
        for column in LONG_SUM:
            columns[f'{column}_sum_{window}d'] = rolling[column].sum()

    # Crop water stress: the current 14-day balance, and the worst it has been
    # over the last month. A stressed crop stays predisposed after rain returns.
    columns['water_balance_14d'] = balance_14
    columns['water_balance_min_30d'] = balance_14.rolling(30, min_periods=30).min()

    for lag in LAGS:
        for column in LAGGED:
            columns[f'{column}_lag{lag}'] = frame[column].shift(lag)

    columns['humid_streak'] = _streak(frame['humid_day'])
    columns['rain_streak'] = _streak(frame['rain_day'])
    columns['days_since_rain'] = pd.Series(_days_since(frame['rain_day']), index=frame.index)
    columns['days_since_humid'] = pd.Series(_days_since(frame['humid_day']), index=frame.index)

    doy = frame['date'].dt.dayofyear
    columns['doy_sin'] = np.sin(2 * np.pi * doy / 365.25)
    columns['doy_cos'] = np.cos(2 * np.pi * doy / 365.25)
    # Two cropping seasons per year, so a half-year harmonic too.
    columns['doy_sin2'] = np.sin(4 * np.pi * doy / 365.25)
    columns['doy_cos2'] = np.cos(4 * np.pi * doy / 365.25)

    for column in LOCATION:
        columns[column] = frame[column] if column in frame.columns else pd.Series(np.nan, index=frame.index)
    if 'location' in frame.columns:
        columns['location'] = frame['location']

    features = pd.DataFrame(columns)

    # Every rolling window must be complete.
    return features.iloc[MIN_HISTORY_DAYS - 1:].reset_index(drop=True)


def build_features(daily):
    """Feature table for one or many locations (grouped by `location` if present)."""
    if 'location' in daily.columns and daily['location'].nunique() > 1:
        parts = [_location_features(group) for _, group in daily.groupby('location', sort=False)]
        return pd.concat(parts, ignore_index=True)
    return _location_features(daily)


def feature_columns(table):
    """The model's input columns, in a stable order."""
    excluded = {'date', 'location'}
    return [column for column in table.columns if column not in excluded]
