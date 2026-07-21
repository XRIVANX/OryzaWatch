from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User

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

# Register it securely
admin.site.register(User, CustomUserAdmin)