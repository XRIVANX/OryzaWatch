from rest_framework import serializers
from .models import DiseaseHotspot
from diagnostics.models import LeafScan
from diagnostics.serializers import LeafScanSerializer


class DiseaseHotspotSerializer(serializers.ModelSerializer):
    # The full scan (image, disease, coordinates...) nested directly under
    # `scan`, not just its id - the map and alert views render straight off
    # this without a second lookup.
    scan = LeafScanSerializer(read_only=True)
    # The map pin: the farmer's registered farm location (falls back to the
    # scan's own GPS only for hotspots created before this field existed).
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, source='effective_latitude', read_only=True)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, source='effective_longitude', read_only=True)

    class Meta:
        model = DiseaseHotspot
        fields = [
            'id',
            'scan',
            'latitude',
            'longitude',
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


class HotspotReportSerializer(serializers.Serializer):
    """
    Input-only serializer for POST /api/analytics/hotspots/ - a farmer
    reporting one of their own positive scans as an outbreak. Weather and
    spread velocity are computed server-side (see analytics/views.py), not
    supplied by the client.
    """
    scan = serializers.PrimaryKeyRelatedField(queryset=LeafScan.objects.all())

    def validate_scan(self, scan):
        request = self.context['request']
        if scan.reporter_id != request.user.id:
            raise serializers.ValidationError("You can only report your own scan.")
        if scan.detected_disease == 'HEALTHY':
            raise serializers.ValidationError("Only a diseased scan can be reported as an outbreak.")
        if DiseaseHotspot.objects.filter(scan=scan).exists():
            raise serializers.ValidationError("This scan has already been reported.")
        return scan
