from django.db import models
from django.conf import settings

class Alert(models.Model):
    SEVERITY_CHOICES = (
        ('INFO', 'Info'),
        ('WARNING', 'Warning'),
        ('CRITICAL', 'Critical'),
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