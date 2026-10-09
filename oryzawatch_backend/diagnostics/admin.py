from django.contrib import admin
from django.utils import timezone
from .models import LeafScan, RiceVariety, VarietyDiseaseEvidence


class VarietyDiseaseEvidenceInline(admin.StackedInline):
    model = VarietyDiseaseEvidence
    extra = 0
    readonly_fields = ['recorded_by', 'created_at']


@admin.register(RiceVariety)
class RiceVarietyAdmin(admin.ModelAdmin):
    list_display = ['name', 'maturity_days', 'is_active', 'updated_at']
    search_fields = ['name', 'alternate_names']
    list_filter = ['is_active']
    inlines = [VarietyDiseaseEvidenceInline]

    def save_formset(self, request, form, formset, change):
        instances = formset.save(commit=False)
        for obj in formset.deleted_objects:
            obj.delete()
        for instance in instances:
            instance.recorded_by = request.user
            instance.save()
        formset.save_m2m()

@admin.register(LeafScan)
class LeafScanAdmin(admin.ModelAdmin):
    list_display = ['id', 'reporter', 'detected_disease', 'verified_disease', 'verification_status', 'variety', 'created_at']
    list_filter = ['detected_disease', 'verification_status', 'verified_disease', 'variety', 'created_at']
    search_fields = ['reporter__username', 'symptom_notes', 'verification_notes']
    readonly_fields = ['detected_disease', 'confidence_score', 'probabilities', 'heatmap',
                       'segmentation_mask', 'affected_area_ratio', 'lesion_boxes', 'verified_by',
                       'verified_at', 'created_at', 'image', 'reporter']

    def has_add_permission(self, request):
        # New scan rows must pass through image validation and inference.
        return False

    def save_model(self, request, obj, form, change):
        review_fields = {'verification_status', 'verified_disease', 'verification_method', 'verification_notes'}
        if review_fields.intersection(form.changed_data):
            if obj.verification_status in ('VERIFIED', 'INCONCLUSIVE'):
                obj.verified_by = request.user
                obj.verified_at = timezone.now()
            else:
                obj.verified_by = None
                obj.verified_at = None
        super().save_model(request, obj, form, change)

# Register your models here.
