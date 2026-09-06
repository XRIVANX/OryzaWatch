import math

from django.conf import settings
from django.db import models

# Mean Earth radius (km) - good enough for municipal-scale farm boundaries.
EARTH_RADIUS_KM = 6371.0


def polygon_area_hectares(points):
    """
    Area of a lat/lng polygon in hectares, via an equirectangular projection
    (flat-earth approximation centered on the polygon) then the shoelace
    formula. Accurate to a fraction of a percent at the scale of a single
    farm - nowhere near enough error to matter for a dosage calculation.

    `points` is a list of [lat, lng] pairs. Returns 0.0 for fewer than 3
    points (not a closed shape).
    """
    if not points or len(points) < 3:
        return 0.0

    lat0 = sum(p[0] for p in points) / len(points)
    lat0_rad = math.radians(lat0)
    km_per_deg_lat = math.radians(1) * EARTH_RADIUS_KM
    km_per_deg_lng = math.radians(1) * EARTH_RADIUS_KM * math.cos(lat0_rad)

    xy = [((p[1]) * km_per_deg_lng, (p[0]) * km_per_deg_lat) for p in points]

    area_km2 = 0.0
    n = len(xy)
    for i in range(n):
        x1, y1 = xy[i]
        x2, y2 = xy[(i + 1) % n]
        area_km2 += x1 * y2 - x2 * y1
    area_km2 = abs(area_km2) / 2.0

    return round(area_km2 * 100.0, 4)  # 1 km^2 = 100 hectares


class Farm(models.Model):
    """
    A farmer's registered field: a GPS pin, an optional drawn boundary, and
    its size. Required before a FARMER account can use the rest of the app
    (enforced client-side by the mobile onboarding gate) and is the source
    of truth for the MAO web dashboard's Disease Map and for the per-hectare
    dosage calculator.
    """
    farmer = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='farm',
    )

    # The pin - required.
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)

    # The drawn boundary - a closed ring of [lat, lng] points. Optional (a
    # farmer may submit just a pin), but when present it is the source of
    # truth for size_hectares.
    boundary = models.JSONField(null=True, blank=True)

    # Farmer-entered estimate. Overwritten by the boundary-derived area on
    # save whenever a boundary is present (see save()) so the two numbers
    # never disagree - the manual figure only "wins" when there's no
    # boundary to measure from.
    size_hectares = models.FloatField()

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if self.boundary and len(self.boundary) >= 3:
            computed = polygon_area_hectares(self.boundary)
            if computed > 0:
                self.size_hectares = computed
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.farmer.username}'s farm ({self.size_hectares:.2f} ha)"


class FarmWeather(models.Model):
    """
    Last observed weather at a farm's pin. One row per farm, overwritten in
    place on every check. Its only job is to give the farm-weather monitor
    (alerts/weather_monitor.py) a "previous reading" to compare against, so it
    can fire an alert the moment humidity/temperature crosses a risk line, the
    wind swings round, rain starts, or the general conditions change - rather
    than re-alerting on every poll while a condition simply persists.
    """
    farm = models.OneToOneField(Farm, on_delete=models.CASCADE, related_name='weather_state')

    temperature = models.FloatField()
    humidity = models.FloatField()
    wind_speed = models.FloatField()
    wind_direction_deg = models.IntegerField()
    wind_cardinal = models.CharField(max_length=10, default='N')
    precipitation = models.FloatField(default=0.0)
    condition = models.CharField(max_length=30, default='Unknown')

    checked_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.farm.farmer.username}'s farm weather @ {self.checked_at:%Y-%m-%d %H:%M}"
