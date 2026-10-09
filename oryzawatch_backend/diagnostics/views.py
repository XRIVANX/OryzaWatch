from django.core.files.base import ContentFile
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.http import StreamingHttpResponse
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import LeafScan, RiceVariety, VarietyDiseaseEvidence
from .serializers import (LeafScanSerializer, LeafScanVerificationSerializer, RiceVarietySerializer,
                          VarietyDiseaseEvidenceSerializer)
from .permissions import IsVarietyAdminOrReadOnly, IsVarietyAdmin
from farms.permissions import IsManagementRole
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
            probabilities=probabilities,
        )

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


class RiceVarietyListView(generics.ListCreateAPIView):
    serializer_class = RiceVarietySerializer
    permission_classes = [permissions.IsAuthenticated, IsVarietyAdminOrReadOnly]

    def get_queryset(self):
        rows = RiceVariety.objects.prefetch_related('disease_evidence')
        if self.request.user.role == 'MAO_ADMIN' and self.request.query_params.get('include_inactive') == '1':
            return rows
        return rows.filter(is_active=True)


class RiceVarietyDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = RiceVarietySerializer
    permission_classes = [permissions.IsAuthenticated, IsVarietyAdminOrReadOnly]
    queryset = RiceVariety.objects.prefetch_related('disease_evidence')


class VarietyEvidenceCreateView(generics.CreateAPIView):
    serializer_class = VarietyDiseaseEvidenceSerializer
    permission_classes = [IsVarietyAdmin]

    def perform_create(self, serializer):
        variety = get_object_or_404(RiceVariety, pk=self.kwargs['pk'])
        serializer.save(variety=variety, recorded_by=self.request.user)


class VarietyEvidenceDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = VarietyDiseaseEvidenceSerializer
    permission_classes = [IsVarietyAdmin]
    queryset = VarietyDiseaseEvidence.objects.all()

    def perform_update(self, serializer):
        serializer.save(recorded_by=self.request.user)


class LeafScanReviewQueueView(generics.ListAPIView):
    serializer_class = LeafScanSerializer
    permission_classes = [IsManagementRole]
    queryset = LeafScan.objects.filter(verification_status='UNREVIEWED').select_related(
        'reporter', 'variety', 'verified_by'
    ).order_by('-created_at')


class LeafScanVerifyView(APIView):
    """Human review never replaces the original AI prediction."""
    permission_classes = [IsManagementRole]

    def patch(self, request, pk):
        scan = get_object_or_404(LeafScan, pk=pk)
        serializer = LeafScanVerificationSerializer(scan, data=request.data)
        serializer.is_valid(raise_exception=True)
        scan = serializer.save(verified_by=request.user, verified_at=timezone.now())
        return Response(LeafScanSerializer(scan, context={'request': request}).data)


class VerifiedScanExportView(APIView):
    permission_classes = [IsVarietyAdmin]

    def get(self, request):
        from .data_exports import verified_csv
        response = StreamingHttpResponse(verified_csv(), content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="verified_scans.csv"'
        return response
