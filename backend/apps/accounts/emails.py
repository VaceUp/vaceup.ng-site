"""Transactional email senders for the accounts lifecycle.

Kept dependency-light (Django send_mail) and called from services via
transaction.on_commit so a rolled-back registration never emails a link.
"""
from __future__ import annotations

from django.conf import settings
from django.core.mail import EmailMultiAlternatives


def _frontend(path: str) -> str:
    base = getattr(settings, "FRONTEND_BASE_URL", "").rstrip("/")
    return f"{base}{path}"


def _brand_shell(title: str, body_html: str, cta_label: str | None = None, cta_url: str | None = None) -> str:
    """Return branded HTML for a VaceUp email."""
    btn = ""
    if cta_label and cta_url:
        btn = f'''
        <tr><td style="padding:28px 0 8px;text-align:center;">
          <a href="{cta_url}" style="display:inline-block;background:#FFC72C;color:#000459;font-weight:800;font-family:Arial,sans-serif;font-size:15px;padding:14px 36px;border-radius:12px;text-decoration:none;">{cta_label}</a>
        </td></tr>'''
    return f"""<!DOCTYPE html><html><body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e6e8ec;">
        <tr><td style="background:#000459;padding:28px 40px;text-align:center;">
          <span style="color:#ffffff;font-weight:900;font-size:24px;letter-spacing:1px;">VACEUP</span><br/>
          <span style="color:#FFC72C;font-weight:700;font-size:11px;letter-spacing:3px;">DIGITAL ACADEMY</span>
        </td></tr>
        <tr><td style="padding:36px 40px 12px;">
          <h1 style="color:#000459;font-size:22px;margin:0 0 14px;">{title}</h1>
          {body_html}
        </td></tr>
        {btn}
        <tr><td style="padding:24px 40px 34px;color:#8a93a3;font-size:12px;line-height:1.6;">
          VaceUp Digital Academy &middot; 669 Abeokuta Expressway, Ahmadiya Bus-stop, Ijaiye Ojokoro, Lagos<br/>
          <a href="https://vaceup.ng" style="color:#008B8B;">vaceup.ng</a> &middot;
          <a href="mailto:info@vaceup.ng" style="color:#008B8B;">info@vaceup.ng</a> &middot; +234 814 579 8943
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


def send_verification_email(*, email: str, token: str) -> None:
    link = _frontend(f"/verify-email?token={token}")
    text = (
        "Welcome to VaceUp!\n\n"
        "Please confirm your email address to activate your account:\n"
        f"{link}\n\n"
        "This link expires in 24 hours. If you didn't sign up, ignore this email."
    )
    html = _brand_shell(
        "Confirm your email",
        '<p style="color:#3d4452;font-size:15px;line-height:1.7;margin:0 0 10px;">'
        "You are one click away from your VaceUp account. Confirm your email to "
        "activate it and start learning.</p>",
        "Activate My Account",
        link,
    )
    msg = EmailMultiAlternatives(
        subject="Verify your VaceUp account",
        body=text,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
        to=[email],
    )
    msg.attach_alternative(html, "text/html")
    msg.send(fail_silently=False)


def send_welcome_email(*, email: str, full_name: str = "") -> None:
    first = (full_name or "there").split(" ")[0]
    dashboard = _frontend("/dashboard")
    courses = _frontend("/courses")
    text = (
        f"Welcome to VaceUp, {first}!\n\n"
        "Your account is verified and active. Here is how to get the best out "
        "of the academy:\n\n"
        f"1. Explore our courses: {courses}\n"
        "2. Enroll in a program that fits your goals\n"
        f"3. Track everything from your dashboard: {dashboard}\n\n"
        "Questions? Reply to this email or chat with us on WhatsApp anytime.\n\n"
        "— The VaceUp Team"
    )
    html = _brand_shell(
        f"Welcome aboard, {first}! 🎉",
        '<p style="color:#3d4452;font-size:15px;line-height:1.7;margin:0 0 12px;">'
        "Your VaceUp account is verified and active. You just joined a community "
        "of builders learning practical, career-changing digital skills.</p>"
        '<p style="color:#3d4452;font-size:15px;line-height:1.7;margin:0 0 12px;">'
        "<b>Here is how to start:</b></p>"
        '<ol style="color:#3d4452;font-size:15px;line-height:1.9;margin:0 0 12px;padding-left:20px;">'
        f'<li>Browse the courses and pick your track — <a href="{courses}" style="color:#008B8B;">vaceup.ng/courses</a></li>'
        "<li>Enroll in the program that fits your career goals</li>"
        f'<li>Track classes, assignments and certificates from your <a href="{dashboard}" style="color:#008B8B;">dashboard</a></li>'
        "</ol>"
        '<p style="color:#3d4452;font-size:15px;line-height:1.7;margin:0;">'
        "Any questions? Just reply to this email — a real person reads it.</p>",
        "Explore Courses",
        courses,
    )
    msg = EmailMultiAlternatives(
        subject=f"Welcome to VaceUp, {first}! 🎉",
        body=text,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
        to=[email],
    )
    msg.attach_alternative(html, "text/html")
    msg.send(fail_silently=False)


def send_password_reset_email(*, email: str, token: str) -> None:
    link = _frontend(f"/reset-password?token={token}")
    text = (
        "We received a request to reset your VaceUp password.\n\n"
        f"Reset it here (valid for 1 hour):\n{link}\n\n"
        "If you didn't request this, you can safely ignore this email — "
        "your password will not change."
    )
    html = _brand_shell(
        "Reset your password",
        '<p style="color:#3d4452;font-size:15px;line-height:1.7;margin:0;">'
        "We received a request to reset your VaceUp password. The link below "
        "is valid for <b>1 hour</b>.</p>",
        "Choose a New Password",
        link,
    )
    msg = EmailMultiAlternatives(
        subject="Reset your VaceUp password",
        body=text,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
        to=[email],
    )
    msg.attach_alternative(html, "text/html")
    msg.send(fail_silently=False)
