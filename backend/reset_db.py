from app.models import ChatMessage, ChatPermission, ChatSession, User, UserOtp
from app.utils.db import SessionLocal


def clear_all_user_related_data() -> None:
    db = SessionLocal()
    try:
        # Delete child rows first to satisfy foreign key constraints.
        db.query(ChatPermission).delete(synchronize_session=False)
        db.query(ChatMessage).delete(synchronize_session=False)
        db.query(ChatSession).delete(synchronize_session=False)
        db.query(UserOtp).delete(synchronize_session=False)
        db.query(User).delete(synchronize_session=False)
        db.commit()
        print("Database cleared successfully")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    clear_all_user_related_data()
