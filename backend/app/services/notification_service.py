import logging
import smtplib
import os
from email.message import EmailMessage

logger = logging.getLogger(__name__)


def send_otp_email(*, email: str, otp_code: str) -> None:
    subject = "Your DataChat AI OTP"
    try:
        otp_expire_minutes = int(os.getenv("OTP_EXPIRE_MINUTES", "10"))
    except ValueError:
        otp_expire_minutes = 10
    body = (
        f"Your OTP is: {otp_code}. "
        f"It expires in {otp_expire_minutes} minutes."
    )

    email_sender = os.getenv("EMAIL_SENDER", "")
    email_password = os.getenv("EMAIL_PASSWORD", "")

    if not email_sender or not email_password:
        logger.warning(
            "Email sender credentials are missing. "
            "Set EMAIL_SENDER and EMAIL_PASSWORD to enable SMTP delivery."
        )
        logger.info("Development fallback OTP for %s is %s", email, otp_code)
        return

    message = EmailMessage()
    message["From"] = email_sender
    message["To"] = email
    message["Subject"] = subject
    message.set_content(body)

    try:
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=20) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            smtp.login(email_sender, email_password)
            smtp.send_message(message)
        logger.info("OTP email sent successfully to %s", email)
    except Exception:
        logger.exception("Failed to send OTP email to %s", email)
        # Dev-safe fallback: keep app flow alive and print OTP.
        logger.info("Development fallback OTP for %s is %s", email, otp_code)
