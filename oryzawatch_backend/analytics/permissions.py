from rest_framework import permissions

# Roles permitted to mutate outbreak/hotspot data.
MANAGEMENT_ROLES = ('KAGAWAD', 'MAO_ADMIN')


class IsManagerOrReadOnly(permissions.BasePermission):
    """
    Safe methods (GET/HEAD/OPTIONS) are allowed for any authenticated user.
    Write methods (PUT/PATCH/DELETE/POST) require an Agri-Kagawad or MAO Admin.

    This closes the broken-access-control hole where any authenticated FARMER
    could update or delete disease hotspots.
    """
    message = "Only Agri-Kagawads or MAO Admins may modify hotspot data."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return getattr(request.user, 'role', None) in MANAGEMENT_ROLES
