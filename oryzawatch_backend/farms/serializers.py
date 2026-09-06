from rest_framework import serializers

from .models import Farm, polygon_area_hectares

MAX_BOUNDARY_POINTS = 200


class FarmSerializer(serializers.ModelSerializer):
    farmer_username = serializers.ReadOnlyField(source='farmer.username')
    barangay = serializers.ReadOnlyField(source='farmer.barangay')
    municipality = serializers.ReadOnlyField(source='farmer.municipality')

    class Meta:
        model = Farm
        fields = [
            'id', 'farmer', 'farmer_username', 'barangay', 'municipality',
            'latitude', 'longitude', 'boundary', 'size_hectares',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'farmer', 'created_at', 'updated_at']

    def validate_boundary(self, boundary):
        if boundary is None:
            return boundary
        if not isinstance(boundary, list) or len(boundary) > MAX_BOUNDARY_POINTS:
            raise serializers.ValidationError(
                f"Boundary must be a list of at most {MAX_BOUNDARY_POINTS} [lat, lng] points."
            )
        for point in boundary:
            if (
                not isinstance(point, (list, tuple))
                or len(point) != 2
                or not all(isinstance(v, (int, float)) for v in point)
            ):
                raise serializers.ValidationError("Each boundary point must be a [lat, lng] pair.")
        return boundary

    def validate(self, attrs):
        boundary = attrs.get('boundary', getattr(self.instance, 'boundary', None))
        size_hectares = attrs.get('size_hectares', getattr(self.instance, 'size_hectares', None))
        has_boundary_area = boundary and len(boundary) >= 3 and polygon_area_hectares(boundary) > 0
        if not has_boundary_area and not size_hectares:
            raise serializers.ValidationError(
                "Provide either a closed boundary or a manual farm size in hectares."
            )
        return attrs
