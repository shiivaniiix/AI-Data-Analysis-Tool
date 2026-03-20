from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.user_otp import UserOtp
from app.models.chat import ChatSession
from app.services.notification_service import send_otp_email
from app.utils.config import settings
from app.utils.otp import generate_otp
from app.utils.security import create_access_token, hash_otp, hash_password, verify_password


def _find_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email.lower()))


def _find_user_by_username(db: Session, username: str) -> User | None:
    return db.scalar(select(User).where(User.username == username.lower()))


def create_user_with_otp(
    db: Session, *, email: str, username: str, password: str
) -> tuple[User, str]:
    normalized_email = email.lower().strip()
    normalized_username = username.lower().strip()

    if _find_user_by_email(db, normalized_email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered.",
        )
    if _find_user_by_username(db, normalized_username):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username is already taken.",
        )

    user = User(
        email=normalized_email,
        username=normalized_username,
        password_hash=hash_password(password),
        is_verified=False,
    )
    db.add(user)
    db.flush()

    otp_code = generate_otp()
    otp_entry = UserOtp(
        user_id=user.id,
        otp_hash=hash_otp(otp_code),
        expires_at=datetime.now(timezone.utc)
        + timedelta(minutes=settings.otp_expire_minutes),
    )
    db.add(otp_entry)
    db.commit()
    db.refresh(user)
    send_otp_email(email=user.email, otp_code=otp_code)

    return user, otp_code


def verify_user_otp(db: Session, *, email: str, otp_code: str) -> User:
    user = _find_user_by_email(db, email.lower().strip())
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if user.is_verified:
        return user

    otp_record = db.scalar(
        select(UserOtp)
        .where(UserOtp.user_id == user.id, UserOtp.consumed_at.is_(None))
        .order_by(UserOtp.created_at.desc())
    )
    if not otp_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP not found. Please sign up again.",
        )

    now = datetime.now(timezone.utc)
    expires_at = otp_record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired.",
        )

    if otp_record.otp_hash != hash_otp(otp_code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OTP.",
        )

    otp_record.consumed_at = now
    user.is_verified = True
    db.commit()
    db.refresh(user)
    return user


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
