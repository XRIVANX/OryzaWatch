from django.contrib import admin
from .models import DiseaseHotspot

@admin.register(DiseaseHotspot)
class DiseaseHotspotAdmin(admin.ModelAdmin):
    list_display = ['id', 'scan', 'status', 'temperature', 'wind_cardinal', 'updated_at']
    list_filter = ['status', 'wind_cardinal']

# Register your models here.
