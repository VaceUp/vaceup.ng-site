"""Package init.

Shared hosting (Truehost/cPanel) usually can't compile ``mysqlclient``,
so we use the pure-Python ``PyMySQL`` driver and make it masquerade as
MySQLdb. The version override satisfies Django's driver version check.
"""
import pymysql

pymysql.version_info = (2, 2, 1, "final", 0)  # compatibility shim for Django 5.2's mysqlclient check
pymysql.install_as_MySQLdb()

# Load the Celery app so @shared_task decorators register on startup.
from .celery import app as celery_app  # noqa: E402

__all__ = ("celery_app",)
