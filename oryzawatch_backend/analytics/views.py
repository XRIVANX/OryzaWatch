from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import F
from .models import DiseaseHotspot, ForecastPrediction
from .serializers import DiseaseHotspotSerializer
from .permissions import IsManagerOrReadOnly
from diagnostics.models import LeafScan

class ActiveHotspotListView(generics.ListAPIView):
    """
    Returns all active disease hotspots. 
    This endpoint feeds your Leaflet/Google Maps view on the React frontend.
    """
    serializer_class = DiseaseHotspotSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Grabs only active outbreak spots so your map remains relevant
        return DiseaseHotspot.objects.filter(is_active=True).order_by('-updated_at')

class HotspotDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Allows MAO Admins or Agri-Kagawads to update a hotspot's outbreak status 
    or mark it resolved as containment measures are deployed.
    """
    queryset = DiseaseHotspot.objects.all()
    serializer_class = DiseaseHotspotSerializer
    permission_classes = [permissions.IsAuthenticated, IsManagerOrReadOnly]


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
