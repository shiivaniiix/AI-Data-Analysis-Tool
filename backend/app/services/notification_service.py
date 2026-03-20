import logging
import os
import smtplib
from email.mime.text import MIMEText

from fastapi import HTTPException, status

logger = logging.getLogger(__name__)


def send_otp_email(*, email: str, otp_code: str) -> None:
    email_sender = os.getenv("EMAIL_SENDER", "")
    email_password = os.getenv("EMAIL_PASSWORD", "")

    if not email_sender or not email_password:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Email service is not configured. Please set EMAIL_SENDER and EMAIL_PASSWORD.",
        )

    message = MIMEText(f"Your OTP is: {otp_code}. It expires in 10 minutes.")
    message["Subject"] = "Your DataChat AI OTP"
    message["From"] = email_sender
    message["To"] = email

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=20) as smtp:
            smtp.login(email_sender, email_password)
            smtp.send_message(message)
        logger.info("OTP email sent successfully to %s", email)
    except Exception as e:
        logger.exception("Failed to send OTP email to %s", email)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to send OTP email: {e}",
        )
