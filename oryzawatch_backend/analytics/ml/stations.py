"""Import semicolon station exports without inventing weather across gaps."""
from pathlib import Path
import hashlib

import numpy as np
import pandas as pd

from .config import DATA_DIR, HOURLY_CACHE_DIR, HOURLY_VARIABLES, RANDOM_SEED
from .epidemiology import simulate_outbreaks
from .features import build_features
from .sources import to_daily

PREFIXES = ('DATE/TIME', 'AIR TEMPERATURE', 'AIR HUMIDITY', 'RAINFALL AMOUNT',
            'RAIN AMOUNT IN 1MIN', 'WIND SPEED', 'WIND DIRECTION',
            'SOLAR RADIATION', 'DEW POINT')


def read_station(path):
    """Convert interval observations to hours; retain only well-covered hours."""
    path = Path(path)
    with path.open(encoding='utf-8-sig') as stream:
        metadata = [next(stream).strip().split(';') for _ in range(5)]
    with path.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    report = {'file': path.name, 'sha256': digest,
              'station': metadata[0][1], 'rows': 0}
    chunks = list(pd.read_csv(path, sep=';', skiprows=5, encoding='utf-8-sig',
                             usecols=lambda c: c.startswith(PREFIXES), chunksize=200_000, dtype=str))
    raw = pd.concat(chunks, ignore_index=True)
    report['rows'] = len(raw)
    report['valid_measurements'] = {c: int(raw[c].notna().sum()) for c in raw if not c.startswith('DATE/TIME')}
    def pick(prefix):
        columns = [c for c in raw if c.startswith(prefix)]
        return pd.to_numeric(raw[columns[0]], errors='coerce') if columns else pd.Series(np.nan, index=raw.index)
    time = pd.to_datetime(raw.iloc[:, 0], errors='coerce')
    frame = pd.DataFrame({'time': time, 'temperature_2m': pick('AIR TEMPERATURE'),
                          'relative_humidity_2m': pick('AIR HUMIDITY'),
                          'shortwave_radiation': pick('SOLAR RADIATION')})
    frame['precipitation'] = pick('RAINFALL AMOUNT').combine_first(pick('RAIN AMOUNT IN 1MIN'))
    frame['wind_speed_10m'] = pick('WIND SPEED (kph)').combine_first(pick('WIND SPEED IN 1MIN') * 3.6)
    direction = pick('WIND DIRECTION (').combine_first(pick('WIND DIRECTION IN 1MIN'))
    frame['wind_u'] = np.sin(np.radians(direction.where(direction.between(0, 360))))
    frame['wind_v'] = np.cos(np.radians(direction.where(direction.between(0, 360))))
    bounds = {'temperature_2m': (-10, 55), 'relative_humidity_2m': (1, 100),
              'shortwave_radiation': (0, 1500), 'precipitation': (0, 300), 'wind_speed_10m': (0, 200)}
    report['invalid_measurements'] = {}
    for column, (low, high) in bounds.items():
        invalid = frame[column].notna() & ~frame[column].between(low, high)
        report['invalid_measurements'][column] = int(invalid.sum())
        frame.loc[invalid, column] = np.nan
    report['invalid_timestamps'] = int(time.isna().sum())
    frame = frame.dropna(subset=['time']).sort_values('time')
    report['duplicate_timestamps'] = int(frame.time.duplicated().sum())
    frame = frame.drop_duplicates('time', keep='first').set_index('time')
    if frame.empty or frame[['temperature_2m', 'relative_humidity_2m']].count().min() == 0:
        report['exclusion'] = 'Missing temperature or humidity; rainfall/water-level alone is insufficient.'
        return None, report
    cadence = frame.index.to_series().diff().dt.total_seconds().median()
    if not np.isfinite(cadence) or not 30 <= cadence <= 3600:
        report['exclusion'] = 'Insufficient or unsupported observation frequency.'
        return None, report
    minimum = max(1, int(np.ceil(0.8 * 3600 / cadence)))
    report['cadence_seconds'] = float(cadence)
    report['minimum_readings_per_hour'] = minimum
    counts = frame.resample('h').count()
    hourly = frame.resample('h').mean()
    hourly['precipitation'] = frame.precipitation.resample('h').sum(min_count=1)
    good = counts.ge(minimum).all(axis=1)
    hourly = hourly.where(counts.ge(minimum))
    hourly['wind_direction_10m'] = np.degrees(np.arctan2(hourly.wind_u, hourly.wind_v)) % 360
    # Dew point derived from temperature/RH; never use a missing dew sensor as zero.
    gamma = np.log(hourly.relative_humidity_2m / 100) + 17.625 * hourly.temperature_2m / (243.04 + hourly.temperature_2m)
    hourly['dew_point_2m'] = 243.04 * gamma / (17.625 - gamma)
    hourly = hourly[list(HOURLY_VARIABLES)].reset_index()
    hourly['latitude'], hourly['longitude'], hourly['elevation'] = [float(metadata[i][1]) for i in (1, 2, 3)]
    report['usable_hours'] = int(good.sum())
    return hourly, report


def supplement_from_cache(hourly, report):
    """Use only existing reanalysis within 1 km; explicitly audit substituted hours."""
    caches = [(HOURLY_CACHE_DIR, 'CARMEN', 7.36, 125.70),
              (DATA_DIR / 'pagasa_davao' / 'hourly', 'DAVAO_CITY', 7.127577, 125.654969)]
    lat, lon = hourly.latitude.iloc[0], hourly.longitude.iloc[0]
    for directory, name, cache_lat, cache_lon in caches:
        distance = 111 * np.hypot(lat - cache_lat, (lon - cache_lon) * np.cos(np.radians(lat)))
        paths = sorted(directory.glob(f'{name}_*.csv'))
        if distance > 1 or not paths:
            continue
        reference = pd.concat([pd.read_csv(p, parse_dates=['time']) for p in paths]).set_index('time').sort_index()
        reference = reference.loc[reference.index.to_series().between(hourly.time.min(), hourly.time.max()).to_numpy()]
        if reference.empty:
            continue
        observed = hourly.set_index('time').reindex(reference.index)
        report['observed_hours_by_variable'] = {c: int(observed[c].notna().sum()) for c in HOURLY_VARIABLES}
        report['supplement'] = {'source': f'Cached Open-Meteo {name}', 'distance_km': round(float(distance), 3),
                                'hours': len(reference), 'filled_hours_by_variable': {c: int(observed[c].isna().sum()) for c in HOURLY_VARIABLES}}
        for column in HOURLY_VARIABLES:
            reference[column] = observed[column].combine_first(reference[column])
        # Keep derived dew point consistent with the blended temperature/RH.
        gamma = np.log(reference.relative_humidity_2m / 100) + 17.625 * reference.temperature_2m / (243.04 + reference.temperature_2m)
        reference['dew_point_2m'] = 243.04 * gamma / (17.625 - gamma)
        reference['latitude'], reference['longitude'], reference['elevation'] = lat, lon, hourly.elevation.iloc[0]
        report['canonical_location'] = name
        return reference.reset_index()
    return hourly


def build_station_table(directory, *, say=print, min_segment_days=120):
    parts, reports = [], []
    files = sorted(Path(directory).glob('*.csv'))
    if not files:
        raise ValueError('No CSV station files found.')
    for index, path in enumerate(files, 1):
        say(f'[{index}/{len(files)}] {path.name}', flush=True)
        hourly, report = read_station(path)
        reports.append(report)
        if hourly is None:
            continue
        hourly = supplement_from_cache(hourly, report)
        # A complete day has all 24 hours and every required weather variable.
        complete = hourly[list(HOURLY_VARIABLES)].notna().all(axis=1)
        hours_per_day = complete.groupby(hourly.time.dt.normalize()).sum()
        good_dates = hours_per_day.index[hours_per_day.eq(24)]
        report['complete_days'] = len(good_dates)
        groups = pd.Series(good_dates, index=good_dates).diff().ne(pd.Timedelta(days=1)).cumsum()
        report['segments'] = []
        for number, (_, dates) in enumerate(groups.groupby(groups), 1):
            if len(dates) < min_segment_days:
                continue
            name = report.get('canonical_location', f'STATION_{path.name.split("_")[0]}_{number}')
            segment = hourly.loc[hourly.time.dt.normalize().isin(dates.index)].copy()
            segment['location'] = name
            daily = to_daily(segment)
            labels = simulate_outbreaks(segment, daily, location=name, seed=RANDOM_SEED)
            rows = build_features(daily).merge(labels, on='date', validate='one_to_one')
            parts.append(rows)
            report['segments'].append({'location': name, 'start': str(dates.index.min().date()),
                                       'end': str(dates.index.max().date()), 'training_rows': len(rows)})
        if not report['segments']:
            report['exclusion'] = f'No continuous run of {min_segment_days} complete days.'
    if not parts:
        raise ValueError('No stations have enough continuous complete weather history.')
    table = pd.concat(parts, ignore_index=True).sort_values(['date', 'location']).reset_index(drop=True)
    audit = {'stations': reports, 'files': len(files), 'training_rows': len(table),
             'policies': {'timezone': 'Asia/Manila; source timestamps treated as local',
                          'coverage': 'At least 80% of expected readings per hour per variable; missing values use explicitly audited cached reanalysis within 1 km when available; otherwise split at gaps',
                          'rainfall': 'Sum interval RAINFALL AMOUNT; otherwise sum RAIN AMOUNT IN 1MIN, never overlapping 1HR totals',
                          'wind': 'kph retained; m/s multiplied by 3.6; circular direction mean',
                          'dew_point': 'Magnus formula from temperature and humidity',
                          'labels': 'Existing process-based simulation, not confirmed field outbreaks',
                          'limitation': 'Station sensor height and rainfall interval semantics need provider confirmation; live inputs remain Open-Meteo'}}
    return table, audit
