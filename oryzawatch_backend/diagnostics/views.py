from django.contrib.auth.models import User
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework import status
from .models import LeafScan
from .serializers import LeafScanSerializer

class LeafScanCreateView(generics.CreateAPIView):
    queryset = LeafScan.objects.all()
    serializer_class = LeafScanSerializer
    permission_classes = [permissions.IsAuthenticated] # You must be logged in

    # Override the default create method to automatically add the user
    def perform_create(self, serializer):
        serializer.save(reporter=self.request.user)

class LeafScanListView(generics.ListAPIView):
    serializer_class = LeafScanSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Return only the scans belonging to the logged-in user
        return LeafScan.objects.filter(reporter=self.request.user).order_by('-created_at')
