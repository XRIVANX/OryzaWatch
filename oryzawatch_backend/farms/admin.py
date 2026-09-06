from django.contrib import admin

from .models import Farm


@admin.register(Farm)
class FarmAdmin(admin.ModelAdmin):
    list_display = ['id', 'farmer', 'size_hectares', 'latitude', 'longitude', 'updated_at']
    search_fields = ['farmer__username', 'farmer__barangay']
