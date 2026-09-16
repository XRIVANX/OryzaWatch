"""
Open-Meteo data access for the disease forecast model.

Two endpoints, one shape. The archive endpoint supplies the five years of
hourly history the model trains on; the forecast endpoint supplies the recent
past plus the coming days it predicts on. Both are free and keyless - the same
service analytics/weather.py already uses for live conditions.

Everything downstream consumes *hourly* frames, so the pipeline never depends
on which daily aggregates a particular endpoint happens to publish: the daily
table is derived here, identically for history and forecast (see `to_daily`),
which is what keeps training and inference consistent.
"""
from __future__ import annotations

import logging
import time
from datetime import date, timedelta

import numpy as np
import pandas as pd
import requests

from .config import (
    ARCHIVE_LAG_DAYS,
    ARCHIVE_URL,
    FORECAST_URL,
    HOURLY_CACHE_DIR,
    HOURLY_VARIABLES,
    REQUEST_TIMEOUT_SECONDS,
    TIMEZONE,
)

logger = logging.getLogger(__name__)

MAX_RETRIES = 4
RETRY_BACKOFF_SECONDS = 5
POLITE_DELAY_SECONDS = 1.0


class WeatherFetchError(RuntimeError):
    """Open-Meteo could not be reached, or returned something unusable."""


def _request(url, params):
    """GET with backoff. Open-Meteo rate-limits rather than failing hard, so a
    429/5xx is worth retrying; a 400 (bad parameters) is not."""
    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.get(url, params=params, timeout=REQUEST_TIMEOUT_SECONDS)
            if response.status_code == 400:
                raise WeatherFetchError(f'Open-Meteo rejected the request: {response.text[:300]}')
            response.raise_for_status()
            return response.json()
        except WeatherFetchError:
            raise
        except Exception as exc:
            last_error = exc
            if attempt < MAX_RETRIES:
                wait = RETRY_BACKOFF_SECONDS * attempt
                logger.warning('Open-Meteo call failed (attempt %s/%s); retrying in %ss',
                               attempt, MAX_RETRIES, wait)
                time.sleep(wait)
    raise WeatherFetchError(f'Open-Meteo unreachable after {MAX_RETRIES} attempts: {last_error}')


def _hourly_frame(payload):
    """Open-Meteo's column-oriented hourly block -> a tidy DataFrame."""
    hourly = payload.get('hourly') or {}
    if 'time' not in hourly:
        raise WeatherFetchError('Open-Meteo response contained no hourly block.')

    frame = pd.DataFrame(hourly)
    frame['time'] = pd.to_datetime(frame['time'])
    for column in HOURLY_VARIABLES:
        if column not in frame.columns:
            frame[column] = np.nan
        frame[column] = pd.to_numeric(frame[column], errors='coerce')
    frame['elevation'] = float(payload.get('elevation') or 0.0)
    return frame[['time', 'elevation', *HOURLY_VARIABLES]]


def archive_end_date():
    """Last archive day that is reliably complete."""
    return date.today() - timedelta(days=ARCHIVE_LAG_DAYS)


def fetch_hourly_archive(latitude, longitude, start, end):
    """Hourly reanalysis for one point over [start, end], inclusive."""
    payload = _request(ARCHIVE_URL, {
        'latitude': latitude,
        'longitude': longitude,
        'start_date': start.isoformat(),
        'end_date': end.isoformat(),
        'hourly': ','.join(HOURLY_VARIABLES),
        'timezone': TIMEZONE,
    })
    return _hourly_frame(payload)


def fetch_hourly_forecast(latitude, longitude, past_days, forecast_days):
    """Recent observed hours plus the coming forecast hours for one point."""
    payload = _request(FORECAST_URL, {
        'latitude': latitude,
        'longitude': longitude,
        'hourly': ','.join(HOURLY_VARIABLES),
        'timezone': TIMEZONE,
        'past_days': int(past_days),
        'forecast_days': int(forecast_days),
    })
    return _hourly_frame(payload)


def load_location_history(name, latitude, longitude, years, *, refresh=False, end=None):
    """
    Five (or `years`) years of hourly weather for one named location, cached a
    calendar year at a time under datasets/weather/hourly/.

    Chunking keeps each request small enough to be polite and makes a resumed
    run cheap: only the year still moving (the current one) is re-downloaded,
    and only when `refresh` is set or its cache stops short of the window.
    """
    end = end or archive_end_date()
    start = end - timedelta(days=365 * years)
    HOURLY_CACHE_DIR.mkdir(parents=True, exist_ok=True)

    chunks = []
    for year in range(start.year, end.year + 1):
        chunk_start = max(start, date(year, 1, 1))
        chunk_end = min(end, date(year, 12, 31))
        if chunk_start > chunk_end:
            continue

        cache_path = HOURLY_CACHE_DIR / f'{name}_{year}.csv'
        if cache_path.exists() and not refresh:
            cached = pd.read_csv(cache_path, parse_dates=['time'])
            covered = cached['time'].max().date() if len(cached) else None
            if covered is not None and covered >= chunk_end:
                chunks.append(cached)
                continue

        logger.info('Fetching %s %s (%s -> %s)', name, year, chunk_start, chunk_end)
        frame = fetch_hourly_archive(latitude, longitude, chunk_start, chunk_end)
        frame.to_csv(cache_path, index=False)
        chunks.append(frame)
        time.sleep(POLITE_DELAY_SECONDS)

    if not chunks:
        raise WeatherFetchError(f'No history could be assembled for {name}.')

    history = pd.concat(chunks, ignore_index=True)
    history = history.drop_duplicates(subset='time').sort_values('time').reset_index(drop=True)
    history['location'] = name
    history['latitude'] = latitude
    history['longitude'] = longitude
    return history


# --- Hourly -> daily --------------------------------------------------------
# The single aggregation used by BOTH training and live inference. It produces
# only coarse daily statistics - the kind any weather forecast publishes. The
# fine-grained hourly quantities that actually drive infection (leaf-wetness
# duration, the hour-by-hour temperature *during* that wetness) are computed
# separately in epidemiology.py and are used ONLY to build labels, never as
# model inputs. That asymmetry is deliberate: the model has to infer a latent
# hourly process from daily summaries, which is exactly the job it does in
# production against a daily forecast.

RAIN_DAY_MM = 1.0   # a day that counts as "rained" for streak features
WET_HOUR_MM = 0.1   # hourly precipitation that counts as measurable


def to_daily(hourly):
    """
    Collapse an hourly frame to one row per calendar day: the daily predictors
    the model is allowed to see, plus identifying columns.
    """
    frame = hourly.copy()
    frame['date'] = frame['time'].dt.normalize()

    temp = frame['temperature_2m']
    dew = frame['dew_point_2m']
    # Vapour-pressure deficit (kPa) via Tetens - the drying power of the air,
    # a sharper spore-survival signal than relative humidity alone.
    svp = 0.6108 * np.exp((17.27 * temp) / (temp + 237.3))
    avp = 0.6108 * np.exp((17.27 * dew) / (dew + 237.3))
    frame['vpd'] = (svp - avp).clip(lower=0)

    # Wind direction must be averaged as a vector; a plain mean of 350 and 10
    # degrees gives 180, the exact opposite of the truth.
    radians = np.radians(frame['wind_direction_10m'])
    frame['wind_u'] = np.sin(radians)
    frame['wind_v'] = np.cos(radians)
    frame['rain_hour'] = (frame['precipitation'] >= WET_HOUR_MM).astype(float)

    grouped = frame.groupby('date', sort=True)
    daily = pd.DataFrame({
        't_max': grouped['temperature_2m'].max(),
        't_min': grouped['temperature_2m'].min(),
        't_mean': grouped['temperature_2m'].mean(),
        't_std': grouped['temperature_2m'].std(),
        'rh_max': grouped['relative_humidity_2m'].max(),
        'rh_min': grouped['relative_humidity_2m'].min(),
        'rh_mean': grouped['relative_humidity_2m'].mean(),
        'dew_mean': grouped['dew_point_2m'].mean(),
        'vpd_mean': grouped['vpd'].mean(),
        'vpd_max': grouped['vpd'].max(),
        'precip_sum': grouped['precipitation'].sum(),
        'precip_max_hourly': grouped['precipitation'].max(),
        'precip_hours': grouped['rain_hour'].sum(),
        'wind_mean': grouped['wind_speed_10m'].mean(),
        'wind_max': grouped['wind_speed_10m'].max(),
        'wind_u': grouped['wind_u'].mean(),
        'wind_v': grouped['wind_v'].mean(),
        'radiation_sum': grouped['shortwave_radiation'].sum(),
        'hours_observed': grouped['temperature_2m'].count(),
    }).reset_index()

    daily['t_range'] = daily['t_max'] - daily['t_min']
    # Dew-point depression: how close the air sits to saturation overnight.
    daily['dew_depression'] = daily['t_min'] - daily['dew_mean']
    # Radiation as MJ/m2/day, then the radiation-based Hargreaves (1975)
    # reference evaporation, ET0 = 0.0135 (T + 17.8) Rs with Rs in mm/day of
    # evaporation equivalent (MJ x 0.408). Enough to drive a water-balance
    # feature without a full Penman-Monteith.
    daily['radiation_mj'] = daily['radiation_sum'] * 0.0036
    daily['et0'] = (
        0.0135 * (daily['t_mean'] + 17.8) * daily['radiation_mj'] * 0.408
    ).clip(lower=0)
    daily['rain_day'] = (daily['precip_sum'] >= RAIN_DAY_MM).astype(int)

    for column in ('location', 'latitude', 'longitude', 'elevation'):
        if column in hourly.columns:
            daily[column] = hourly[column].iloc[0]

    # Drop partial days at the edges of a fetch window.
    daily = daily[daily['hours_observed'] >= 20].reset_index(drop=True)
    return daily


def fetch_hourly_forecast_many(points, past_days, forecast_days):
    """
    One Open-Meteo call for several (latitude, longitude) points. Returns one
    hourly frame per point, in input order, each tagged with its coordinates.
    """
    if not points:
        return []
    payload = _request(FORECAST_URL, {
        'latitude': ','.join(f'{lat:.4f}' for lat, _ in points),
        'longitude': ','.join(f'{lng:.4f}' for _, lng in points),
        'hourly': ','.join(HOURLY_VARIABLES),
        'timezone': TIMEZONE,
        'past_days': int(past_days),
        'forecast_days': int(forecast_days),
    })
    # A single point comes back as an object, several as a list.
    payloads = payload if isinstance(payload, list) else [payload]
    if len(payloads) != len(points):
        raise WeatherFetchError(f'Expected {len(points)} locations from Open-Meteo, got {len(payloads)}.')

    frames = []
    for (latitude, longitude), item in zip(points, payloads):
        frame = _hourly_frame(item)
        frame['latitude'] = latitude
        frame['longitude'] = longitude
        frames.append(frame)
    return frames
