from rest_framework import serializers
from django.contrib.auth import get_user_model

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
        MAO_ADMIN   — only allowed if no MAO_ADMIN exists yet (first-run only).
        KAGAWAD     — allowed; an MAO_ADMIN can later promote or demote via Django admin.
        FARMER      — always allowed.
        """
        if value == 'MAO_ADMIN':
            if User.objects.filter(role='MAO_ADMIN').exists():
                raise serializers.ValidationError(
                    "An MAO Admin already exists. "
                    "Contact your administrator to assign privileged roles."
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