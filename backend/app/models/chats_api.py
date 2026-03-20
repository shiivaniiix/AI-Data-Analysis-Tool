from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ChatSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    file_name: str | None
    file_url: str | None
    created_at: datetime
    can_edit: bool
    is_owner: bool


class ChatMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    chat_id: str
    user_id: str
    role: str
    content: str
    created_at: datetime


class SendMessageRequest(BaseModel):
    message: str

