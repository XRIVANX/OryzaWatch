from rest_framework import serializers
from .models import LeafScan

# Upload guard rails
MAX_IMAGE_BYTES = 5 * 1024 * 1024          # 5 MB
MAX_IMAGE_DIMENSION = 6000                  # px per side — blocks decompression bombs
ALLOWED_IMAGE_EXTENSIONS = ('jpg', 'jpeg', 'png', 'webp')


class LeafScanSerializer(serializers.ModelSerializer):
    # This automatically grabs the username of whoever uploaded the picture
    reporter_username = serializers.ReadOnlyField(source='reporter.username')
    # Per-class confidence breakdown (e.g. {"HEALTHY": 0.02, "BLB": 0.91, "BLAST": 0.07}).
    # Only present right after a scan is created - it's not a model field, so a later
    # GET (list/history) won't have it.
    probabilities = serializers.SerializerMethodField()

    def get_probabilities(self, obj):
        return getattr(obj, 'probabilities', None)

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
            'detected_disease',
            'confidence_score',
            'probabilities',
            'heatmap',
            'segmentation_mask',
            'affected_area_ratio',
            'lesion_boxes',
            'latitude',
            'longitude',
            'created_at'
        ]
        # These are read-only because our backend AI will calculate them later,
        # so the React mobile/web app doesn't send them manually.
        read_only_fields = [
            'detected_disease', 'confidence_score',
            'heatmap', 'segmentation_mask', 'affected_area_ratio', 'lesion_boxes',
        ]