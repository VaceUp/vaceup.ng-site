"""Read-only cPanel diagnosis. Upload beside manage.py and run with app Python.

Does not authenticate users, query learner records, send requests/emails, apply
migrations, or change database rows. Reports source fingerprints and metadata.
"""
import hashlib
import json
import logging
import os
from pathlib import Path
import re
import sys

sys.dont_write_bytecode = True


def error_info(error):
    info = {"error": type(error).__name__}
    if getattr(error, "args", ()) and isinstance(error.args[0], int):
        info["database_error_code"] = error.args[0]
    if getattr(error, "node", None):
        info["missing_migration"] = list(error.node)
    if isinstance(error, ModuleNotFoundError):
        info["missing_module"] = error.name
    return info


def only_reads(execute, sql, params, many, context):
    # Django wraps some capability probes in transactions. Transaction control
    # itself changes no rows; statements within remain subject to this guard.
    if not re.match(r"\s*(SELECT|SHOW|DESCRIBE|DESC|PRAGMA|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b", sql, re.I):
        raise RuntimeError("Diagnostic refused a non-read query.")
    return execute(sql, params, many, context)


def main():
    app_root = Path.cwd()
    if not (app_root / "manage.py").is_file() or not (app_root / "apps").is_dir():
        print("Run this from the vaceup_api directory containing manage.py.")
        return 1
    sys.path.insert(0, str(app_root))
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    # Process-local only. Do not send diagnostic events to external services.
    os.environ["SENTRY_DSN"] = ""
    logging.disable(logging.CRITICAL)
    report = {"diagnostic": "vaceup-admin-read-only-v2", "source_files": {}}
    paths = [
        "apps/adminpanel/views.py", "apps/adminpanel/serializers.py",
        "apps/adminpanel/platform_settings.py", "apps/adminpanel/user_deletion.py",
        "apps/courses/views.py", "apps/courses/serializers.py",
        "apps/courses/models.py", "apps/courses/catalog.py", "apps/courses/original_catalog.json",
        "apps/courses/migrations/0005_course_public_details.py",
        "apps/announcements/views.py", "apps/announcements/services.py",
        "apps/accounts/outbox.py", "apps/accounts/management/commands/process_mail_queue.py",
        "apps/core/schema.py", "apps/core/throttling.py",
        "apps/announcements/migrations/__init__.py",
        "apps/announcements/migrations/0001_initial.py",
    ]
    for name in paths:
        try:
            raw = (app_root / name).read_bytes().replace(b"\r\n", b"\n")
            report["source_files"][name] = hashlib.sha256(raw).hexdigest()
        except FileNotFoundError:
            report["source_files"][name] = "MISSING"
        except OSError:
            report["source_files"][name] = "UNREADABLE"
    try:
        import django
        django.setup()
        from django.apps import apps
        from django.db import connection
        from django.db.migrations.loader import MigrationLoader
        from django.urls import resolve
        report["django_version"] = django.get_version()
        routes = {
            "/api/v1/admin/settings/definitions/": ("get", "definitions"),
            "/api/v1/admin/settings/public/": ("get", "public"),
            "/api/v1/courses/import-homepage/": ("post", "import_homepage"),
            "/api/v1/courses/diagnostic-route-only/": ("patch", "partial_update"),
            "/api/v1/admin/dashboard/users/1/deletion/": ("get", "get"),
        }
        report["routes"] = {}
        for path, (method, expected) in routes.items():
            try:
                match = resolve(path)
                actions = getattr(match.func, "actions", None)
                cls = getattr(match.func, "cls", None) or getattr(match.func, "view_class", None)
                actual = actions.get(method) if actions is not None else method if hasattr(cls, method) else None
                report["routes"][path] = {"expected_action": expected, "actual_action": actual,
                                          "matches": actual == expected}
            except Exception as error:
                report["routes"][path] = error_info(error)
        connection.ensure_connection()
        report["database_vendor"] = connection.vendor
        with connection.execute_wrapper(only_reads):
            try:
                loader = MigrationLoader(connection)
                report["migration_conflicts"] = loader.detect_conflicts()
                announcement_migration = ("announcements", "0001_initial")
                report["announcements_migration"] = {
                    "on_disk": announcement_migration in loader.disk_migrations,
                    "applied": announcement_migration in loader.applied_migrations,
                }
                report["unmigrated_apps"] = sorted(loader.unmigrated_apps)
                report["pending_migrations"] = sorted(
                    app + "." + name for app, name in loader.disk_migrations
                    if (app, name) not in loader.applied_migrations
                )
            except Exception as error:
                report["migration_check"] = error_info(error)
            report["missing_tables"] = []
            report["missing_columns"] = {}
            report["table_check_errors"] = {}
            local_labels = {config.label for config in apps.get_app_configs() if config.name.startswith("apps.")}
            with connection.cursor() as cursor:
                tables = set(connection.introspection.table_names(cursor))
                inspected = set()
                for model in apps.get_models(include_auto_created=True):
                    meta = model._meta
                    if meta.app_label not in local_labels or not meta.managed or meta.proxy or meta.db_table in inspected:
                        continue
                    inspected.add(meta.db_table)
                    if meta.db_table not in tables:
                        report["missing_tables"].append(meta.db_table)
                        continue
                    try:
                        columns = {column.name for column in connection.introspection.get_table_description(cursor, meta.db_table)}
                        missing = sorted(field.column for field in meta.local_concrete_fields if field.column not in columns)
                        if missing:
                            report["missing_columns"][meta.db_table] = missing
                    except Exception as error:
                        report["table_check_errors"][meta.db_table] = error_info(error)
            report["missing_tables"].sort()
    except Exception as error:
        report["setup_or_connection"] = error_info(error)
    print(json.dumps(report, indent=2, sort_keys=True))
    if "--strict" in sys.argv:
        problems = any(report.get(key) for key in (
            "setup_or_connection", "migration_check", "migration_conflicts", "pending_migrations",
            "missing_tables", "missing_columns", "table_check_errors",
        ))
        problems = problems or any(not value.get("matches") for value in report.get("routes", {}).values())
        problems = problems or any(value in ("MISSING", "UNREADABLE") for value in report["source_files"].values())
        return int(problems)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
