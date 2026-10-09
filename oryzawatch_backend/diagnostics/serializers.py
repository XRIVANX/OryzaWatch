from rest_framework import serializers
from django.utils import timezone
from zoneinfo import ZoneInfo
from .models import LeafScan, RiceVariety, VarietyDiseaseEvidence


class VarietyDiseaseEvidenceSerializer(serializers.ModelSerializer):
    disease_label = serializers.CharField(source='get_disease_display', read_only=True)
    response_label = serializers.CharField(source='get_response_display', read_only=True)

    class Meta:
        model = VarietyDiseaseEvidence
        fields = ['id', 'disease', 'disease_label', 'response', 'response_label',
                  'evidence_type', 'source', 'notes', 'created_at']


class RiceVarietySerializer(serializers.ModelSerializer):
    disease_evidence = VarietyDiseaseEvidenceSerializer(many=True, read_only=True)

    class Meta:
        model = RiceVariety
        fields = ['id', 'name', 'alternate_names', 'description', 'maturity_days',
                  'source', 'is_active', 'disease_evidence']

# Upload guard rails
MAX_IMAGE_BYTES = 5 * 1024 * 1024          # 5 MB
MAX_IMAGE_DIMENSION = 6000                  # px per side — blocks decompression bombs
ALLOWED_IMAGE_EXTENSIONS = ('jpg', 'jpeg', 'png', 'webp')


class LeafScanSerializer(serializers.ModelSerializer):
    # This automatically grabs the username of whoever uploaded the picture
    reporter_username = serializers.ReadOnlyField(source='reporter.username')
    variety_name = serializers.CharField(source='variety.name', read_only=True, allow_null=True)
    verified_by_username = serializers.CharField(source='verified_by.username', read_only=True, allow_null=True)

    def validate_variety(self, variety):
        if variety and not variety.is_active:
            raise serializers.ValidationError('Choose an active variety, or leave it unknown.')
        return variety

    def validate_observed_on(self, value):
        if value and value > timezone.localdate(timezone=ZoneInfo('Asia/Manila')):
            raise serializers.ValidationError('The inspection date cannot be in the future.')
        return value

    def validate_image(self, image):
        if image.size > MAX_IMAGE_BYTES:
            raise serializers.ValidationError("Image must be 5 MB or smaller.")

        ext = image.name.rsplit('.', 1)[-1].lower() if '.' in image.name else ''
        if ext not in ALLOWED_IMAGE_EXTENSIONS:
            raise serializers.ValidationError(
                f"Unsupported file type. Allowed: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}."
            )

        # Verify it is a real, sanely-sized raster image (defends against
        # polyglots and pixel-flood decompression bombs).
        try:
            from PIL import Image
            image.seek(0)
            with Image.open(image) as img:
                width, height = img.size
        except Exception:
            raise serializers.ValidationError("Uploaded file is not a valid image.")
        finally:
            image.seek(0)

        if width > MAX_IMAGE_DIMENSION or height > MAX_IMAGE_DIMENSION:
            raise serializers.ValidationError(
                f"Image dimensions must not exceed {MAX_IMAGE_DIMENSION}px per side."
            )
        return image

    class Meta:
        model = LeafScan
        fields = [
            'id',
            'reporter_username',
            'image',
            'variety', 'variety_name', 'growth_stage', 'symptom_notes', 'observed_on',
            'detected_disease',
            'confidence_score',
            'probabilities',
            'heatmap',
            'segmentation_mask',
            'affected_area_ratio',
            'lesion_boxes',
            'verification_status', 'verified_disease', 'verification_method',
            'verification_notes', 'verified_by_username', 'verified_at',
            'latitude',
            'longitude',
            'created_at'
        ]
        # These are read-only because our backend AI will calculate them later,
        # so the React mobile/web app doesn't send them manually.
        read_only_fields = [
            'detected_disease', 'confidence_score', 'probabilities',
            'heatmap', 'segmentation_mask', 'affected_area_ratio', 'lesion_boxes',
            'verification_status', 'verified_disease', 'verification_method',
            'verification_notes', 'verified_by_username', 'verified_at',
        ]


class LeafScanVerificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeafScan
        fields = ['verification_status', 'verified_disease', 'verification_method', 'verification_notes']

    def validate(self, attrs):
        review_status = attrs.get('verification_status')
        if review_status not in ('VERIFIED', 'INCONCLUSIVE'):
            raise serializers.ValidationError({'verification_status': 'Choose VERIFIED or INCONCLUSIVE.'})
        if review_status == 'VERIFIED':
            if not attrs.get('verified_disease'):
                raise serializers.ValidationError({'verified_disease': 'A confirmed disease or HEALTHY result is required.'})
            if not attrs.get('verification_method'):
                raise serializers.ValidationError({'verification_method': 'Record how the diagnosis was confirmed.'})
        else:
            attrs['verified_disease'] = None
            attrs['verification_method'] = ''
            if not attrs.get('verification_notes', '').strip():
                raise serializers.ValidationError({'verification_notes': 'Explain why this sample is inconclusive.'})
        return attrs
