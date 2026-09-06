from django.db import models
from django.conf import settings

class Alert(models.Model):
    SEVERITY_CHOICES = (
        ('INFO', 'Info'),
        ('WARNING', 'Warning'),
        ('CRITICAL', 'Critical'),
        ('SUCCESS', 'Success'),
    )
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='alerts')
    hotspot = models.ForeignKey('analytics.DiseaseHotspot', on_delete=models.CASCADE, null=True, blank=True, related_name='alerts')
    title = models.CharField(max_length=150)
    message = models.TextField()
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='WARNING')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class MunicipalityWeather(models.Model):
    """
    Last observed weather for a whole municipality (Carmen / Asuncion). It is
    the reference point the automatic area weather monitor
    (alerts/weather_monitor.py) compares against, so an advisory fires the
    moment conditions cross a risk line - and reaches every user registered in
    that municipality, farm or no farm.
    """
    municipality = models.CharField(max_length=50, unique=True)

    temperature = models.FloatField()
    humidity = models.FloatField()
    wind_speed = models.FloatField()
    wind_direction_deg = models.IntegerField()
    wind_cardinal = models.CharField(max_length=10, default='N')
    precipitation = models.FloatField(default=0.0)
    condition = models.CharField(max_length=30, default='Unknown')

    checked_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.municipality} weather @ {self.checked_at:%Y-%m-%d %H:%M}"