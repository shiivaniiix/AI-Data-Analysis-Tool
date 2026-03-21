from datetime import datetime, timedelta, timezone
import logging

from fastapi import HTTPException, status
from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from app.models.chat import ChatSession
from app.models.pending_user import PendingUser
from app.models.user import User
from app.services.notification_service import send_otp_email
from app.utils.otp import generate_otp
from app.utils.security import create_access_token, hash_otp, hash_password, verify_password

OTP_EXPIRE_MINUTES = 5
logger = logging.getLogger(__name__)


def cleanup_expired_pending_users(db: Session) -> int:
    """
    Remove stale pending signups whose OTP window has expired.
    Returns number of deleted rows.
    """
    now = datetime.now(timezone.utc)
    deleted_count = (
        db.execute(delete(PendingUser).where(PendingUser.expires_at < now)).rowcount or 0
    )
    if deleted_count:
        db.commit()
    return int(deleted_count)


def _find_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email.lower()))


def _find_user_by_username(db: Session, username: str) -> User | None:
    return db.scalar(select(User).where(User.username == username.lower()))


def _find_pending_by_email(db: Session, email: str) -> PendingUser | None:
    return db.scalar(select(PendingUser).where(PendingUser.email == email.lower().strip()))


def start_signup(db: Session, *, email: str, username: str, password: str) -> None:
    deleted_count = cleanup_expired_pending_users(db)
    if deleted_count:
        logger.info("Cleaned up %s expired pending signup record(s).", deleted_count)

    normalized_email = email.lower().strip()
    normalized_username = username.lower().strip()
    now = datetime.now(timezone.utc)
    otp_code = generate_otp()
    otp_expires_at = now + timedelta(minutes=OTP_EXPIRE_MINUTES)

    pending = _find_pending_by_email(db, normalized_email)
    if pending:
        pending.username = normalized_username
        pending.password_hash = hash_password(password)
        pending.otp_hash = hash_otp(otp_code)
        pending.expires_at = otp_expires_at
    else:
        pending = PendingUser(
            email=normalized_email,
            username=normalized_username,
            password_hash=hash_password(password),
            otp_hash=hash_otp(otp_code),
            expires_at=otp_expires_at,
        )
        db.add(pending)

    db.commit()
    send_otp_email(email=normalized_email, otp_code=otp_code)


def verify_signup_otp(db: Session, *, email: str, otp_code: str) -> User:
    normalized_email = email.lower().strip()
    pending = _find_pending_by_email(db, normalized_email)
    if not pending:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pending signup not found. Start signup again.",
        )

    now = datetime.now(timezone.utc)
    expires_at = pending.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please resend OTP.",
        )

    if pending.otp_hash != hash_otp(otp_code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OTP.",
        )

    if _find_user_by_email(db, pending.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered.",
        )
    if _find_user_by_username(db, pending.username):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username is already taken.",
        )

    user = User(
        email=pending.email,
        username=pending.username,
        password_hash=pending.password_hash,
        is_verified=True,
    )
    db.add(user)
    db.delete(pending)
    db.commit()
    db.refresh(user)
    return user


def resend_signup_otp(db: Session, *, email: str) -> None:
    normalized_email = email.lower().strip()
    pending = _find_pending_by_email(db, normalized_email)
    if not pending:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pending signup not found. Start signup again.",
        )

    otp_code = generate_otp()
    pending.otp_hash = hash_otp(otp_code)
    pending.expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRE_MINUTES)
    db.commit()
    send_otp_email(email=normalized_email, otp_code=otp_code)


def login_user(db: Session, *, identifier: str, password: str) -> dict[str, str]:
    user = db.scalar(
        select(User).where(
            or_(User.email == identifier.lower().strip(), User.username == identifier.lower().strip())
        )
    )
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before logging in.",
        )

    # Create a fresh chat session on every login.
    chat = ChatSession(user_id=user.id, file_name=None, file_url=None)
    db.add(chat)
    db.commit()
    db.refresh(chat)

    return {
        "access_token": create_access_token(user.id),
        "user_id": user.id,
        "email": user.email,
        "username": user.username,
        "new_chat_id": chat.id,
    }


def delete_user_account(db: Session, *, user_id: str, password: str) -> None:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Password is incorrect.",
        )

    db.delete(user)
    db.commit()
