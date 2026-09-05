from django.core.files.base import ContentFile
from rest_framework import generics, permissions
from .models import LeafScan
from .serializers import LeafScanSerializer
from .ai import predict_leaf, generate_gradcam, run_segmentation, run_lesion_detection

class LeafScanCreateView(generics.CreateAPIView):
    queryset = LeafScan.objects.all()
    serializer_class = LeafScanSerializer
    permission_classes = [permissions.IsAuthenticated] # You must be logged in

    # Override the default create method to automatically add the user
    def perform_create(self, serializer):
        image = serializer.validated_data['image']
        disease, confidence, probabilities = predict_leaf(image)
        instance = serializer.save(
            reporter=self.request.user,
            detected_disease=disease,
            confidence_score=confidence,
        )
        # Not a model field - attached only so the create response can show the
        # full per-class breakdown. A later GET (list/history) won't have it.
        instance.probabilities = probabilities

        # Best-effort add-ons - each is independently optional (see diagnostics/ai.py)
        # and never blocks a scan from being saved, even if untrained/unavailable.
        heatmap_bytes = generate_gradcam(image, disease)
        if heatmap_bytes:
            instance.heatmap.save(f'{instance.pk}_heatmap.jpg', ContentFile(heatmap_bytes), save=False)

        segmentation_result = run_segmentation(image)
        if segmentation_result:
            mask_bytes, affected_ratio = segmentation_result
            instance.segmentation_mask.save(f'{instance.pk}_mask.png', ContentFile(mask_bytes), save=False)
            instance.affected_area_ratio = affected_ratio

        lesion_boxes = run_lesion_detection(image)
        if lesion_boxes:
            instance.lesion_boxes = lesion_boxes

        instance.save()

class LeafScanListView(generics.ListAPIView):
    serializer_class = LeafScanSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Return only the scans belonging to the logged-in user
        return LeafScan.objects.filter(reporter=self.request.user).order_by('-created_at')
