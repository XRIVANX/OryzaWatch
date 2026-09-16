from datetime import timedelta

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from django.db.models import F

from alerts.services import (
    notify_broadcast, notify_incoming_spread, notify_report, notify_weather_risk, notify_wind_shift,
)
from farms.models import Farm
from .models import DiseaseHotspot, ForecastPrediction
from .serializers import DiseaseHotspotSerializer, HotspotReportSerializer
from .permissions import IsManagerOrReadOnly
from .prediction import FORECAST_HORIZON_DAYS, SEARCH_RADIUS_MULTIPLIER, build_cone_polygon, classify_farms
from .weather import DISEASE_SPREAD_PROFILE, compute_spread_velocity, fetch_weather

# A hotspot's weather snapshot is refreshed at most this often - re-fetching
# on every single page view would hammer the weather API for no benefit.
WEATHER_STALE_AFTER = timedelta(minutes=20)

BROADCAST_SCOPES = ('BARANGAY', 'MUNICIPALITY', 'ALL')


def _refresh_hotspot_weather(hotspot):
    """
    Best-effort, on-demand weather refresh for one active hotspot: re-fetches
    current conditions, updates the stored snapshot, and fires the
    Weather Risk / Dispersal Update alerts when humidity crosses the
    disease's threshold or the wind direction changes. Never raises - a
    flaky weather API must never break a hotspot list/detail request.
    """
    if timezone.now() - hotspot.updated_at < WEATHER_STALE_AFTER:
        return
    try:
        weather = fetch_weather(hotspot.effective_latitude, hotspot.effective_longitude)
        old_cardinal = hotspot.wind_cardinal
        old_humidity = hotspot.humidity

        hotspot.temperature = weather['temperature']
        hotspot.humidity = weather['humidity']
        hotspot.wind_speed = weather['wind_speed']
        hotspot.wind_direction_deg = weather['wind_direction_deg']
        hotspot.wind_cardinal = weather['wind_cardinal']
        hotspot.spread_velocity = compute_spread_velocity(hotspot.scan.detected_disease, weather)
        hotspot.save(update_fields=[
            'temperature', 'humidity', 'wind_speed', 'wind_direction_deg',
            'wind_cardinal', 'spread_velocity', 'updated_at',
        ])

        threshold = DISEASE_SPREAD_PROFILE.get(
            hotspot.scan.detected_disease, {'humidity_threshold': 75.0}
        )['humidity_threshold']
        if weather['humidity'] >= threshold and old_humidity < threshold:
            notify_weather_risk(hotspot, weather, threshold)
        if old_cardinal and old_cardinal != weather['wind_cardinal']:
            notify_wind_shift(hotspot, weather['wind_cardinal'])
    except Exception:
        # Best-effort: a stale snapshot is fine, a broken map is not.
        pass


class ActiveHotspotListCreateView(generics.ListCreateAPIView):
    """
    GET  -> all active disease hotspots (feeds the Leaflet/Google Maps view).
    POST -> a farmer reports one of their own positive scans as an outbreak;
            triggers the Critical Outbreak alert to Kagawad/Admin.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = DiseaseHotspot.objects.filter(is_active=True).order_by('-updated_at')
        for hotspot in queryset:
            _refresh_hotspot_weather(hotspot)
        return queryset

    def get_serializer_class(self):
        return HotspotReportSerializer if self.request.method == 'POST' else DiseaseHotspotSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        scan = serializer.validated_data['scan']

        # Pin the hotspot to the farmer's registered farm location, not the
        # scan's own GPS reading (which can drift from wherever they were
        # standing when the photo was taken). Falls back to the scan's
        # coordinates only if the farmer has no Farm on file.
        farm = getattr(scan.reporter, 'farm', None)
        hotspot_lat = farm.latitude if farm else scan.latitude
        hotspot_lng = farm.longitude if farm else scan.longitude

        weather = fetch_weather(hotspot_lat, hotspot_lng)
        hotspot = DiseaseHotspot.objects.create(
            scan=scan,
            latitude=hotspot_lat,
            longitude=hotspot_lng,
            status='CRITICAL',
            is_active=True,
            temperature=weather['temperature'],
            humidity=weather['humidity'],
            wind_speed=weather['wind_speed'],
            wind_direction_deg=weather['wind_direction_deg'],
            wind_cardinal=weather['wind_cardinal'],
            spread_velocity=compute_spread_velocity(scan.detected_disease, weather),
        )
        notify_report(hotspot)

        output = DiseaseHotspotSerializer(hotspot, context=self.get_serializer_context())
        return Response(output.data, status=status.HTTP_201_CREATED)


class HotspotDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Allows MAO Admins or Agri-Kagawads to update a hotspot's outbreak status
    or mark it resolved as containment measures are deployed. Resolving a
    hotspot automatically clears it from the active list; reopening one
    (e.g. a relapse) automatically reactivates it.
    """
    queryset = DiseaseHotspot.objects.all()
    serializer_class = DiseaseHotspotSerializer
    permission_classes = [permissions.IsAuthenticated, IsManagerOrReadOnly]

    def perform_update(self, serializer):
        hotspot = serializer.save()
        should_be_active = hotspot.status != 'RESOLVED'
        if hotspot.is_active != should_be_active:
            hotspot.is_active = should_be_active
            hotspot.save(update_fields=['is_active'])


class HotspotBroadcastView(APIView):
    """POST {scope: 'BARANGAY'|'MUNICIPALITY'|'ALL'} - Kagawad/Admin only."""
    permission_classes = [permissions.IsAuthenticated, IsManagerOrReadOnly]

    def post(self, request, pk):
        hotspot = get_object_or_404(DiseaseHotspot, pk=pk)
        scope = request.data.get('scope', 'BARANGAY')
        if scope not in BROADCAST_SCOPES:
            return Response(
                {"detail": f"scope must be one of {', '.join(BROADCAST_SCOPES)}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        count = notify_broadcast(hotspot, scope)
        return Response({"notified": count})


class HotspotPredictView(APIView):
    """
    "Heat Map Mode": any authenticated user (farmer included - it's their
    own safety at stake) can trigger a downwind spread prediction for an
    active hotspot. Refreshes weather, projects a cone in the wind
    direction, logs a ForecastPrediction, and alerts farms inside the cone
    (warning) or just outside it (all-clear). Per-recipient deduping in
    notify_incoming_spread already prevents this from being spammed into
    repeat alerts, so it doesn't need the Kagawad/Admin-only gate that
    broadcast() has.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        hotspot = get_object_or_404(DiseaseHotspot, pk=pk)
        scan = hotspot.scan
        apex_lat, apex_lng = float(hotspot.effective_latitude), float(hotspot.effective_longitude)

        weather = fetch_weather(apex_lat, apex_lng)
        hotspot.temperature = weather['temperature']
        hotspot.humidity = weather['humidity']
        hotspot.wind_speed = weather['wind_speed']
        hotspot.wind_direction_deg = weather['wind_direction_deg']
        hotspot.wind_cardinal = weather['wind_cardinal']
        hotspot.spread_velocity = compute_spread_velocity(scan.detected_disease, weather)
        hotspot.save(update_fields=[
            'temperature', 'humidity', 'wind_speed', 'wind_direction_deg',
            'wind_cardinal', 'spread_velocity', 'updated_at',
        ])

        reach_km = max(hotspot.spread_velocity * FORECAST_HORIZON_DAYS, 0.5)
        cone = build_cone_polygon(apex_lat, apex_lng, hotspot.wind_direction_deg, reach_km)
        # Day-by-day reach for the Heat Map visualization (1-5 days out),
        # scaled from the same spread_velocity - no separate model needed.
        daily_reach_km = [round(max(hotspot.spread_velocity * day, 0.2), 2) for day in range(1, 6)]

        candidate_farms = Farm.objects.exclude(farmer_id=scan.reporter_id).select_related('farmer')
        in_cone, out_of_cone = classify_farms(
            apex_lat, apex_lng, hotspot.wind_direction_deg, reach_km, candidate_farms
        )

        ForecastPrediction.objects.create(
            predicted_disease=scan.detected_disease,
            predicted_at=timezone.now(),
            forecast_latitude=apex_lat,
            forecast_longitude=apex_lng,
            forecast_radius_km=reach_km,
            wind_direction_deg=hotspot.wind_direction_deg,
        )

        notified = notify_incoming_spread(hotspot, in_cone, out_of_cone)

        return Response({
            'hotspot_latitude': apex_lat,
            'hotspot_longitude': apex_lng,
            'cone': cone,
            'reach_km': round(reach_km, 2),
            'daily_reach_km': daily_reach_km,
            'search_radius_km': round(reach_km * SEARCH_RADIUS_MULTIPLIER, 2),
            'wind_direction_deg': hotspot.wind_direction_deg,
            'wind_cardinal': hotspot.wind_cardinal,
            'wind_speed': hotspot.wind_speed,
            'farms_in_cone': len(in_cone),
            'farms_outside_cone': len(out_of_cone),
            'notified': notified,
        })


class DashboardStatsView(APIView):
    """Return dashboard metrics calculated from persisted scan records."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        verified = ForecastPrediction.objects.exclude(verified_disease__isnull=True)
        verified_count = verified.count()
        correct_count = verified.filter(predicted_disease=F('verified_disease')).count()
        return Response({
            'forecast_accuracy': round(correct_count * 100 / verified_count, 1) if verified_count else None,
            'verified_forecasts': verified_count,
        })


# --- Airborne disease forecast (Random Forest + XGBoost) ---------------------
# The ML stack (pandas, scikit-learn, xgboost) is imported inside the views, so
# the rest of the API keeps working on an install without it. Results are
# cached per ~1 km cell because the underlying forecast only updates hourly.

FORECAST_CACHE_SECONDS = 30 * 60


def _forecast_error_response(exc):
    from analytics.ml.predict import InvalidLocation, ModelNotTrained
    from analytics.ml.sources import WeatherFetchError

    if isinstance(exc, ModelNotTrained):
        return Response({'detail': 'Disease forecast model is not trained yet.'},
                        status=status.HTTP_503_SERVICE_UNAVAILABLE)
    if isinstance(exc, InvalidLocation):
        # Only our own validation messages are echoed. Anything unexpected
        # propagates as a plain 500 without internal detail.
        return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    if isinstance(exc, WeatherFetchError):
        return Response({'detail': 'Weather forecast service is unavailable. Try again shortly.'},
                        status=status.HTTP_502_BAD_GATEWAY)
    raise exc


def _model_info():
    import json
    from analytics.ml.config import METADATA_PATH

    try:
        meta = json.loads(METADATA_PATH.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return None
    return {
        'trained_at': meta.get('trained_at'),
        'algorithms': meta.get('algorithms'),
        'training_data': meta.get('data', {}).get('source'),
        'history': f"{meta.get('data', {}).get('start')} to {meta.get('data', {}).get('end')}",
    }


class DiseaseRiskForecastView(APIView):
    """
    GET /api/analytics/disease-risk/
        ?lat=<float>&lng=<float>   a specific point, or
        ?municipality=CARMEN       a monitored town centre, or
        (nothing)                  the requesting farmer's own farm
        &days=1..14                horizon, default 7

    Day-by-day outbreak probability and risk level for BLB, Rice Blast and
    Brown Spot, plus each disease's peak day.
    """
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'disease_forecast'

    def get(self, request):
        from django.core.cache import cache
        from analytics.ml.config import DEFAULT_FORECAST_DAYS, MUNICIPALITY_POINTS
        from analytics.ml.predict import clamp_days, forecast_point, validate_point

        params = request.query_params
        days = clamp_days(params.get('days', DEFAULT_FORECAST_DAYS))
        try:
            if params.get('lat') is not None or params.get('lng') is not None:
                lat, lng = validate_point(params.get('lat'), params.get('lng'))
                source = 'coordinates'
            elif params.get('municipality'):
                key = params['municipality'].strip().upper()
                if key not in MUNICIPALITY_POINTS:
                    return Response(
                        {'detail': f"municipality must be one of {', '.join(MUNICIPALITY_POINTS)}."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                lat, lng = MUNICIPALITY_POINTS[key]
                source = f'municipality:{key}'
            else:
                farm = Farm.objects.filter(farmer=request.user).first()
                if farm is None:
                    return Response(
                        {'detail': 'No registered farm. Pass lat/lng or municipality.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                lat, lng = validate_point(farm.latitude, farm.longitude)
                source = 'farm'

            cache_key = f'disease-risk:{lat:.2f}:{lng:.2f}:{days}'
            result = cache.get(cache_key)
            if result is None:
                result = forecast_point(lat, lng, days)
                cache.set(cache_key, result, FORECAST_CACHE_SECONDS)
        except Exception as exc:
            return _forecast_error_response(exc)

        return Response({'source': source, 'forecast_days': days, 'model': _model_info(), **result})


class HotspotSpreadForecastView(APIView):
    """
    GET /api/analytics/hotspots/<pk>/spread-forecast/?days=1..14

    Where this outbreak is likely to go. For each forecast day: the source
    risk, each ring point's risk 10 and 20 km out, which points are
    downwind, and the most likely direction of spread.
    """
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'disease_forecast'

    def get(self, request, pk):
        from django.core.cache import cache
        from analytics.ml.config import DEFAULT_FORECAST_DAYS, DISEASES
        from analytics.ml.predict import clamp_days, forecast_spread

        hotspot = get_object_or_404(DiseaseHotspot.objects.select_related('scan'), pk=pk)
        days = clamp_days(request.query_params.get('days', DEFAULT_FORECAST_DAYS))
        detected = hotspot.scan.detected_disease
        disease = detected if detected in DISEASES else None
        lat, lng = float(hotspot.effective_latitude), float(hotspot.effective_longitude)

        try:
            cache_key = f'disease-spread:{lat:.2f}:{lng:.2f}:{disease}:{days}'
            result = cache.get(cache_key)
            if result is None:
                result = forecast_spread(lat, lng, disease=disease, days=days)
                cache.set(cache_key, result, FORECAST_CACHE_SECONDS)
        except Exception as exc:
            return _forecast_error_response(exc)

        return Response({
            'hotspot': hotspot.pk,
            'detected_disease': detected,
            'forecast_days': days,
            'model': _model_info(),
            **result,
        })
