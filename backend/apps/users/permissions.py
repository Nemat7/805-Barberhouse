from rest_framework.permissions import BasePermission

from .models import User


class IsClient(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == User.ROLE_CLIENT


class IsBarber(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == User.ROLE_BARBER


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in (
            User.ROLE_ADMIN, User.ROLE_SUPERUSER
        )


class IsSuperuser(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == User.ROLE_SUPERUSER


class IsAdminOrBarber(BasePermission):
    """Barbers see own data; admins see everything — enforced in the view."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in (
            User.ROLE_BARBER, User.ROLE_ADMIN, User.ROLE_SUPERUSER
        )


class IsAdminOrSelf(BasePermission):
    """Allow admins or the user themselves."""
    def has_object_permission(self, request, view, obj):
        return request.user.is_admin_or_above or obj == request.user
