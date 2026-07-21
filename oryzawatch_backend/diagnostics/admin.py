from django.contrib import admin
from .models import LeafScan

@admin.register(LeafScan)
class LeafScanAdmin(admin.ModelAdmin):
    list_display = ['id', 'reporter', 'detected_disease', 'confidence_score', 'created_at']
    list_filter = ['detected_disease', 'created_at']

# Register your models here.
