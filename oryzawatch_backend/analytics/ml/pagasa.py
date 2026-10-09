"""PAGASA daily observations supplemented by same-point hourly reanalysis.

The monthly file is a quality check, never extra daily training examples.
Hourly-only predictors and simulated labels remain reanalysis-derived: daily
observations cannot establish wet-hour durations or confirmed field outbreaks.
"""
from pathlib import Path
import hashlib

import numpy as np
import pandas as pd

from .config import DATA_DIR, RANDOM_SEED
from .epidemiology import simulate_outbreaks
from .features import build_features
from .sources import fetch_hourly_archive, to_daily

LATITUDE, LONGITUDE, ELEVATION = 7.127577, 125.654969, 17.29
STATION_NAME = 'DAVAO_CITY'
MEASUREMENTS = ['RAINFALL', 'TMAX', 'TMIN', 'TMEAN', 'RH', 'WIND_SPEED', 'WIND_DIRECTION']


def read_observations(path: str | Path, *, monthly: bool = False) -> tuple[pd.DataFrame, dict[str, object]]:
    frame = pd.read_csv(path)
    required = ['YEAR', 'MONTH', *([] if monthly else ['DAY']), *MEASUREMENTS]
    missing = set(required) - set(frame.columns)
    if missing:
        raise ValueError(f'Missing columns: {sorted(missing)}')
    for col in required:
        frame[col] = pd.to_numeric(frame[col], errors='raise')
    parts = {'year': frame.YEAR, 'month': frame.MONTH,
             'day': 1 if monthly else frame.DAY}
    frame['date'] = pd.to_datetime(pd.DataFrame(parts), errors='raise')
    if frame.date.duplicated().any():
        raise ValueError('Duplicate dates in station observations.')
    report: dict[str, object] = {
        'rows': len(frame), 'missing_markers': int(frame[MEASUREMENTS].eq(-999).sum().sum()),
        'trace_rainfall_days': int(frame.RAINFALL.eq(-1).sum()),
    }
    frame[MEASUREMENTS] = frame[MEASUREMENTS].replace(-999, np.nan)
    # Trace means less than 0.1 mm; zero is the lower-bound approximation.
    # Preserve the original sentinel in the archived source, record this policy.
    frame['rainfall_trace'] = frame.RAINFALL.eq(-1)
    frame.loc[frame.rainfall_trace, 'RAINFALL'] = 0.0
    bounds = {'RAINFALL': (0, np.inf), 'RH': (0, 100), 'WIND_SPEED': (0, np.inf),
              'WIND_DIRECTION': (0, 360), 'TMAX': (-60, 60), 'TMIN': (-60, 60), 'TMEAN': (-60, 60)}
    for col, (low, high) in bounds.items():
        if (frame[col].notna() & ~frame[col].between(low, high)).any():
            raise ValueError(f'Invalid {col} measurement.')
    if (frame.TMIN > frame.TMAX).any() or ((frame.TMEAN < frame.TMIN) | (frame.TMEAN > frame.TMAX)).any():
        raise ValueError('Temperature means/extrema are inconsistent.')
    frame = frame.sort_values('date').reset_index(drop=True)
    if not monthly and len(frame) != len(pd.date_range(frame.date.min(), frame.date.max())):
        raise ValueError('Daily observations must have a continuous calendar.')
    return frame, report


def monthly_check(daily, monthly):
    grouped = daily.assign(period=daily.date.dt.to_period('M')).groupby('period')
    sums = grouped.RAINFALL.sum(min_count=1)
    reference = monthly.set_index(monthly.date.dt.to_period('M')).RAINFALL
    compared = pd.concat([sums.rename('daily_total'), reference.rename('monthly_total')], axis=1)
    compared['difference_mm'] = compared.daily_total - compared.monthly_total
    return {'months_compared': int(compared.dropna().shape[0]),
            'max_absolute_rainfall_difference_mm': float(compared.difference_mm.abs().max()),
            'months_with_difference_over_1mm': int(compared.difference_mm.abs().gt(1).sum()),
            'note': 'Monthly summaries are checks only; trace rainfall is approximated as zero.'}


def station_hourly(daily, *, say=print):
    cache = DATA_DIR / 'pagasa_davao' / 'hourly'
    cache.mkdir(parents=True, exist_ok=True)
    chunks = []
    for year, group in daily.groupby(daily.date.dt.year):
        path = cache / f'{STATION_NAME}_{year}.csv'
        start, end = group.date.min(), group.date.max()
        if path.exists():
            frame = pd.read_csv(path, parse_dates=['time'])
        else:
            say(f'Fetching supplementary Davao hourly reanalysis for {year}...', flush=True)
            frame = fetch_hourly_archive(LATITUDE, LONGITUDE, start.date(), end.date())
            frame.to_csv(path, index=False)
        expected = pd.date_range(start, end + pd.Timedelta(hours=23), freq='h')
        if frame.time.duplicated().any() or not pd.DatetimeIndex(frame.time).equals(expected):
            raise ValueError(f'Incomplete hourly reanalysis for {year}.')
        chunks.append(frame)
    hourly = pd.concat(chunks, ignore_index=True)
    hourly['location'] = STATION_NAME
    hourly['latitude'], hourly['longitude'] = LATITUDE, LONGITUDE
    hourly['elevation'] = ELEVATION
    return hourly


def build_station_rows(daily_path, monthly_path=None, *, say=print):
    daily, audit = read_observations(daily_path)
    audit['source_sha256'] = hashlib.sha256(Path(daily_path).read_bytes()).hexdigest()
    if monthly_path:
        monthly, _ = read_observations(monthly_path, monthly=True)
        audit['monthly_check'] = monthly_check(daily, monthly)
    hourly = station_hourly(daily, say=say)
    labels = simulate_outbreaks(hourly, to_daily(hourly), location=STATION_NAME, seed=RANDOM_SEED)
    predictors = to_daily(hourly).set_index('date')
    observed = daily.set_index('date')
    mapping = {'TMAX': 't_max', 'TMIN': 't_min', 'TMEAN': 't_mean',
               'RH': 'rh_mean', 'RAINFALL': 'precip_sum', 'WIND_SPEED': 'wind_mean'}
    for source, target in mapping.items():
        values = observed[source].reindex(predictors.index)
        if source == 'WIND_SPEED':
            values = values * 3.6  # station m/s -> default Open-Meteo km/h
        predictors[target] = values.combine_first(predictors[target])
    direction = observed['WIND_DIRECTION'].reindex(predictors.index)
    direction_radians = np.radians(direction.to_numpy(dtype=float))
    wind_u = pd.Series(np.sin(direction_radians), index=predictors.index)
    wind_v = pd.Series(np.cos(direction_radians), index=predictors.index)
    predictors['wind_u'] = wind_u.combine_first(predictors['wind_u'])
    predictors['wind_v'] = wind_v.combine_first(predictors['wind_v'])
    predictors['t_range'] = predictors.t_max - predictors.t_min
    predictors['dew_depression'] = predictors.t_min - predictors.dew_mean
    predictors['et0'] = (0.0135 * (predictors.t_mean + 17.8) * predictors.radiation_mj * 0.408).clip(lower=0)
    predictors['rain_day'] = (predictors.precip_sum >= 1).astype(int)
    rows = build_features(predictors.reset_index()).merge(labels, on='date', validate='one_to_one')
    audit.update({'training_rows': len(rows), 'trace_policy': 'rainfall <0.1 mm approximated as 0 mm',
                  'wind_conversion': 'PAGASA m/s multiplied by 3.6 to Open-Meteo km/h',
                  'observed_predictors': list(mapping.values()) + ['wind_u', 'wind_v'],
                  'other_predictors': 'Same-point Open-Meteo hourly reanalysis; not station observations',
                  'labels': 'Existing epidemiological simulation on same-point hourly reanalysis; no observed disease labels',
                  'limitation': 'Hybrid daily predictors and reanalysis-only labels may differ; real field validation required.'})
    return rows, audit
