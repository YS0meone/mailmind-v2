import uuid
from datetime import datetime

from pydantic import BaseModel


class NylasCallbackRequest(BaseModel):
    code: str
    redirect_uri: str | None = None


class AuthResponse(BaseModel):
    token: str
    user_id: uuid.UUID
    email: str
    nylas_grant_id: str


class EmailAccountResponse(BaseModel):
    id: uuid.UUID
    email_address: str
    provider: str
    is_active: bool
    last_sync_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str | None
    avatar_url: str | None

    model_config = {"from_attributes": True}
