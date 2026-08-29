from django.db import models
from diagnostics.models import LeafScan

class DiseaseHotspot(models.Model):
    STATUS_CHOICES = (
        ('CRITICAL', 'Critical Outbreak'),
        ('AT_RISK', 'At Risk Zone'),
        ('MONITORING', 'Monitoring'),
        ('RESOLVED', 'Resolved / Inactive'),
    )

    # One scan can produce exactly one hotspot tracking profile
    scan = models.OneToOneField(LeafScan, on_delete=models.CASCADE, related_name='hotspot')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='CRITICAL')
    
    # Environmental snapshots fetched via OpenWeatherMap API during prediction
    temperature = models.FloatField()
    humidity = models.FloatField()
    wind_speed = models.FloatField()         # in km/h or m/s
    wind_direction_deg = models.IntegerField() # Wind heading angle 0-360 degrees for cone calculation
    wind_cardinal = models.CharField(max_length=10, default='N') # e.g., 'NE', 'WSW'
    
    # Spread configuration variables computed by your project algorithm
    spread_velocity = models.FloatField(default=0.0) # Estimated km per day expansion
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Hotspot {self.id}: {self.scan.detected_disease} - Status: {self.status}"


class ForecastPrediction(models.Model):
    """A downwind disease forecast and its later field verification."""
    predicted_disease = models.CharField(max_length=20)
    predicted_at = models.DateTimeField()
    forecast_latitude = models.DecimalField(max_digits=9, decimal_places=6)
    forecast_longitude = models.DecimalField(max_digits=9, decimal_places=6)
    forecast_radius_km = models.FloatField()
    wind_direction_deg = models.IntegerField()
    verified_disease = models.CharField(max_length=20, null=True, blank=True)
    verified_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    verified_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)

    @property
    def is_correct(self):
        return self.verified_disease is not None and self.verified_disease == self.predicted_disease

    def __str__(self):
        return f"{self.predicted_disease} forecast ({self.predicted_at:%Y-%m-%d})"

# Create your models here.
