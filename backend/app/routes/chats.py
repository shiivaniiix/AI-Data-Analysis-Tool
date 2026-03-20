from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.chats_api import ChatMessageResponse, ChatSessionResponse, SendMessageRequest
from app.models.chat_permissions import ChatPermission
from app.models.chat import ChatSession
from app.models.user import User
from app.services.chat_service import (
    create_chat,
    delete_chat,
    get_chat,
    list_chats,
    list_chats_with_access,
    list_messages,
    send_message,
    upload_chat_file,
)
from app.services.ai_service import generate_ai_insights
from app.services.duckdb_service import (
    export_filtered_data_csv,
    get_chart_data,
    get_suggested_charts_and_summary,
)
from app.services.export_service import export_docx_report, export_pdf_report
from app.services.token_service import get_current_user
from app.services.token_service import create_share_token, decode_share_token
from app.utils.db import get_db

from pydantic import BaseModel, ConfigDict
from typing import Literal


router = APIRouter(prefix="/chats", tags=["chats"])


@router.get("", response_model=list[ChatSessionResponse])
def get_user_chats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ChatSessionResponse]:
    return list_chats_with_access(db, user=current_user)


@router.post("", response_model=ChatSessionResponse, status_code=status.HTTP_201_CREATED)
def create_user_chat(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatSessionResponse:
    chat = create_chat(db, user=current_user)
    return {
        "id": chat.id,
        "user_id": chat.user_id,
        "file_name": chat.file_name,
        "file_url": chat.file_url,
        "created_at": chat.created_at,
        "can_edit": True,
        "is_owner": True,
    }


@router.delete("/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_chat(
    chat_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    delete_chat(db, user=current_user, chat_id=chat_id)


@router.post("/{chat_id}/upload", response_model=ChatSessionResponse)
def upload_chat(
    chat_id: str,
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatSessionResponse:
    print("Received file:", file.filename)
    chat = upload_chat_file(db, user=current_user, chat_id=chat_id, file=file)
    return {
        "id": chat.id,
        "user_id": chat.user_id,
        "file_name": chat.file_name,
        "file_url": chat.file_url,
        "created_at": chat.created_at,
        "can_edit": True,
        "is_owner": chat.user_id == current_user.id,
    }


@router.get("/{chat_id}/messages", response_model=list[ChatMessageResponse])
def get_chat_messages(
    chat_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ChatMessageResponse]:
    return list_messages(db, user=current_user, chat_id=chat_id)


@router.post("/{chat_id}/messages", response_model=ChatMessageResponse)
def post_chat_message(
    chat_id: str,
    payload: SendMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatMessageResponse:
    return send_message(db, user=current_user, chat_id=chat_id, message=payload.message)


class ChartDataRequest(BaseModel):
    chart_kind: str  # "bar" | "line" | "pie"
    x_column: str | None = None
    y_column: str | None = None
    filter_column: str | None = None
    filter_values: list[str] | None = None
    limit: int | None = None

    model_config = ConfigDict(extra="forbid")


@router.get("/{chat_id}/insights")
def chat_insights(
    chat_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Authorization: view access is required.
    _ = get_chat(db, user=current_user, chat_id=chat_id)
    # Compute charts + summary from DuckDB for this chat.
    data = get_suggested_charts_and_summary(user_id=current_user.id, chat_id=chat_id)
    insights = generate_ai_insights(
        summary=data["summary"],
        suggested_charts=data["suggested_charts"],
    )
    return {
        **data,
        "insights": insights,
    }


@router.post("/{chat_id}/chart-data")
def chart_data(
    chat_id: str,
    payload: ChartDataRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = get_chat(db, user=current_user, chat_id=chat_id)
    data = get_chart_data(
        user_id=current_user.id,
        chat_id=chat_id,
        chart_kind=payload.chart_kind,
        x_column=payload.x_column,
        y_column=payload.y_column,
        filter_column=payload.filter_column,
        filter_values=payload.filter_values,
        limit=payload.limit or 10,
    )
    return {"data": data}


class DataCsvRequest(BaseModel):
    filter_column: str | None = None
    filter_values: list[str] | None = None
    limit_rows: int = 10000

    model_config = ConfigDict(extra="forbid")


@router.post("/{chat_id}/data-csv")
def data_csv(
    chat_id: str,
    payload: DataCsvRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = get_chat(db, user=current_user, chat_id=chat_id)
    import io

    from fastapi.responses import Response

    csv_str = export_filtered_data_csv(
        user_id=current_user.id,
        chat_id=chat_id,
        filter_column=payload.filter_column,
        filter_values=payload.filter_values,
        limit_rows=payload.limit_rows,
    )

    headers = {
        "Content-Disposition": f'attachment; filename="chat_{chat_id}_data.csv"'
    }
    return Response(content=csv_str, media_type="text/csv", headers=headers)


class ExportRequest(BaseModel):
    filter_column: str | None = None
    filter_values: list[str] | None = None
    limit_rows: int = 10000

    model_config = ConfigDict(extra="forbid")


@router.post("/{chat_id}/export/csv")
def export_csv(
    chat_id: str,
    payload: ExportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = get_chat(db, user=current_user, chat_id=chat_id)
    csv_str = export_filtered_data_csv(
        user_id=current_user.id,
        chat_id=chat_id,
        filter_column=payload.filter_column,
        filter_values=payload.filter_values,
        limit_rows=payload.limit_rows,
    )
    headers = {
        "Content-Disposition": f'attachment; filename="chat_{chat_id}_export.csv"'
    }
    return Response(content=csv_str, media_type="text/csv", headers=headers)


@router.post("/{chat_id}/export/pdf")
def export_pdf(
    chat_id: str,
    payload: ExportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = get_chat(db, user=current_user, chat_id=chat_id)
    pdf_bytes = export_pdf_report(
        user_id=current_user.id,
        chat_id=chat_id,
        filter_column=payload.filter_column,
        filter_values=payload.filter_values,
    )
    headers = {
        "Content-Disposition": f'attachment; filename="chat_{chat_id}_report.pdf"'
    }
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)


@router.post("/{chat_id}/export/docx")
def export_docx(
    chat_id: str,
    payload: ExportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = get_chat(db, user=current_user, chat_id=chat_id)
    docx_bytes = export_docx_report(
        user_id=current_user.id,
        chat_id=chat_id,
        filter_column=payload.filter_column,
        filter_values=payload.filter_values,
    )
    headers = {
        "Content-Disposition": f'attachment; filename="chat_{chat_id}_report.docx"'
    }
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers=headers,
    )


class ShareLinkRequest(BaseModel):
    permission: Literal["view", "edit"] = "view"

    model_config = ConfigDict(extra="forbid")


class AcceptShareRequest(BaseModel):
    token: str

    model_config = ConfigDict(extra="forbid")


@router.post("/{chat_id}/share-link")
def create_share_link(
    chat_id: str,
    payload: ShareLinkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chat = get_chat(db, user=current_user, chat_id=chat_id)
    if chat.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner can share this chat.")

    share_token = create_share_token(chat_id=chat.id, permission=payload.permission)
    return {"share_token": share_token}


@router.post("/accept-share")
def accept_share(
    payload: AcceptShareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    decoded = decode_share_token(token=payload.token)
    chat_id = decoded["chat_id"]
    permission = decoded["perm"]

    chat = db.scalar(select(ChatSession).where(ChatSession.id == chat_id))
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found.")

    existing = db.scalar(
        select(ChatPermission.permission).where(
            ChatPermission.chat_id == chat_id,
            ChatPermission.user_id == current_user.id,
        )
    )

    if existing is None:
        db.add(
            ChatPermission(
                chat_id=chat_id,
                user_id=current_user.id,
                permission=permission,
            )
        )
    elif existing != "edit" and permission == "edit":
        # Upgrade to edit if previously only view.
        db.execute(
            ChatPermission.__table__.update()
            .where(
                ChatPermission.__table__.c.chat_id == chat_id,
                ChatPermission.__table__.c.user_id == current_user.id,
            )
            .values(permission="edit")
        )

    db.commit()
    return {"chat_id": chat_id, "permission": permission}

