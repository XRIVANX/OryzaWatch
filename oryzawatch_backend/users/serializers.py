from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()

class UserRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, 
        required=True, 
        style={'input_type': 'password'}
    )
    
    # Overriding these two fields to accept raw text strings during tests
    municipality = serializers.CharField(max_length=100, required=False, allow_blank=True)
    barangay = serializers.CharField(max_length=100, required=False, allow_blank=True)

    def validate_role(self, value):
        """
        Public self-registration may only create FARMER accounts.
        Privileged roles (KAGAWAD, MAO_ADMIN) must be assigned internally by an
        existing administrator — otherwise anyone could self-elevate.
        """
        if value and value != 'FARMER':
            raise serializers.ValidationError(
                "Privileged accounts must be created by an existing administrator."
            )
        return value

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'role', 'municipality', 'barangay', 'phone_number']

    def create(self, validated_data):
        # Extracts password cleanly and uses Django's built-in hashing
        password = validated_data.pop('password')
        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()
        return user

class UserSerializer(serializers.ModelSerializer):
    """Returns profile data to React upon successful log in"""
    municipality = serializers.CharField(max_length=100)
    barangay = serializers.CharField(max_length=100)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'municipality', 'barangay', 'phone_number']