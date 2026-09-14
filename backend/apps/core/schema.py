"""Shared documentation shapes; these serializers do not alter action handling."""
from drf_spectacular.utils import extend_schema, extend_schema_serializer
from rest_framework import serializers


class DetailSerializer(serializers.Serializer):
    detail = serializers.CharField()


class PaginatedSerializer(serializers.Serializer):
    count = serializers.IntegerField(min_value=0)
    next = serializers.URLField(allow_null=True)
    previous = serializers.URLField(allow_null=True)


def unpaginated_schema(**kwargs):
    """Document actions returning a bare array/object despite global pagination.

    Override only schema pagination; runtime pagination remains untouched.
    Request/response discovery and all schema checks still run normally.
    """
    def decorate(view):
        annotated = extend_schema(**kwargs)(view)
        base = annotated.kwargs["schema"]

        class UnpaginatedSchema(base):
            def _get_paginator(self):
                return None

        annotated.kwargs["schema"] = UnpaginatedSchema
        return annotated

    return decorate


def singleton(serializer):
    """An explicit object response for a route whose action name is 'list'."""
    return extend_schema_serializer(many=False)(serializer)
