from rest_framework import generics, permissions
from .models import LeafScan
from .serializers import LeafScanSerializer
from .ai import predict_leaf

class LeafScanCreateView(generics.CreateAPIView):
    queryset = LeafScan.objects.all()
    serializer_class = LeafScanSerializer
    permission_classes = [permissions.IsAuthenticated] # You must be logged in

    # Override the default create method to automatically add the user
    def perform_create(self, serializer):
        disease, confidence = predict_leaf(serializer.validated_data['image'])
        serializer.save(
            reporter=self.request.user,
            detected_disease=disease,
            confidence_score=confidence,
        )

class LeafScanListView(generics.ListAPIView):
    serializer_class = LeafScanSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Return only the scans belonging to the logged-in user
        return LeafScan.objects.filter(reporter=self.request.user).order_by('-created_at')
