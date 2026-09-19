"""Strict bounded pagination, including duplicate query-parameter rejection."""
import re

from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination


def query_integer(params, key, default=None, minimum=1, maximum=9223372036854775807):
    values = params.getlist(key)
    if not values:
        if default is None:
            raise ValidationError({key: "This parameter is required."})
        return default
    raw = values[0]
    if len(values) != 1 or len(raw) > 19 or not re.fullmatch(r"[0-9]+", raw):
        raise ValidationError({key: "Enter one valid integer."})
    value = int(raw)
    if value < minimum or value > maximum:
        raise ValidationError({key: f"Choose a value from {minimum} to {maximum}."})
    return value


class MessagingPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100

    def get_page_number(self, request, paginator):
        return query_integer(request.query_params, "page", default=1, maximum=1000000)

    def get_page_size(self, request):
        return query_integer(request.query_params, "page_size", default=self.page_size, maximum=100)
