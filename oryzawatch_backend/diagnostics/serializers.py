from rest_framework import serializers
from .models import LeafScan

class LeafScanSerializer(serializers.ModelSerializer):
    # This automatically grabs the username of whoever uploaded the picture
    reporter_username = serializers.ReadOnlyField(source='reporter.username')

    class Meta:
        model = LeafScan
        fields = [
            'id', 
            'reporter_username', 
            'image', 
            'detected_disease', 
            'confidence_score', 
            'latitude', 
            'longitude', 
            'created_at'
        ]
        # These are read-only because our backend AI will calculate them later,
        # so the React mobile/web app doesn't send them manually.
        read_only_fields = ['detected_disease', 'confidence_score']