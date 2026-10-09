# pyrefly: ignore [missing-import]
from django.db import models
# pyrefly: ignore [missing-import]
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from zoneinfo import ZoneInfo


class RiceVariety(models.Model):
    """A rice cultivar and sourced, disease-specific tolerance evidence."""

    name = models.CharField(max_length=120, unique=True)
    alternate_names = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    maturity_days = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MinValueValidator(1)])
    source = models.CharField(max_length=255, blank=True,
                              help_text='Where this variety record came from.')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class VarietyDiseaseEvidence(models.Model):
    """A sourced disease response claim; empty until real evidence is added."""

    DISEASE_CHOICES = (('BLB', 'Bacterial Leaf Blight'), ('BLAST', 'Rice Blast'))
    RESPONSE_CHOICES = (
        ('RESISTANT', 'Resistant'), ('MODERATELY_RESISTANT', 'Moderately resistant'),
        ('TOLERANT', 'Tolerant'), ('SUSCEPTIBLE', 'Susceptible'),
    )
    EVIDENCE_CHOICES = (
        ('PUBLISHED_RESEARCH', 'Published research'), ('CONTROLLED_TRIAL', 'Controlled trial'),
        ('FIELD_OBSERVATION', 'Field observation'), ('OTHER', 'Other source'),
    )

    variety = models.ForeignKey(RiceVariety, on_delete=models.CASCADE, related_name='disease_evidence')
    disease = models.CharField(max_length=20, choices=DISEASE_CHOICES)
    response = models.CharField(max_length=24, choices=RESPONSE_CHOICES)
    evidence_type = models.CharField(max_length=24, choices=EVIDENCE_CHOICES)
    source = models.CharField(max_length=255, help_text='Publication, trial, or report citation.')
    notes = models.TextField(blank=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name='variety_evidence_records')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['variety__name', 'disease', '-created_at']

    def __str__(self):
        return f'{self.variety}: {self.get_response_display()} to {self.get_disease_display()}'

class LeafScan(models.Model):
    DISEASE_CHOICES = (
        ('HEALTHY', 'Healthy'),
        ('BLB', 'Bacterial Leaf Blight'),
        ('BLAST', 'Rice Blast'),
    )
    
    # Links the report back to the User (Farmer/Kagawad) who took it
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='leaf_scans'
    )
    # Stores the physical image file inside a folder called /media/leaf_scans/
    image = models.ImageField(upload_to='leaf_scans/')

    GROWTH_STAGE_CHOICES = (
        ('SEEDLING', 'Seedling'), ('TILLERING', 'Tillering'),
        ('PANICLE_INITIATION', 'Panicle initiation'), ('BOOTING', 'Booting'),
        ('FLOWERING', 'Flowering'), ('GRAIN_FILLING', 'Grain filling'),
        ('MATURITY', 'Maturity'),
    )
    variety = models.ForeignKey(RiceVariety, null=True, blank=True, on_delete=models.SET_NULL,
                                related_name='scans')
    growth_stage = models.CharField(max_length=24, choices=GROWTH_STAGE_CHOICES, blank=True)
    symptom_notes = models.TextField(blank=True)
    observed_on = models.DateField(null=True, blank=True, help_text='Date the plant was inspected; unknown when blank.')
    
    # AI Classification Results
    detected_disease = models.CharField(max_length=20, choices=DISEASE_CHOICES, default='HEALTHY')
    confidence_score = models.FloatField(default=0.0)  # e.g., 0.8567 for 85.67%
    probabilities = models.JSONField(null=True, blank=True)

    VERIFICATION_CHOICES = (
        ('UNREVIEWED', 'Unreviewed'), ('VERIFIED', 'Human verified'),
        ('INCONCLUSIVE', 'Inconclusive'),
    )
    VERIFICATION_METHOD_CHOICES = (
        ('FIELD_EXPERT', 'Extension worker or agronomist'),
        ('MAO_INSPECTION', 'Municipal Agriculture Office inspection'),
        ('LABORATORY', 'Laboratory confirmation'), ('OTHER', 'Other confirmation'),
    )
    verification_status = models.CharField(max_length=16, choices=VERIFICATION_CHOICES, default='UNREVIEWED')
    verified_disease = models.CharField(max_length=20, choices=DISEASE_CHOICES, null=True, blank=True)
    verification_method = models.CharField(max_length=20, choices=VERIFICATION_METHOD_CHOICES, blank=True)
    verification_notes = models.TextField(blank=True)
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name='verified_leaf_scans')
    verified_at = models.DateTimeField(null=True, blank=True)

    # Optional AI add-ons (explainability, segmentation, detection). Each is
    # best-effort - null until the corresponding model has been trained
    # (see diagnostics/ai.py) - so older scans and a fresh install still work.
    heatmap = models.ImageField(upload_to='leaf_scans/heatmaps/', null=True, blank=True)
    segmentation_mask = models.ImageField(upload_to='leaf_scans/masks/', null=True, blank=True)
    affected_area_ratio = models.FloatField(null=True, blank=True)
    lesion_boxes = models.JSONField(null=True, blank=True)

    # Geospatial Coordinates (Vital for Leaflet.js Mapping)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, validators=[MinValueValidator(-90), MaxValueValidator(90)])
    longitude = models.DecimalField(max_digits=9, decimal_places=6, validators=[MinValueValidator(-180), MaxValueValidator(180)])
    
    created_at = models.DateTimeField(auto_now_add=True)

    def clean(self):
        super().clean()
        if self.observed_on and self.observed_on > timezone.localdate(timezone=ZoneInfo('Asia/Manila')):
            raise ValidationError({'observed_on': 'The inspection date cannot be in the future.'})
        if self.verification_status == 'VERIFIED':
            if not self.verified_disease or not self.verification_method:
                raise ValidationError('Verified scans require a confirmed result and confirmation method.')
        elif self.verified_disease:
            raise ValidationError({'verified_disease': 'A confirmed result requires VERIFIED status.'})

    def __str__(self):
        return f"{self.detected_disease} ({self.confidence_score * 100:.1f}%) - {self.created_at.strftime('%Y-%m-%d %H:%M')}"
