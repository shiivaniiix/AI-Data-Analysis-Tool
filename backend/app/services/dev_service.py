from collections.abc import Sequence

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.chat import ChatMessage, ChatSession
from app.models.chat_permissions import ChatPermission
from app.models.user import User
from app.models.user_otp import UserOtp


def clear_test_data(db: Session) -> dict[str, int]:
    """
    Clear test data from auth/chat tables.

    Rules:
    - Delete users with is_verified = false (includes failed/incomplete signups).
    - Delete related rows in user_otps, chat_sessions, chat_messages, chat_permissions.
    - Cleanup any orphan rows that may exist from previous inconsistent local data.
    """
    unverified_user_ids: Sequence[str] = list(
        db.scalars(select(User.id).where(User.is_verified.is_(False)))
    )

    deleted = {
        "users": 0,
        "user_otps": 0,
        "chat_sessions": 0,
        "chat_messages": 0,
        "chat_permissions": 0,
        "orphan_chat_messages": 0,
        "orphan_chat_permissions": 0,
        "orphan_user_otps": 0,
    }

    if unverified_user_ids:
        unverified_chat_ids: Sequence[str] = list(
            db.scalars(
                select(ChatSession.id).where(ChatSession.user_id.in_(unverified_user_ids))
            )
        )

        deleted["user_otps"] = db.execute(
            delete(UserOtp).where(UserOtp.user_id.in_(unverified_user_ids))
        ).rowcount or 0

        if unverified_chat_ids:
            deleted["chat_messages"] = db.execute(
                delete(ChatMessage).where(ChatMessage.chat_id.in_(unverified_chat_ids))
            ).rowcount or 0
            deleted["chat_permissions"] = db.execute(
                delete(ChatPermission).where(ChatPermission.chat_id.in_(unverified_chat_ids))
            ).rowcount or 0

        deleted["chat_sessions"] = db.execute(
            delete(ChatSession).where(ChatSession.user_id.in_(unverified_user_ids))
        ).rowcount or 0
        deleted["users"] = db.execute(
            delete(User).where(User.id.in_(unverified_user_ids))
        ).rowcount or 0

    # Extra orphan cleanup for local/dev DBs that may have been modified manually.
    deleted["orphan_chat_messages"] = db.execute(
        delete(ChatMessage).where(
            ~ChatMessage.chat_id.in_(select(ChatSession.id))
            | ~ChatMessage.user_id.in_(select(User.id))
        )
    ).rowcount or 0
    deleted["orphan_chat_permissions"] = db.execute(
        delete(ChatPermission).where(
            ~ChatPermission.chat_id.in_(select(ChatSession.id))
            | ~ChatPermission.user_id.in_(select(User.id))
        )
    ).rowcount or 0
    deleted["orphan_user_otps"] = db.execute(
        delete(UserOtp).where(~UserOtp.user_id.in_(select(User.id)))
    ).rowcount or 0

    db.commit()
    return deleted
