"""Fail-closed containment until collaborative room membership is deployed."""
from rest_framework.permissions import BasePermission


class CollaborationUnavailable(BasePermission):
    message = "Collaborative classrooms are temporarily unavailable while access controls are upgraded."

    def has_permission(self, request, view):
        return False
