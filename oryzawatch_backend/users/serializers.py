from rest_framework import serializers
from django.contrib.auth import get_user_model
from users.models import ActivityLog

User = get_user_model()


class UserRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'}
    )
    municipality = serializers.CharField(max_length=100, required=True)
    barangay     = serializers.CharField(max_length=100, required=True)

    class Meta:
        model  = User
        fields = [
            'username', 'email', 'password',
            'role', 'municipality', 'barangay', 'phone_number',
        ]

    def validate_role(self, value):
        """
        MAO_ADMIN   — cannot be registered via this endpoint (first-run only, now removed).
        KAGAWAD     — only MAO_ADMIN can register.
        FARMER      — MAO_ADMIN or KAGAWAD can register.
        """
        if value == 'MAO_ADMIN':
            raise serializers.ValidationError(
                "MAO Admin accounts cannot be created through this endpoint."
            )
        return value

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserSerializer(serializers.ModelSerializer):
    """Returns profile data to React upon successful login."""
    class Meta:
        model  = User
        fields = [
            'id', 'username', 'email',
            'role', 'municipality', 'barangay', 'phone_number',
        ]


class ActivityLogSerializer(serializers.ModelSerializer):
    """Serializes activity log entries for the admin console."""
    user     = serializers.SerializerMethodField()
    action_label = serializers.SerializerMethodField()

    class Meta:
        model  = ActivityLog
        fields = ['id', 'timestamp', 'user', 'action_type', 'action_label', 'details']

    def get_user(self, obj):
        return obj.user.username if obj.user else 'system'

    def get_action_label(self, obj):
        return obj.get_action_type_display()