from rest_framework import generics, permissions
from .models import DiseaseHotspot
from .serializers import DiseaseHotspotSerializer
from .permissions import IsManagerOrReadOnly

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