"""
Alert generation. Every alert the app sends is created here from real data -
no hardcoded sample text - built around these events:

  CRITICAL  - a farmer reports a positive scan (notify_report)
  WARNING   - humidity crosses the disease's spread threshold (notify_weather_risk)
  INFO      - prevailing wind direction shifts (notify_wind_shift)
  CRITICAL  - Kagawad/Admin broadcasts a confirmed outbreak (notify_broadcast)
  SUCCESS   - a farm reports recovery (notify_recovery, wired in Phase 3)
  WARNING/  - a registered farm's own live weather crosses a risk line
  INFO        (notify_farm_weather; thresholds in alerts/weather_monitor.py)
"""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone

from .models import Alert

User = get_user_model()

MANAGEMENT_ROLES = ('KAGAWAD', 'MAO_ADMIN')

# How long an identical alert (same hotspot + title) is suppressed for after
# being sent, so an on-demand weather refresh doesn't spam a fresh alert
# every time someone opens the map.
DEDUPE_WINDOW = timedelta(hours=6)


def _disease_label(scan):
    return scan.get_detected_disease_display()


def _recently_sent(hotspot, title):
    return Alert.objects.filter(
        hotspot=hotspot,
        title=title,
        created_at__gte=timezone.now() - DEDUPE_WINDOW,
    ).exists()


def _recently_sent_to(hotspot, title, recipient_id):
    return Alert.objects.filter(
        hotspot=hotspot,
        title=title,
        recipient_id=recipient_id,
        created_at__gte=timezone.now() - DEDUPE_WINDOW,
    ).exists()


def _bulk_create(recipients, hotspot, title, message, severity):
    alerts = [
        Alert(recipient=user, hotspot=hotspot, title=title, message=message, severity=severity)
        for user in recipients
    ]
    return len(Alert.objects.bulk_create(alerts))


def _recently_sent_generic(recipient_id, title):
    """Dedupe for alerts not tied to a hotspot (the farm-weather monitor):
    one alert of a given title per recipient per DEDUPE_WINDOW, however many
    farms or polls trip the same condition in that window."""
    return Alert.objects.filter(
        recipient_id=recipient_id,
        hotspot__isnull=True,
        title=title,
        created_at__gte=timezone.now() - DEDUPE_WINDOW,
    ).exists()


def _management_recipients(reporter):
    """
    Kagawad/Admin to notify about something happening near `reporter`.
    Barangay is free-text (typed in at registration, not a fixed list), so an
    exact match can easily miss a real match over a typo or stray whitespace -
    this narrows as far as it can but never returns nobody: a report that
    matches no one exactly still reaches every Kagawad/Admin in the system
    rather than vanishing silently.
    """
    barangay = (reporter.barangay or '').strip()
    municipality = (reporter.municipality or '').strip()

    if barangay and municipality:
        recipients = User.objects.filter(
            role__in=MANAGEMENT_ROLES, barangay__iexact=barangay, municipality__iexact=municipality,
        )
        if recipients.exists():
            return recipients

    if municipality:
        recipients = User.objects.filter(role__in=MANAGEMENT_ROLES, municipality__iexact=municipality)
        if recipients.exists():
            return recipients

    return User.objects.filter(role__in=MANAGEMENT_ROLES)


def notify_report(hotspot):
    """A farmer reported a positive scan - notify the nearest Kagawad/Admin."""
    scan = hotspot.scan
    reporter = scan.reporter
    title = 'Critical Outbreak'
    message = (
        f"{_disease_label(scan)} Detected in Brgy. {reporter.barangay} — "
        f"quarantine measures recommended."
    )
    return _bulk_create(_management_recipients(reporter), hotspot, title, message, 'CRITICAL')


def notify_broadcast(hotspot, scope):
    """Kagawad/Admin manually broadcasts a confirmed outbreak to farmers."""
    scan = hotspot.scan
    reporter = scan.reporter
    title = 'Critical Outbreak'
    message = (
        f"{_disease_label(scan)} Detected in Brgy. {reporter.barangay} — "
        f"quarantine measures recommended."
    )
    recipients = User.objects.filter(role='FARMER')
    if scope == 'BARANGAY':
        recipients = recipients.filter(barangay__iexact=reporter.barangay, municipality__iexact=reporter.municipality)
    elif scope == 'MUNICIPALITY':
        recipients = recipients.filter(municipality__iexact=reporter.municipality)
    # scope == 'ALL' -> no extra filter
    return _bulk_create(recipients, hotspot, title, message, 'CRITICAL')


def _weather_area_recipients(reporter):
    """
    Everyone who should hear about the weather around `reporter`'s location:
    management (see _management_recipients) *plus* every farmer in the same
    municipality. Weather risk is every role's concern, not just management's -
    a farmer needs to know the wind shifted toward their field as much as a
    Kagawad does.
    """
    municipality = (reporter.municipality or '').strip()
    farmers = User.objects.filter(role='FARMER')
    if municipality:
        farmers = farmers.filter(municipality__iexact=municipality)

    seen = set()
    recipients = []
    for user in [*_management_recipients(reporter), *farmers]:
        if user.pk not in seen:
            seen.add(user.pk)
            recipients.append(user)
    return recipients


def notify_weather_risk(hotspot, weather, threshold):
    """Humidity around an active hotspot crossed the disease's spread threshold."""
    title = 'Weather Risk'
    if _recently_sent(hotspot, title):
        return 0
    reporter = hotspot.scan.reporter
    is_fungal = hotspot.scan.detected_disease == 'BLAST'
    message = (
        f"High Humidity Advisory — {reporter.municipality.title()} humidity exceeds "
        f"{weather['humidity']:.0f}%, optimal for {'fungal' if is_fungal else 'bacterial'} spread."
    )
    return _bulk_create(_weather_area_recipients(reporter), hotspot, title, message, 'WARNING')


def notify_wind_shift(hotspot, new_cardinal):
    """Prevailing wind direction around an active hotspot changed."""
    title = 'Dispersal Update'
    if _recently_sent(hotspot, title):
        return 0
    message = f"Wind Shift Notification — Prevailing winds shifted {new_cardinal}; spore cone updated."
    reporter = hotspot.scan.reporter
    return _bulk_create(_weather_area_recipients(reporter), hotspot, title, message, 'INFO')


def notify_incoming_spread(hotspot, in_cone_farms, out_of_cone_farms):
    """Heat Map Mode prediction results: a CRITICAL warning for farms in the
    projected downwind path, an INFO all-clear for nearby farms outside it."""
    disease_label = _disease_label(hotspot.scan)
    title_in = 'Incoming Outbreak Warning'
    title_out = 'Spread Forecast — You Are Clear'
    notified = 0

    for farm in in_cone_farms:
        if _recently_sent_to(hotspot, title_in, farm.farmer_id):
            continue
        message = (
            f"Winds are carrying {disease_label} toward your farm in Brgy. {farm.farmer.barangay}. "
            f"Prepare now: cover seedbeds, avoid irrigation runoff from affected fields, "
            f"and inspect your leaves daily for the next few days."
        )
        Alert.objects.create(recipient=farm.farmer, hotspot=hotspot, title=title_in, message=message, severity='CRITICAL')
        notified += 1

    for farm in out_of_cone_farms:
        if _recently_sent_to(hotspot, title_out, farm.farmer_id):
            continue
        message = (
            f"Current wind patterns show your farm in Brgy. {farm.farmer.barangay} is outside the "
            f"projected spread path of the nearby {disease_label} outbreak. Stay alert and keep monitoring."
        )
        Alert.objects.create(recipient=farm.farmer, hotspot=hotspot, title=title_out, message=message, severity='INFO')
        notified += 1

    return notified


def _farm_weather_recipients(farm):
    """
    Who hears about one farm's weather: the farm's own farmer, plus every
    Kagawad/Admin in the same municipality (falling back to all Kagawad/Admin
    if none match) so management still sees area-wide conditions. Every role
    is covered - the farmer directly, management by area.
    """
    farmer = farm.farmer
    municipality = (farmer.municipality or '').strip()

    managers = User.objects.filter(role__in=MANAGEMENT_ROLES)
    if municipality:
        scoped = managers.filter(municipality__iexact=municipality)
        managers = scoped if scoped.exists() else managers

    seen = set()
    recipients = []
    for user in [farmer, *managers]:
        if user.pk not in seen:
            seen.add(user.pk)
            recipients.append(user)
    return recipients


def notify_farm_weather(farm, events):
    """
    Create alerts for a farm's just-detected weather events (built by
    alerts.weather_monitor.evaluate_farm_weather). Per-recipient/per-title
    deduping keeps a persistent condition from re-alerting every check.
    Returns the number of Alert rows created.
    """
    if not events:
        return 0

    recipients = _farm_weather_recipients(farm)
    return _fan_out_weather_events(recipients, events)


def notify_area_weather(municipality, events):
    """
    Create alerts for a whole municipality's just-detected weather events -
    to EVERY user registered there, all roles, farm or no farm. This is the
    automatic area advisory (Carmen + Asuncion). Per-recipient/per-title
    deduping means a user who already got, say, 'High Humidity' from their
    own farm check in the last window is not alerted twice.
    """
    if not events:
        return 0

    recipients = User.objects.filter(municipality__iexact=(municipality or '').strip())
    return _fan_out_weather_events(recipients, events)


def _fan_out_weather_events(recipients, events):
    recipients = list(recipients)
    created = 0
    for event in events:
        fresh = [r for r in recipients if not _recently_sent_generic(r.pk, event['title'])]
        if fresh:
            created += _bulk_create(fresh, None, event['title'], event['message'], event['severity'])
    return created


def notify_recovery(hotspot, recovery_percent):
    """A farm reports recovery from a confirmed outbreak (Phase 3)."""
    scan = hotspot.scan
    reporter = scan.reporter
    title = 'Resolution'
    message = (
        f"Treatment Success — Farm {reporter.username} reports {recovery_percent:.0f}% "
        f"recovery from {_disease_label(scan)}."
    )
    return _bulk_create(_management_recipients(reporter), hotspot, title, message, 'SUCCESS')
