from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, ActivityLog

class CustomUserAdmin(UserAdmin):
    model = User
    
    # Check if fieldsets exists, then unpack it cleanly into a new tuple structure
    fieldsets = (
        *(UserAdmin.fieldsets or ()),
        ('Location & Role Info', {'fields': ('role', 'municipality', 'barangay', 'phone_number')}),
    )
    
    # Do the exact same thing for the addition form
    add_fieldsets = (
        *(UserAdmin.add_fieldsets or ()),
        ('Location & Role Info', {'fields': ('role', 'municipality', 'barangay', 'phone_number')}),
    )
    
    list_display = ['username', 'email', 'role', 'municipality', 'is_staff']


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display  = ['timestamp', 'user', 'action_type', 'details']
    list_filter   = ['action_type']
    search_fields = ['user__username', 'details']
    readonly_fields = ['timestamp', 'user', 'action_type', 'details']
    ordering = ['-timestamp']

    def has_add_permission(self, request):
        return False  # Logs are immutable; never create manually

    def has_change_permission(self, request, obj=None):
        return False  # Logs are immutable; never edit


# Register it securely
admin.site.register(User, CustomUserAdmin)