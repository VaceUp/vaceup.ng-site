"""Infra endpoints (health checks for the load balancer / uptime monitor)."""
from django.db import connection
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    """Liveness + DB readiness probe. No auth, no throttle.

    GET /healthz/ -> 200 {"status": "ok", "database": "ok"} when the DB
    answers; 503 otherwise. Point your load balancer / uptime monitor here.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = []

    def get(self, request):
        db_ok = True
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        except Exception:
            db_ok = False

        payload = {"status": "ok" if db_ok else "degraded",
                   "database": "ok" if db_ok else "down"}
        return Response(payload, status=200 if db_ok else 503)
