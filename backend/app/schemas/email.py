import uuid
from datetime import datetime

from pydantic import BaseModel


class Participant(BaseModel):
    name: str | None = None
    email: str


class LabelBrief(BaseModel):
    id: uuid.UUID
    name: str
    color: str

    model_config = {"from_attributes": True}


class LabelResponse(LabelBrief):
    description: str | None
    rules: dict | None
    is_preset: bool
    position: int


class LabelCreateRequest(BaseModel):
    name: str
    color: str
    description: str | None = None
    rules: dict | None = None


class LabelUpdateRequest(BaseModel):
    name: str | None = None
    color: str | None = None
    description: str | None = None
    rules: dict | None = None
    position: int | None = None


class ThreadLabelsRequest(BaseModel):
    label_ids: list[uuid.UUID]


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
    labels: list[LabelBrief] = []

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
    draft_id: str | None = None


# --- Drafts ---


class DraftCreateRequest(BaseModel):
    subject: str | None = None
    body: str | None = None
    to: list[Participant] | None = None
    cc: list[Participant] | None = None
    bcc: list[Participant] | None = None
    mode: str = "compose"
    reply_to_message_id: str | None = None
    thread_id: str | None = None


class DraftUpdateRequest(BaseModel):
    subject: str | None = None
    body: str | None = None
    to: list[Participant] | None = None
    cc: list[Participant] | None = None
    bcc: list[Participant] | None = None


class DraftResponse(BaseModel):
    id: uuid.UUID
    subject: str | None
    body: str | None
    to_list: list[Participant] | None
    cc_list: list[Participant] | None
    bcc_list: list[Participant] | None
    mode: str
    reply_to_message_id: uuid.UUID | None
    thread_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DraftListItem(BaseModel):
    id: uuid.UUID
    subject: str | None
    to_list: list[Participant] | None
    mode: str
    thread_id: uuid.UUID | None
    updated_at: datetime

    model_config = {"from_attributes": True}
