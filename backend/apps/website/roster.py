"""Attendee lists: the CSV a tutor prints before an event."""
import csv
from io import StringIO

from django.utils import timezone

COLUMNS = ("Name", "Email", "Phone", "Note", "Open to event emails", "Registered at")


def _safe(value):
    """Neutralise spreadsheet formula injection in free-text cells."""
    text = str(value or "")
    return f"'{text}" if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


def roster_csv(event):
    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(COLUMNS)
    for row in event.registrations.all():
        writer.writerow([
            _safe(row.name),
            _safe(row.email),
            _safe(row.phone),
            _safe(row.note),
            "yes" if row.consent_marketing else "no",
            timezone.localtime(row.created_at).strftime("%Y-%m-%d %H:%M") if row.created_at else "",
        ])
    # Excel on Windows reads UTF-8 only with the byte-order mark.
    return "﻿" + buffer.getvalue()
