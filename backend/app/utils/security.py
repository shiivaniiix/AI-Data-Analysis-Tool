from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import Any

from jose import jwt
from passlib.context import CryptContext
from passlib.exc import UnknownHashError

from app.utils.config import settings

# pbkdf2_sha256: no 72-byte password limit (unlike bcrypt), stable with modern passlib;
# avoids bcrypt 4.x / passlib compatibility issues.
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash UTF-8 password; any length supported (no silent truncation)."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    if not password_hash:
        return False
    try:
        return pwd_context.verify(plain_password, password_hash)
    except (ValueError, UnknownHashError):
        return False


def create_access_token(subject: str) -> str:
    expire_at = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload: dict[str, Any] = {"sub": subject, "exp": expire_at}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def hash_otp(otp_code: str) -> str:
    return sha256(otp_code.encode("utf-8")).hexdigest()
