from rest_framework.permissions import BasePermission


class IsKidsParent(BasePermission):
    message = "A verified Kids Academy parent account is required."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated and user.can_access_kids
            and hasattr(user, "kids_parent_profile")
        )
