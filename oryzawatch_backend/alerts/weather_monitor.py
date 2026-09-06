"""
Automatic weather monitoring.

Two granularities, same threshold logic:

  * per municipality (Carmen + Asuncion) - the automatic area advisory. Every
    user registered in the municipality is alerted, farm or no farm, all
    roles. This is the main path.
  * per registered farm - a finer check at the farmer's own pin, for that
    farmer plus area management.

For each we periodically pull current conditions (the same free, keyless
Open-Meteo call the rest of the app uses) and turn any *risk-relevant change*
into an Alert:

  WARNING  - humidity climbs past the disease-favourable line
  WARNING  - temperature crosses a heat- or cold-stress line
  INFO     - the prevailing wind direction swings to a new cardinal
  INFO     - rain starts after a dry spell
  WARNING  - storm-strength wind or heavy rain
  INFO     - the general weather condition changes (e.g. Clear -> Rain)

Alerts fire on a *crossing* (or on the very first reading if a location is
already in an alerting state), never on every poll while a condition merely
persists - that comparison is what the stored previous reading is for
(alerts.MunicipalityWeather / farms.FarmWeather).

There is no task queue here, so this runs two ways:
  * opportunistically, whenever ANY user's app polls /api/alerts/ (the
    municipality sweep is throttled with a cache lock; each location is still
    capped to one real fetch per CHECK_INTERVAL - see alerts/views.py), so a
    farmer sees a waiting advisory the moment they open the app even if they
    never logged in while it was building, and
  * as a batch, via `manage.py check_weather` (wire to cron for coverage even
    while every app is closed).
"""
import logging

from django.utils import timezone
from datetime import timedelta

from analytics.weather import fetch_weather
from .services import notify_area_weather, notify_farm_weather

logger = logging.getLogger(__name__)

# Don't re-poll a location's weather more often than this, however many times
# an app hits /api/alerts/ in the meantime.
CHECK_INTERVAL = timedelta(minutes=15)

# Automatic municipality-wide weather monitoring. These town-centre points are
# the same ones the mobile app already uses (oryzawatch_mobile/src/api/
# weather.ts). Every municipality here is monitored on its own, and its
# advisories go to *every* user registered there - farm or no farm, all roles.
MUNICIPALITY_WEATHER_POINTS = {
    'ASUNCION': (7.45, 125.57),
    'CARMEN': (7.36, 125.70),
}

# --- Thresholds. Illustrative agronomy for lowland rice, tune freely. --------
HUMIDITY_HIGH = 85.0     # % RH - broadly favourable for fungal/bacterial spread
TEMP_HIGH = 35.0         # deg C - heat stress / spikelet sterility risk
TEMP_LOW = 18.0          # deg C - cold stress risk
RAIN_ONSET_MM = 0.5      # mm in the current interval - measurable rain
HEAVY_RAIN_MM = 7.5      # mm - heavy downpour
STORM_WIND_KMH = 38.0    # km/h - strong wind / lodging risk


def _crossed_up(previous, current, threshold):
    """True if `current` is at/above `threshold` and `previous` wasn't
    (None previous counts as 'wasn't' -> fires on the first reading)."""
    if current < threshold:
        return False
    return previous is None or previous < threshold


def _crossed_down(previous, current, threshold):
    if current > threshold:
        return False
    return previous is None or previous > threshold


def evaluate_farm_weather(previous, weather, place='your farm'):
    """
    Compare a fresh `weather` dict (from analytics.weather.fetch_weather)
    against a `previous` snapshot row (FarmWeather or MunicipalityWeather, or
    None on the first ever check) and return a list of {title, message,
    severity} for every condition that has just started applying. `place` is
    the location phrase dropped into the messages ("your farm", "Carmen"...).
    """
    prev_humidity = previous.humidity if previous else None
    prev_temp = previous.temperature if previous else None
    prev_precip = previous.precipitation if previous else None
    prev_cardinal = previous.wind_cardinal if previous else None
    prev_condition = previous.condition if previous else None

    events = []

    if _crossed_up(prev_humidity, weather['humidity'], HUMIDITY_HIGH):
        events.append({
            'title': 'High Humidity',
            'message': (
                f"Humidity has risen to {weather['humidity']:.0f}% around {place} - "
                f"conditions now favour rice disease spread. Scout your leaves and "
                f"hold off on overhead irrigation."
            ),
            'severity': 'WARNING',
        })

    if _crossed_up(prev_temp, weather['temperature'], TEMP_HIGH):
        events.append({
            'title': 'High Temperature',
            'message': (
                f"Temperature around {place} has climbed to {weather['temperature']:.0f}deg C. "
                f"Keep paddy water levels up to buffer heat stress, especially if the crop is flowering."
            ),
            'severity': 'WARNING',
        })
    elif _crossed_down(prev_temp, weather['temperature'], TEMP_LOW):
        events.append({
            'title': 'Low Temperature',
            'message': (
                f"Temperature around {place} has dropped to {weather['temperature']:.0f}deg C. "
                f"Cold stress can cause spikelet sterility - deepen paddy water to protect the crop."
            ),
            'severity': 'WARNING',
        })

    if prev_cardinal and prev_cardinal != weather['wind_cardinal']:
        events.append({
            'title': 'Wind Direction Change',
            'message': (
                f"The wind around {place} has shifted from {prev_cardinal} to {weather['wind_cardinal']} "
                f"({weather['wind_speed']:.0f} km/h). Any spores or spray drift will now "
                f"travel {weather['wind_cardinal']}."
            ),
            'severity': 'INFO',
        })

    storm = (
        weather['wind_speed'] >= STORM_WIND_KMH
        or weather['precipitation'] >= HEAVY_RAIN_MM
    )
    if storm:
        events.append({
            'title': 'Storm Warning',
            'message': (
                f"Rough weather around {place}: winds {weather['wind_speed']:.0f} km/h, "
                f"rainfall {weather['precipitation']:.1f} mm. Lodging and flash-flood risk - "
                f"check drainage and delay any field work."
            ),
            'severity': 'WARNING',
        })
    elif _crossed_up(prev_precip, weather['precipitation'], RAIN_ONSET_MM):
        events.append({
            'title': 'Rain Detected',
            'message': (
                f"Rain has started around {place} ({weather['precipitation']:.1f} mm). "
                f"Delay foliar spraying - it will wash off before it acts."
            ),
            'severity': 'INFO',
        })

    if (
        prev_condition
        and prev_condition not in ('Unknown',)
        and weather['condition'] not in ('Unknown',)
        and prev_condition != weather['condition']
    ):
        events.append({
            'title': 'Weather Condition Change',
            'message': (
                f"Conditions around {place} have changed from {prev_condition} to "
                f"{weather['condition']}."
            ),
            'severity': 'INFO',
        })

    return events


def _weather_defaults(weather):
    return {
        'temperature': weather['temperature'],
        'humidity': weather['humidity'],
        'wind_speed': weather['wind_speed'],
        'wind_direction_deg': weather['wind_direction_deg'],
        'wind_cardinal': weather['wind_cardinal'],
        'precipitation': weather['precipitation'],
        'condition': weather['condition'],
    }


def _save_state(farm, weather):
    from farms.models import FarmWeather

    FarmWeather.objects.update_or_create(farm=farm, defaults=_weather_defaults(weather))


def run_farm_weather_check(farm, *, force=False):
    """
    Check one farm's current weather and fire any resulting alerts. Returns
    the number of Alert rows created. Never raises - a flaky weather API must
    not break the caller (an /api/alerts/ list request, or a batch sweep).
    """
    from farms.models import FarmWeather

    try:
        state = FarmWeather.objects.filter(farm=farm).first()
        if state and not force and timezone.now() - state.checked_at < CHECK_INTERVAL:
            return 0

        weather = fetch_weather(farm.latitude, farm.longitude)
        events = evaluate_farm_weather(state, weather)
        created = notify_farm_weather(farm, events) if events else 0
        _save_state(farm, weather)
        return created
    except Exception:
        logger.warning('Farm weather check failed for farm %s', getattr(farm, 'pk', '?'), exc_info=True)
        return 0


def run_all_farm_weather_checks(*, force=False):
    """Sweep every registered farm. Used by `manage.py check_weather`."""
    from farms.models import Farm

    total = 0
    for farm in Farm.objects.select_related('farmer'):
        total += run_farm_weather_check(farm, force=force)
    return total


def run_municipality_weather_check(municipality, *, force=False):
    """
    Check one municipality's current weather (at its town-centre point) and
    fire any resulting advisory to *every* user registered there - no farm
    required, all roles. Self-throttled to CHECK_INTERVAL and never raises.
    Returns the number of Alert rows created.
    """
    from alerts.models import MunicipalityWeather

    key = (municipality or '').strip().upper()
    coords = MUNICIPALITY_WEATHER_POINTS.get(key)
    if not coords:
        return 0

    try:
        state = MunicipalityWeather.objects.filter(municipality=key).first()
        if state and not force and timezone.now() - state.checked_at < CHECK_INTERVAL:
            return 0

        weather = fetch_weather(*coords)
        events = evaluate_farm_weather(state, weather, place=key.title())
        created = notify_area_weather(key, events) if events else 0
        MunicipalityWeather.objects.update_or_create(municipality=key, defaults=_weather_defaults(weather))
        return created
    except Exception:
        logger.warning('Municipality weather check failed for %s', municipality, exc_info=True)
        return 0


def run_all_municipality_weather_checks(*, force=False):
    """Sweep every monitored municipality (Carmen + Asuncion). Runs from an
    /api/alerts/ poll (throttled) and from `manage.py check_weather`."""
    return sum(
        run_municipality_weather_check(m, force=force)
        for m in MUNICIPALITY_WEATHER_POINTS
    )
