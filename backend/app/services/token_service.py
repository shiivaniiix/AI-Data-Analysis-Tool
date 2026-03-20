from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.models.user import User
from app.utils.config import settings
from app.utils.db import get_db

bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("Missing token subject")
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        ) from None

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token user.",
        )
    return user


def create_share_token(*, chat_id: str, permission: str) -> str:
    """
    Creates a signed, unguessable share token that can later be redeemed by an authenticated user.
    The token is separate from the access JWT and uses a `type` claim.
    """
    if permission not in {"view", "edit"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid permission.")

    payload = {
        "type": "chat_share",
        "chat_id": chat_id,
        "perm": permission,
    }
    # Reuse access token exp handling in JWT by storing an exp claim.
    # Use `jwt` to attach `exp` by decoding strategy.
    # We'll just rely on `exp` computed outside of create_access_token to keep this function self-contained.
    # jose.jwt.encode will accept exp if present.
    from datetime import datetime, timedelta, timezone

    payload["exp"] = datetime.now(timezone.utc) + timedelta(
        minutes=settings.share_token_expire_minutes
    )
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_share_token(*, token: str) -> dict:
    try:
        payload = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired share token.",
        ) from None

    if payload.get("type") != "chat_share":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid share token type.",
        )

    chat_id = payload.get("chat_id")
    perm = payload.get("perm")
    if not isinstance(chat_id, str) or perm not in {"view", "edit"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid share token payload.",
        )

    return {"chat_id": chat_id, "perm": perm}
