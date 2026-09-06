from rest_framework import permissions

MANAGEMENT_ROLES = ('KAGAWAD', 'MAO_ADMIN')


class IsOwnerOrManager(permissions.BasePermission):
    """
    A farmer may read/write only their own farm. Kagawad/MAO Admin may read
    or write any farm (field visits, corrections, MAO dashboard).
    """
    message = "You may only view or edit your own farm."

    def has_object_permission(self, request, view, obj):
        if getattr(request.user, 'role', None) in MANAGEMENT_ROLES:
            return True
        return obj.farmer_id == request.user.id


class IsManagementRole(permissions.BasePermission):
    """Only Agri-Kagawads or MAO Admins may use this endpoint at all."""
    message = "Only Agri-Kagawads or MAO Admins may access this."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'role', None) in MANAGEMENT_ROLES
        )
