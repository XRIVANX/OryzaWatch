from django.contrib import admin
from .models import DiseaseHotspot, ForecastPrediction

@admin.register(DiseaseHotspot)
class DiseaseHotspotAdmin(admin.ModelAdmin):
    list_display = ['id', 'scan', 'status', 'temperature', 'wind_cardinal', 'updated_at']
    list_filter = ['status', 'wind_cardinal']


@admin.register(ForecastPrediction)
class ForecastPredictionAdmin(admin.ModelAdmin):
    list_display = ['id', 'predicted_disease', 'predicted_at', 'verified_disease', 'verified_at']
    list_filter = ['predicted_disease', 'verified_disease']

# Register your models here.
