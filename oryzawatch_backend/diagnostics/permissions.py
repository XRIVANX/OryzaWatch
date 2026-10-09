from rest_framework import permissions


class IsVarietyAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS or getattr(request.user, 'role', None) == 'MAO_ADMIN'


class IsVarietyAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and getattr(request.user, 'role', None) == 'MAO_ADMIN'
