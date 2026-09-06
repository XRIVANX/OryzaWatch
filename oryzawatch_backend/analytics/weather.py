"""
Server-side weather lookup for hotspot creation and on-demand refresh.

Ports the same free, keyless Open-Meteo call the mobile app already makes
client-side (oryzawatch_mobile/src/api/weather.ts) so a hotspot's weather
snapshot (and the disease-spread estimate derived from it) can be computed
by the backend at report time and refreshed later, without needing any API
key or paid service.
"""
import logging

import requests

logger = logging.getLogger(__name__)

OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast'
REQUEST_TIMEOUT_SECONDS = 6

_COMPASS_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

# WMO weather interpretation codes -> a coarse, human-readable condition label.
# Grouped deliberately (every drizzle code -> "Drizzle") so the farm-weather
# monitor only alerts on a meaningful change of conditions, not on a shift
# from "light rain" to "moderate rain".
_WMO_CONDITIONS = {
    0: 'Clear', 1: 'Clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Fog',
    51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle', 56: 'Drizzle', 57: 'Drizzle',
    61: 'Rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Rain', 67: 'Heavy rain',
    71: 'Snow', 73: 'Snow', 75: 'Snow', 77: 'Snow',
    80: 'Rain showers', 81: 'Rain showers', 82: 'Heavy rain showers',
    85: 'Snow showers', 86: 'Snow showers',
    95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
}


def condition_label(weather_code):
    """Coarse condition name for a WMO weather code (see _WMO_CONDITIONS)."""
    try:
        return _WMO_CONDITIONS.get(int(weather_code), 'Unknown')
    except (TypeError, ValueError):
        return 'Unknown'


# Used only if the live call fails - a hotspot report must never be blocked
# by a flaky third-party API. Deliberately unremarkable "average day" values.
FALLBACK_WEATHER = {
    'temperature': 30.0,
    'humidity': 75.0,
    'wind_speed': 10.0,
    'wind_direction_deg': 90,
    'wind_cardinal': 'E',
    'precipitation': 0.0,
    'weather_code': 1,
    'condition': 'Clear',
}

# Base spread rate (km/day) and the humidity level (%) at which each disease
# is considered to be spreading fast, per the biology supplied for this
# feature: Rice Blast needs sustained free moisture (~90%+ RH), BLB
# multiplies rapidly above ~70% RH. Illustrative constants, not a
# peer-reviewed epidemiological model - tune freely.
DISEASE_SPREAD_PROFILE = {
    'BLB': {'base_km_per_day': 1.0, 'humidity_threshold': 70.0},
    'BLAST': {'base_km_per_day': 1.5, 'humidity_threshold': 90.0},
    'BROWN_SPOT': {'base_km_per_day': 0.8, 'humidity_threshold': 80.0},
}


def _to_cardinal(degrees):
    return _COMPASS_DIRECTIONS[round((degrees % 360) / 45) % 8]


def fetch_weather(latitude, longitude):
    """
    Current conditions at a point, best-effort. Returns FALLBACK_WEATHER
    (never raises) if the request fails for any reason - a hotspot report or
    weather-refresh must proceed either way.
    """
    try:
        response = requests.get(
            OPEN_METEO_URL,
            params={
                'latitude': float(latitude),
                'longitude': float(longitude),
                'current': 'temperature_2m,relative_humidity_2m,precipitation,'
                           'weather_code,wind_speed_10m,wind_direction_10m',
                'timezone': 'Asia/Manila',
                'forecast_days': 1,
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        current = response.json().get('current') or {}
        wind_direction_deg = int(round(current['wind_direction_10m']))
        weather_code = int(current.get('weather_code') or 0)
        return {
            'temperature': float(current['temperature_2m']),
            'humidity': float(current['relative_humidity_2m']),
            'wind_speed': float(current['wind_speed_10m']),
            'wind_direction_deg': wind_direction_deg,
            'wind_cardinal': _to_cardinal(wind_direction_deg),
            'precipitation': float(current.get('precipitation') or 0.0),
            'weather_code': weather_code,
            'condition': condition_label(weather_code),
        }
    except Exception:
        logger.warning('Weather lookup failed for (%s, %s); using fallback.', latitude, longitude, exc_info=True)
        return dict(FALLBACK_WEATHER)


def compute_spread_velocity(disease, weather):
    """
    Estimated km/day expansion for a disease given current conditions.
    Humidity above the disease's threshold, plus wind and rain, each scale
    the base rate up - a simple, transparent formula (not a validated
    epidemiological model) that is enough to drive the map's spread cone and
    "km/day" figures shown to Kagawad/Admin.
    """
    profile = DISEASE_SPREAD_PROFILE.get(disease, {'base_km_per_day': 1.0, 'humidity_threshold': 75.0})
    base = profile['base_km_per_day']
    threshold = profile['humidity_threshold']

    humidity_factor = 1.0
    if weather['humidity'] >= threshold:
        humidity_factor = 1.0 + (weather['humidity'] - threshold) / 30.0
    wind_factor = 1.0 + weather['wind_speed'] / 25.0
    rain_factor = 1.0 + min(weather.get('precipitation', 0.0), 10.0) / 10.0

    return round(base * humidity_factor * wind_factor * rain_factor, 2)
