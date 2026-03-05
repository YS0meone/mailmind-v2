import uuid
from datetime import datetime

from pydantic import BaseModel


class Participant(BaseModel):
    name: str | None = None
    email: str


class ThreadResponse(BaseModel):
    id: uuid.UUID
    subject: str | None
    snippet: str | None
    is_unread: bool
    is_starred: bool
    has_attachments: bool
    participants: list[Participant] | None
    last_message_at: datetime | None
    message_count: int

    model_config = {"from_attributes": True}


class EmailResponse(BaseModel):
    id: uuid.UUID
    thread_id: uuid.UUID | None
    subject: str | None
    snippet: str | None
    body_html: str | None
    from_name: str | None
    from_email: str | None
    to_list: list[Participant] | None
    cc_list: list[Participant] | None
    is_unread: bool
    is_starred: bool
    has_attachments: bool
    received_at: datetime | None

    model_config = {"from_attributes": True}


class ThreadDetailResponse(ThreadResponse):
    emails: list[EmailResponse]


class EmailUpdateRequest(BaseModel):
    is_unread: bool | None = None
    is_starred: bool | None = None


class SendEmailRequest(BaseModel):
    to: list[Participant]
    cc: list[Participant] | None = None
    bcc: list[Participant] | None = None
    subject: str
    body: str
    reply_to_message_id: str | None = None
