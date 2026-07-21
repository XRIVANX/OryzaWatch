from rest_framework import serializers
from .models import DiseaseHotspot
from diagnostics.serializers import LeafScanSerializer

class DiseaseHotspotSerializer(serializers.ModelSerializer):
    # This embeds the exact leaf scan location data, image, and disease type directly into the hotspot payload
    scan_details = LeafScanSerializer(source='scan', read_only=True)

    class Meta:
        model = DiseaseHotspot
        fields = [
            'id',
            'scan',
            'scan_details',
            'status',
            'temperature',
            'humidity',
            'wind_speed',
            'wind_direction_deg',
            'wind_cardinal',
            'spread_velocity',
            'is_active',
            'updated_at'
        ]