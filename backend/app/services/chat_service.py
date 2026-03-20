import mimetypes
import logging
import os
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from supabase import create_client

from app.models.chat import ChatMessage, ChatSession
from app.models.chat_permissions import ChatPermission
from app.models.user import User
from app.utils.config import settings
from app.services.ai_service import generate_sql_and_explanation
from app.services.duckdb_service import (
    execute_sql_safe,
    format_markdown_table,
    get_table_schema,
    schema_as_text,
    load_dataset_from_upload,
    delete_chat_db,
)

logger = logging.getLogger(__name__)


def _get_chat_permission(db: Session, *, chat: ChatSession, user: User) -> str | None:
    """
    Returns "view" | "edit" when user has explicit permission, otherwise None.
    """
    if chat.user_id == user.id:
        return "edit"

    perm = db.scalar(
        select(ChatPermission.permission).where(
            ChatPermission.chat_id == chat.id,
            ChatPermission.user_id == user.id,
        )
    )
    return perm


def _assert_can_view_chat(db: Session, *, chat: ChatSession, user: User) -> None:
    if _get_chat_permission(db, chat=chat, user=user) is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized for this chat.",
        )


def _assert_can_edit_chat(db: Session, *, chat: ChatSession, user: User) -> None:
    perm = _get_chat_permission(db, chat=chat, user=user)
    if perm != "edit":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions (edit).",
        )


def _normalize_filename(filename: str) -> str:
    # Avoid path traversal and keep only a safe tail.
    filename = os.path.basename(filename)
    return filename.replace(" ", "_")


def _validate_csv_excel(upload: UploadFile) -> str:
    filename = upload.filename or ""
    lower = filename.lower()
    if lower.endswith(".csv"):
        return "csv"
    if lower.endswith(".xlsx"):
        return "xlsx"
    if lower.endswith(".xls"):
        return "xls"
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid file type. Upload CSV or Excel (.csv, .xls, .xlsx) only.",
    )


def _public_url_for_path(storage_bucket: str, storage_path: str) -> str:
    # Assumes bucket is public (object/public). If bucket is private, you should switch to signed URLs.
    return f"{settings.supabase_url}/storage/v1/object/public/{storage_bucket}/{storage_path}"


def _extract_storage_path(file_url: str) -> str | None:
    base = f"{settings.supabase_url}/storage/v1/object/public/{settings.supabase_storage_bucket}/"
    if file_url.startswith(base):
        return file_url[len(base) :]
    return None


def _get_supabase_storage_client():
    supabase = create_client(settings.supabase_url, settings.supabase_key)
    return supabase


def list_chats(db: Session, *, user: User) -> list[ChatSession]:
    owned_stmt = select(ChatSession).where(ChatSession.user_id == user.id)
    shared_stmt = (
        select(ChatSession)
        .join(ChatPermission, ChatPermission.chat_id == ChatSession.id)
        .where(ChatPermission.user_id == user.id)
    )

    owned = list(db.scalars(owned_stmt).all())
    shared = list(db.scalars(shared_stmt).all())

    by_id: dict[str, ChatSession] = {c.id: c for c in owned}
    for c in shared:
        by_id[c.id] = c

    return sorted(by_id.values(), key=lambda c: c.created_at, reverse=True)


def list_chats_with_access(db: Session, *, user: User) -> list[dict]:
    chats = list_chats(db, user=user)
    chat_ids = [c.id for c in chats]
    if not chat_ids:
        return []

    perms_rows = db.execute(
        select(ChatPermission.chat_id, ChatPermission.permission).where(
            ChatPermission.user_id == user.id,
            ChatPermission.chat_id.in_(chat_ids),
        )
    ).fetchall()
    perm_by_chat = {str(r[0]): str(r[1]) for r in perms_rows}

    out: list[dict] = []
    for c in chats:
        is_owner = c.user_id == user.id
        perm = "edit" if is_owner else perm_by_chat.get(c.id)
        can_edit = perm == "edit"
        out.append(
            {
                "id": c.id,
                "user_id": c.user_id,
                "file_name": c.file_name,
                "file_url": c.file_url,
                "created_at": c.created_at,
                "can_edit": can_edit,
                "is_owner": is_owner,
            }
        )
    return out


def create_chat(db: Session, *, user: User) -> ChatSession:
    chat = ChatSession(user_id=user.id, file_name=None, file_url=None)
    db.add(chat)
    db.commit()
    db.refresh(chat)
    return chat


def get_chat(db: Session, *, user: User, chat_id: str) -> ChatSession:
    chat = db.scalar(select(ChatSession).where(ChatSession.id == chat_id))
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found.")
    _assert_can_view_chat(db, chat=chat, user=user)
    return chat


def delete_chat(db: Session, *, user: User, chat_id: str) -> None:
    chat = get_chat(db, user=user, chat_id=chat_id)
    if chat.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can delete a chat.",
        )

    # Best-effort storage deletion (only if file_url matches public URL format).
    if chat.file_url:
        storage_path = _extract_storage_path(chat.file_url)
        if storage_path:
            supabase = _get_supabase_storage_client()
            try:
                supabase.storage.from_(settings.supabase_storage_bucket).remove([storage_path])
            except Exception:
                # Don't block DB deletion if storage deletion fails.
                pass

    db.delete(chat)
    db.commit()

    # Best-effort DuckDB cleanup.
    delete_chat_db(user_id=user.id, chat_id=chat_id)


def upload_chat_file(
    db: Session,
    *,
    user: User,
    chat_id: str,
    file: UploadFile,
) -> ChatSession:
    chat = get_chat(db, user=user, chat_id=chat_id)
    _assert_can_edit_chat(db, chat=chat, user=user)
    _file_type = _validate_csv_excel(file)

    normalized_name = _normalize_filename(file.filename or "upload")
    ext = os.path.splitext(normalized_name)[1].lower()
    if not ext:
        ext = ".csv" if _file_type == "csv" else ".xlsx"

    # Create a per-user/per-chat storage path.
    storage_path = f"{user.id}/{chat.id}/{int(datetime.now().timestamp())}_{uuid.uuid4().hex}{ext}"

    content_type = mimetypes.guess_type(normalized_name)[0] or (
        "text/csv" if ext == ".csv" else "application/octet-stream"
    )

    raw = file.file.read()
    if not raw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file upload.")

    public_url: str | None = None
    supabase_error: str | None = None

    # Try Supabase first. If it fails (misconfig/bucket), fall back to local storage.
    if settings.supabase_url and settings.supabase_key:
        try:
            supabase = _get_supabase_storage_client()
            supabase.storage.from_(settings.supabase_storage_bucket).upload(
                storage_path,
                raw,
                file_options={"content-type": content_type},
            )
            public_url = _public_url_for_path(settings.supabase_storage_bucket, storage_path)
        except Exception as e:
            supabase_error = str(e)
            logger.exception("Supabase upload failed; falling back to local storage for chat %s.", chat_id)
    else:
        supabase_error = "Supabase URL/key not configured."

    if public_url is None:
        # Local (temporary) fallback so uploads still work during dev.
        backend_root = Path(__file__).resolve().parents[3]
        local_dir = backend_root / ".local_uploads" / chat.id
        local_dir.mkdir(parents=True, exist_ok=True)

        safe_name = _normalize_filename(normalized_name)
        local_path = local_dir / safe_name
        try:
            local_path.write_bytes(raw)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Supabase upload failed and local fallback storage failed: {e}",
            )

        public_url = f"local://{local_path.as_posix()}"
        if supabase_error:
            logger.warning("Using local upload fallback. Reason: %s", supabase_error)

    chat.file_name = normalized_name
    chat.file_url = public_url
    db.commit()
    db.refresh(chat)

    # Load dataset into DuckDB for query-time analytics.
    # This keeps analysis fast without re-parsing the file on every question.
    try:
        load_dataset_from_upload(
            user_id=user.id,
            chat_id=chat.id,
            file_bytes=raw,
            filename=normalized_name,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to load dataset for analytics: {e}",
        )
    return chat


def list_messages(db: Session, *, user: User, chat_id: str) -> list[ChatMessage]:
    chat = get_chat(db, user=user, chat_id=chat_id)
    stmt = (
        select(ChatMessage)
        .where(ChatMessage.chat_id == chat.id)
        .order_by(ChatMessage.created_at.asc())
    )
    return list(db.scalars(stmt).all())


def send_message(
    db: Session,
    *,
    user: User,
    chat_id: str,
    message: str,
) -> ChatMessage:
    chat = get_chat(db, user=user, chat_id=chat_id)
    _assert_can_edit_chat(db, chat=chat, user=user)
    if not chat.file_url:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Upload a file before chatting.")

    # Persist user message.
    user_msg = ChatMessage(chat_id=chat.id, user_id=user.id, role="user", content=message)
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    try:
        schema = get_table_schema(user_id=user.id, chat_id=chat.id)
        schema_text = schema_as_text(columns=schema)

        sql, explanation = generate_sql_and_explanation(
            question=message,
            table_schema=schema_text,
        )

        columns, rows = execute_sql_safe(
            user_id=user.id,
            chat_id=chat.id,
            sql=sql,
            max_rows=50,
        )

        if not rows:
            table_md = "_No rows returned._"
        else:
            table_md = format_markdown_table(columns, rows, max_rows=50)

        reply = (
            f"{explanation}\n\n"
            f"SQL:\n{sql}\n\n"
            f"Result table:\n{table_md}"
        )
    except HTTPException as e:
        # Fail safely: return a friendly message rather than exposing internals.
        reply = f"Sorry — I couldn’t answer that safely or successfully. {e.detail}"
    except Exception:
        reply = "Sorry — I couldn’t answer that from the uploaded dataset. Try rephrasing the question."

    assistant_msg = ChatMessage(
        chat_id=chat.id,
        user_id=user.id,
        role="assistant",
        content=reply,
    )
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)
    return assistant_msg

