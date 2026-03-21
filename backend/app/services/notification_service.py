import logging
import os

from fastapi import HTTPException, status
import resend

logger = logging.getLogger(__name__)


def send_otp_email(*, email: str, otp_code: str) -> None:
    resend_api_key = (os.getenv("RESEND_API_KEY") or "").strip()
    if not resend_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email service is not configured. Set RESEND_API_KEY in the server environment.",
        )

    resend.api_key = resend_api_key

    try:
        resend.Emails.send(
            {
                "from": "noreply@datachatai.in",
                "to": [email],
                "subject": "Your DataChat AI OTP",
                "html": f"<strong>Your OTP is: {otp_code}</strong>",
            }
        )
        logger.info("OTP email sent successfully to %s", email)
    except Exception as e:
        logger.exception("Failed to send OTP email to %s", email)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to send OTP email via Resend: {e}",
        )
