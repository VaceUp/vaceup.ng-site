"""Code Editor services: session management, CRDT sync, code execution."""
from __future__ import annotations

import asyncio
import httpx
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.codeeditor.models import CodeEditorSession, CodeExecution
from apps.core.exceptions import DomainError, PaymentFailed


def get_or_create_session(*, room_id, language="python"):
    """Get or create a code editor session."""
    session, created = CodeEditorSession.objects.get_or_create(
        room_id=room_id,
        defaults={"language": language},
    )
    return session


def get_session_state(room_id):
    """Get the current CRDT state for a session."""
    session = CodeEditorSession.objects.filter(room_id=room_id).first()
    if not session:
        return None
    return {
        "crdt_state": session.crdt_state,
        "version": session.version,
    }


def update_session_state(*, room_id, crdt_state, version):
    """Update the CRDT state for a session."""
    with transaction.atomic():
        session = CodeEditorSession.objects.select_for_update().get(room_id=room_id)
        if version != session.version:
            raise DomainError("Version conflict. Please refresh.", code="version_conflict")
        session.crdt_state = crdt_state
        session.version = version
        session.save(update_fields=["crdt_state", "version", "updated_at"])
    return session


def create_execution(*, session, user, code, language, stdin=""):
    """Record a code execution."""
    execution = CodeExecution.objects.create(
        session=session,
        user=user,
        code=code,
        language=language,
        stdin=stdin,
    )
    return execution


async def execute_code(*, code: str, language: str, stdin: str = "") -> dict:
    """
    Execute code using Judge0 API (or Piston as fallback).
    
    Returns dict with: stdout, stderr, exit_code, duration_ms, memory_mb
    """
    judge0_url = getattr(settings, "JUDGE0_URL", "https://judge0-ce.p.rapidapi.com")
    judge0_key = getattr(settings, "JUDGE0_API_KEY", "")
    
    language_map = {
        "python": 71,      # Python 3
        "javascript": 63,  # Node.js
        "typescript": 74,  # TypeScript
        "java": 62,        # Java
        "cpp": 54,         # C++
        "go": 60,          # Go
        "rust": 73,        # Rust
        "csharp": 51,      # C#
    }
    
    language_id = language_map.get(language.lower())
    if not language_id:
        raise DomainError(f"Unsupported language: {language}", code="unsupported_language")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Submit code
        payload = {
            "source_code": code,
            "language_id": language_id,
            "stdin": stdin,
            "cpu_time_limit": 10,
            "memory_limit": 256000,
        }
        
        headers = {}
        if judge0_key:
            headers["X-RapidAPI-Key"] = judge0_key
        
        # Submit
        response = await client.post(
            f"{judge0_url}/submissions",
            json=payload,
            headers=headers,
            params={"base64_encoded": "false", "wait": "false"},
            timeout=10.0,
        )
        
        if response.status_code not in (200, 201):
            raise DomainError(f"Failed to submit code: {response.text}")
        
        token = response.json()["token"]
        
        # Poll for result
        for _ in range(30):  # Max 30 seconds
            await asyncio.sleep(1)
            result = await client.get(
                f"{judge0_url}/submissions/{token}",
                headers=headers,
                params={"base64_encoded": "false", "fields": "stdout,stderr,status_id,time,memory"},
                timeout=10.0,
            )
            
            if result.status_code != 200:
                continue
            
            data = result.json()
            status_id = data.get("status", {}).get("id")
            
            if status_id in (1, 2):  # In queue, processing
                continue
            elif status_id == 3:  # Accepted
                return {
                    "stdout": data.get("stdout") or "",
                    "stderr": data.get("stderr") or "",
                    "exit_code": 0,
                    "duration_ms": int(float(data.get("time", 0)) * 1000),
                    "memory_mb": data.get("memory") / 1024 if data.get("memory") else None,
                }
            else:  # Error
                return {
                    "stdout": data.get("stdout") or "",
                    "stderr": data.get("stderr") or data.get("compile_output") or "Execution failed",
                    "exit_code": -1,
                    "duration_ms": int(float(data.get("time", 0)) * 1000) if data.get("time") else 0,
                    "memory_mb": data.get("memory") / 1024 if data.get("memory") else None,
                }
        
        raise DomainError("Execution timed out")


def record_execution(*, session, user, code, language, stdin, result: dict):
    """Record the execution result."""
    execution = CodeExecution.objects.create(
        session=session,
        user=user,
        code=code,
        language=language,
        stdin=stdin,
        stdout=result.get("stdout", ""),
        stderr=result.get("stderr", ""),
        exit_code=result.get("exit_code", -1),
        duration_ms=result.get("duration_ms"),
        memory_mb=result.get("memory_mb"),
        is_success=result.get("exit_code") == 0,
    )
    return execution