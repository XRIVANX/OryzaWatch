from django.core.cache import cache
from rest_framework import generics, permissions

from .models import Alert
from .serializers import AlertSerializer
from .weather_monitor import run_all_municipality_weather_checks, run_farm_weather_check

# The automatic municipality weather sweep (Carmen + Asuncion) runs at most
# this often across all polls; each municipality is still capped to one real
# fetch per CHECK_INTERVAL, so this is a cheap no-op most of the time.
_SWEEP_LOCK_KEY = 'ow:weather-sweep'
_SWEEP_EVERY_SECONDS = 300


def _maybe_check_weather(user):
    """
    Opportunistic, best-effort: turn any /api/alerts/ poll into a live weather
    re-check, so a farmer opening the app sees a waiting advisory even if they
    were never logged in while it built up - no task queue needed.

      * always: a throttled sweep of every monitored municipality, alerting
        every user there (all roles, farm or not);
      * plus, if the polling user has their own registered farm, a finer check
        at that farm's pin.

    Both paths are self-throttling and never raise, so this stays cheap on the
    request path and safe if the weather API is down. `manage.py check_weather`
    does the same sweep on a schedule for full-closed-app coverage.
    """
    if cache.add(_SWEEP_LOCK_KEY, 1, _SWEEP_EVERY_SECONDS):
        run_all_municipality_weather_checks()

    farm = getattr(user, 'farm', None)
    if farm is not None:
        run_farm_weather_check(farm)


class AlertListView(generics.ListAPIView):
    serializer_class = AlertSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        _maybe_check_weather(self.request.user)
        return Alert.objects.filter(recipient=self.request.user)

class AlertMarkReadView(generics.UpdateAPIView):
    serializer_class = AlertSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Alert.objects.filter(recipient=self.request.user)
