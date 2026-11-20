"""
Minimal SMTP email sender for the approve-then-send outreach flow.

Deliberately separate from Agent 3 (Outreach) -- see
app/agents/vendor/CHANGES.md and PipelineService.mark_sent: the agent only
drafts a message, a human approves it in the UI, and only THIS module
actually puts it on the wire. That split (draft -> approve -> send, three
distinct backend-owned steps) was a deliberate design decision, not an
oversight -- see PipelineService.mark_sent's docstring.

Defaults to Gmail's SMTP relay, matching the reference `send_actual_email`
function in the vendored agent3_outreach/outreach_agent.py this replaces,
but any SMTP-compatible provider works by setting SMTP_HOST/SMTP_PORT.

Credentials: SMTP_USERNAME / SMTP_PASSWORD come ONLY from environment
variables (app.core.config.settings) -- same rule as the Supabase and LLM
credentials elsewhere in this codebase. Never hardcode them here or
anywhere else.

For Gmail specifically: SMTP_PASSWORD must be an App Password
(https://myaccount.google.com/apppasswords), not the account's normal
login password -- Gmail rejects normal passwords over SMTP, and an App
Password requires 2-Step Verification to be turned on for the account.
"""
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from app.core.config import settings


class SmtpNotConfiguredError(RuntimeError):
    """SMTP_USERNAME / SMTP_PASSWORD are not set in the environment."""


class EmailSendError(RuntimeError):
    """The SMTP server rejected the message, or the connection failed."""


def send_email(to_email: str, subject: str, body: str, reply_to: Optional[str] = None) -> None:
    """Send one plain-text email. Raises SmtpNotConfiguredError if no SMTP
    credentials are configured, or EmailSendError if sending itself fails
    (bad credentials, network error, rejected recipient, etc). Returns
    nothing on success -- callers only need to know it didn't raise.
    """
    username = (settings.SMTP_USERNAME or "").strip()
    password = (settings.SMTP_PASSWORD or "").strip()
    if not username or not password:
        raise SmtpNotConfiguredError(
            "SMTP_USERNAME and SMTP_PASSWORD must be set as environment variables "
            "(e.g. in backend/.env) before outreach can actually be sent. For "
            "Gmail, SMTP_PASSWORD must be an App Password, not your normal "
            "account password. Never hardcode these values in code."
        )

    host = settings.SMTP_HOST or "smtp.gmail.com"
    port = settings.SMTP_PORT or 587

    message = MIMEMultipart()
    message["From"] = username
    message["To"] = to_email
    message["Subject"] = subject or "(no subject)"
    if reply_to:
        message["Reply-To"] = reply_to
    message.attach(MIMEText(body or "", "plain"))

    try:
        with smtplib.SMTP(host, port, timeout=20) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            server.login(username, password)
            server.send_message(message)
    except (smtplib.SMTPException, OSError) as error:
        raise EmailSendError(f"Failed to send email via SMTP ({host}:{port}): {error}") from error
