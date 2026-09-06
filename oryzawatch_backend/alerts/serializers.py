from rest_framework import serializers
from .models import Alert

class AlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alert
        fields = ['id', 'title', 'message', 'severity', 'is_read', 'created_at', 'hotspot']
        # Only is_read is writable via the mark-read endpoint - a recipient
        # should never be able to rewrite the content of their own alert.
        read_only_fields = ['title', 'message', 'severity', 'created_at', 'hotspot']