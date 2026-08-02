from rest_framework import generics, permissions
from .models import Alert
from .serializers import AlertSerializer

class AlertListView(generics.ListAPIView):
    serializer_class = AlertSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Alert.objects.filter(recipient=self.request.user)

class AlertMarkReadView(generics.UpdateAPIView):
    serializer_class = AlertSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Alert.objects.filter(recipient=self.request.user)