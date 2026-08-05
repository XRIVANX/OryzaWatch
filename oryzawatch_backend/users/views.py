
import time
from django.core.cache import cache
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from django.contrib.auth import authenticate
from users.models import User
from users.serializers import UserSerializer, UserRegisterSerializer
from rest_framework_simplejwt.tokens import RefreshToken

MAX_FAILED_ATTEMPTS = 3
LOCKOUT_DURATION = 300  # 5 minutes in seconds

# Generic message returned for every failed login so an attacker can neither
# enumerate valid usernames nor read the remaining-attempt counter.
INVALID_CREDENTIALS_MSG = "Invalid username or password."


class LoginRateThrottle(ScopedRateThrottle):
    scope = 'login'


class RegisterRateThrottle(ScopedRateThrottle):
    scope = 'register'


@api_view(['POST'])
@permission_classes([AllowAny])  # Allows public access
@throttle_classes([RegisterRateThrottle])
def register_user(request):
    serializer = UserRegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            "message": "User registered successfully!",
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": UserSerializer(user).data
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
def login_user(request):
    username = request.data.get('username', '')
    password = request.data.get('password', '')

    if not username or not password:
        return Response({"detail": INVALID_CREDENTIALS_MSG}, status=status.HTTP_401_UNAUTHORIZED)

    norm_username = username.strip().lower()
    lockout_key = f"lockout_until_{norm_username}"
    attempts_key = f"failed_attempts_{norm_username}"

    lockout_until = cache.get(lockout_key)
    now = time.time()

    # Check if currently locked out
    if lockout_until and now < lockout_until:
        remaining_seconds = int(lockout_until - now)
        minutes = remaining_seconds // 60
        seconds = remaining_seconds % 60
        if minutes > 0:
            time_str = f"{minutes} minute(s) {seconds} second(s)"
        else:
            time_str = f"{seconds} second(s)"
        return Response(
            {"detail": f"Account is locked due to 3 failed login attempts. Please try again in {time_str}."},
            status=status.HTTP_429_TOO_MANY_REQUESTS
        )

    user = authenticate(request, username=username, password=password)

    if not user:
        failed_attempts = cache.get(attempts_key, 0) + 1

        if failed_attempts >= MAX_FAILED_ATTEMPTS:
            cache.set(lockout_key, time.time() + LOCKOUT_DURATION, timeout=LOCKOUT_DURATION)
            cache.delete(attempts_key)
            return Response(
                {"detail": "Too many failed login attempts. Please try again in a few minutes."},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )
        else:
            cache.set(attempts_key, failed_attempts, timeout=LOCKOUT_DURATION)
            # Uniform message — do not reveal remaining attempts or whether the
            # username exists.
            return Response(
                {"detail": INVALID_CREDENTIALS_MSG},
                status=status.HTTP_401_UNAUTHORIZED
            )

    # Successful authentication: clear failure counters
    cache.delete(attempts_key)
    cache.delete(lockout_key)

    refresh = RefreshToken.for_user(user)
    return Response({
        "refresh": str(refresh),
        "access": str(refresh.access_token),
        "user": UserSerializer(user).data
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_profile(request):
    """Protected route: Only logged-in users can access this"""
    return Response(UserSerializer(request.user).data)

@api_view(['GET'])
@permission_classes([AllowAny])
def admin_exists(request):

    exists = User.objects.filter(role='MAO_ADMIN').exists()
    return Response({"admin_exists": exists})