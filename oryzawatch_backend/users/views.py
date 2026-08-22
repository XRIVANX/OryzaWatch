import time
from django.db import models
from django.core.cache import cache
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from django.contrib.auth import authenticate
from users.models import User, ActivityLog
from users.serializers import UserSerializer, UserRegisterSerializer, ActivityLogSerializer
from diagnostics.models import LeafScan
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework import serializers as drf_serializers

MAX_FAILED_ATTEMPTS = 3
LOCKOUT_DURATION = 300  # 5 minutes in seconds

# Generic message returned for every failed login so an attacker can neither
# enumerate valid usernames nor read the remaining-attempt counter.
INVALID_CREDENTIALS_MSG = "Invalid username or password."


def _log(action_type: str, details: str = '', user=None):
    """Helper: create an ActivityLog entry non-blocking."""
    ActivityLog.objects.create(
        action_type=action_type,
        details=details,
        user=user,
    )


class LoginRateThrottle(ScopedRateThrottle):
    scope = 'login'


class RegisterRateThrottle(ScopedRateThrottle):
    scope = 'register'


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([RegisterRateThrottle])
def register_user(request):
    """
    Admin-only endpoint: only MAO_ADMIN or KAGAWAD may register new users.
    KAGAWAD can only register FARMER accounts.
    """
    requester = request.user

    if requester.role not in ('MAO_ADMIN', 'KAGAWAD'):
        return Response(
            {"detail": "You do not have permission to register new users."},
            status=status.HTTP_403_FORBIDDEN,
        )

    # Kagawad may only register farmers
    target_role = request.data.get('role', 'FARMER')
    if requester.role == 'KAGAWAD' and target_role != 'FARMER':
        return Response(
            {"detail": "Kagawad accounts can only register Farmer accounts."},
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = UserRegisterSerializer(data=request.data)
    if serializer.is_valid():
        new_user = serializer.save()
        action = 'REGISTER_KAGAWAD' if new_user.role == 'KAGAWAD' else 'REGISTER_FARMER'
        _log(
            action_type=action,
            details=f"Registered '{new_user.username}' ({new_user.get_role_display()}) "
                    f"in {new_user.barangay}, {new_user.municipality}",
            user=requester,
        )
        return Response({
            "message": "User registered successfully!",
            "user": UserSerializer(new_user).data,
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

    if not user or not isinstance(user, User):
        failed_attempts = cache.get(attempts_key, 0) + 1

        if failed_attempts >= MAX_FAILED_ATTEMPTS:
            cache.set(lockout_key, time.time() + LOCKOUT_DURATION, timeout=LOCKOUT_DURATION)
            cache.delete(attempts_key)
            _log(
                action_type='LOGIN_LOCKED',
                details=f"Account locked after {MAX_FAILED_ATTEMPTS} failed attempts for username '{username}'.",
            )
            return Response(
                {"detail": "Too many failed login attempts. Please try again in a few minutes."},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )
        else:
            cache.set(attempts_key, failed_attempts, timeout=LOCKOUT_DURATION)
            _log(
                action_type='LOGIN_FAILED',
                details=f"Failed login attempt #{failed_attempts} for username '{username}'.",
            )
            return Response(
                {"detail": INVALID_CREDENTIALS_MSG},
                status=status.HTTP_401_UNAUTHORIZED
            )

    # Successful authentication: clear failure counters
    cache.delete(attempts_key)
    cache.delete(lockout_key)

    _log(
        action_type='LOGIN_SUCCESS',
        details=f"Logged in from role '{user.get_role_display()}'.",
        user=user,
    )

    refresh = RefreshToken.for_user(user)
    return Response({
        "refresh": str(refresh),
        "access": str(refresh.access_token),
        "user": UserSerializer(user).data,
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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def activity_log_list(request):
    """
    Returns paginated activity logs.
    Only MAO_ADMIN may access this endpoint.
    Supports optional query params:
      - action_type: filter by action type code
      - limit: number of results (default 50, max 200)
      - offset: pagination offset
    """
    if request.user.role != 'MAO_ADMIN':
        return Response(
            {"detail": "Only MAO Admins can view activity logs."},
            status=status.HTTP_403_FORBIDDEN,
        )

    queryset = ActivityLog.objects.select_related('user').all()

    # Filter by action type if provided
    action_filter = request.query_params.get('action_type')
    if action_filter:
        queryset = queryset.filter(action_type=action_filter)

    # Pagination
    try:
        limit  = min(int(request.query_params.get('limit', 50)), 200)
        offset = int(request.query_params.get('offset', 0))
    except ValueError:
        limit, offset = 50, 0

    total   = queryset.count()
    entries = queryset[offset: offset + limit]
    serializer = ActivityLogSerializer(entries, many=True)

    return Response({
        "total":  total,
        "limit":  limit,
        "offset": offset,
        "results": serializer.data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_users(request):
    """
    Returns paginated list of registered users with latest scan details.
    - MAO_ADMIN can view all users, or filter by role ('FARMER', 'KAGAWAD', 'MAO_ADMIN').
    - KAGAWAD can only view 'FARMER' accounts.
    """
    requester = request.user
    if requester.role not in ('MAO_ADMIN', 'KAGAWAD'):
        return Response(
            {"detail": "You do not have permission to view users list."},
            status=status.HTTP_403_FORBIDDEN,
        )

    role_filter = request.query_params.get('role')

    # Kagawad is restricted to only seeing FARMER accounts
    if requester.role == 'KAGAWAD':
        queryset = User.objects.filter(role='FARMER')
    else:
        if role_filter in ('FARMER', 'KAGAWAD', 'MAO_ADMIN'):
            queryset = User.objects.filter(role=role_filter)
        else:
            queryset = User.objects.all()

    # Search filter
    search = request.query_params.get('search', '').strip()
    if search:
        queryset = queryset.filter(
            models.Q(username__icontains=search) |
            models.Q(first_name__icontains=search) |
            models.Q(last_name__icontains=search) |
            models.Q(email__icontains=search) |
            models.Q(barangay__icontains=search) |
            models.Q(phone_number__icontains=search)
        )

    # Municipality filter
    municipality = request.query_params.get('municipality', '').strip()
    if municipality:
        queryset = queryset.filter(municipality__iexact=municipality)

    # Barangay filter
    barangay = request.query_params.get('barangay', '').strip()
    if barangay:
        queryset = queryset.filter(barangay__icontains=barangay)

    queryset = queryset.prefetch_related(
        models.Prefetch(
            'leaf_scans',
            queryset=LeafScan.objects.order_by('-created_at'),
            to_attr='ordered_scans',
        )
    ).order_by('-date_joined')

    # Pagination
    try:
        limit = min(int(request.query_params.get('limit', 50)), 200)
        offset = int(request.query_params.get('offset', 0))
    except ValueError:
        limit, offset = 50, 0

    total = queryset.count()
    users_slice = queryset[offset: offset + limit]

    results = []
    for u in users_slice:
        ordered_scans = getattr(u, 'ordered_scans', [])
        latest_scan = ordered_scans[0] if ordered_scans else None

        scan_info = None
        disease_status = 'Safe'
        detected_disease = 'None'
        last_report = 'No scans yet'

        if latest_scan:
            detected_disease = latest_scan.get_detected_disease_display()
            if latest_scan.detected_disease in ('BLB', 'BLAST'):
                disease_status = 'Critical'
            elif latest_scan.detected_disease == 'BROWN_SPOT':
                disease_status = 'Monitoring'
            else:
                disease_status = 'Safe'

            last_report = latest_scan.created_at.isoformat()
            scan_info = {
                'id': latest_scan.id,
                'detected_disease': latest_scan.detected_disease,
                'detected_disease_display': detected_disease,
                'confidence_score': latest_scan.confidence_score,
                'created_at': latest_scan.created_at.isoformat(),
            }

        prefix = 'F' if u.role == 'FARMER' else ('K' if u.role == 'KAGAWAD' else 'A')
        user_code = f"{prefix}-{u.id:03d}"
        display_name = f"{u.first_name} {u.last_name}".strip() or u.username

        results.append({
            'id': u.id,
            'user_code': user_code,
            'username': u.username,
            'name': display_name,
            'email': u.email,
            'role': u.role,
            'role_display': u.get_role_display(),
            'municipality': u.municipality,
            'barangay': u.barangay,
            'phone_number': u.phone_number or '',
            'date_joined': u.date_joined.isoformat(),
            'total_scans': len(ordered_scans),
            'status': disease_status,
            'disease': detected_disease,
            'last_report': last_report,
            'latest_scan': scan_info,
        })

    return Response({
        "total": total,
        "limit": limit,
        "offset": offset,
        "results": results,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def initial_setup(request):
    """
    One-time setup endpoint — only active when no MAO_ADMIN exists.
    Creates the first MAO Admin account for a fresh deployment.
    Permanently disabled once any MAO_ADMIN is registered.
    """
    if User.objects.filter(role='MAO_ADMIN').exists():
        return Response(
            {"detail": "System is already configured. This endpoint is disabled."},
            status=status.HTTP_403_FORBIDDEN,
        )

    data = request.data.copy()
    data['role'] = 'MAO_ADMIN'  # Force role — only admin can be created here

    # Basic field validation
    required = ['username', 'password', 'municipality', 'barangay']
    missing  = [f for f in required if not data.get(f)]
    if missing:
        return Response(
            {"detail": f"Missing required fields: {', '.join(missing)}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if User.objects.filter(username=data['username']).exists():
        return Response(
            {"detail": "A user with that username already exists."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        user = User(
            username    = data['username'],
            email       = data.get('email', ''),
            role        = 'MAO_ADMIN',
            municipality= data['municipality'],
            barangay    = data['barangay'],
            phone_number= data.get('phone_number', ''),
        )
        user.set_password(data['password'])
        user.save()
    except Exception as exc:
        return Response(
            {"detail": str(exc)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    _log(
        action_type='LOGIN_SUCCESS',
        details=f"Initial system setup: MAO Admin '{user.username}' registered.",
        user=user,
    )

    refresh = RefreshToken.for_user(user)
    return Response({
        "message": "System configured successfully! MAO Admin account created.",
        "refresh": str(refresh),
        "access":  str(refresh.access_token),
        "user":    UserSerializer(user).data,
    }, status=status.HTTP_201_CREATED)