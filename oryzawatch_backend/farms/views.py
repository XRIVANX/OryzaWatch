from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Farm
from .permissions import IsManagementRole, IsOwnerOrManager
from .serializers import FarmSerializer


class MyFarmView(APIView):
    """
    GET  -> the logged-in farmer's own farm, or 404 if they haven't set one
            up yet (the mobile app uses that 404 to trigger the onboarding
            gate).
    PUT  -> create-or-update the logged-in farmer's own farm in one call.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            farm = request.user.farm
        except Farm.DoesNotExist:
            return Response({"detail": "No farm set up yet."}, status=status.HTTP_404_NOT_FOUND)
        return Response(FarmSerializer(farm).data)

    def put(self, request):
        instance = Farm.objects.filter(farmer=request.user).first()
        serializer = FarmSerializer(instance, data=request.data, partial=False)
        serializer.is_valid(raise_exception=True)
        serializer.save(farmer=request.user)
        return Response(serializer.data, status=status.HTTP_200_OK if instance else status.HTTP_201_CREATED)


class FarmListView(generics.ListAPIView):
    """All registered farms - feeds the MAO web Disease Map. Kagawad/Admin only."""
    queryset = Farm.objects.select_related('farmer').all()
    serializer_class = FarmSerializer
    permission_classes = [IsManagementRole]


class FarmDetailView(generics.RetrieveUpdateAPIView):
    """Kagawad/Admin viewing or correcting a specific farmer's farm."""
    queryset = Farm.objects.select_related('farmer').all()
    serializer_class = FarmSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrManager]
