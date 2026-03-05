import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import UserDefinedType

from app.db.database import Base


class TSVector(UserDefinedType):
    cache_ok = True

    def get_col_spec(self):
        return "TSVECTOR"


class Email(Base):
    __tablename__ = "emails"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("email_accounts.id", ondelete="CASCADE"), nullable=False
    )
    thread_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("threads.id", ondelete="SET NULL")
    )
    nylas_message_id: Mapped[str] = mapped_column(String(255), nullable=False)
    nylas_thread_id: Mapped[str | None] = mapped_column(String(255))
    subject: Mapped[str | None] = mapped_column(Text)
    snippet: Mapped[str | None] = mapped_column(Text)
    body_html: Mapped[str | None] = mapped_column(Text)
    from_name: Mapped[str | None] = mapped_column(String(255))
    from_email: Mapped[str | None] = mapped_column(String(320))
    to_list: Mapped[dict | None] = mapped_column(JSONB)
    cc_list: Mapped[dict | None] = mapped_column(JSONB)
    bcc_list: Mapped[dict | None] = mapped_column(JSONB)
    reply_to: Mapped[dict | None] = mapped_column(JSONB)
    is_unread: Mapped[bool] = mapped_column(Boolean, default=True)
    is_starred: Mapped[bool] = mapped_column(Boolean, default=False)
    folder_ids: Mapped[dict | None] = mapped_column(JSONB)
    has_attachments: Mapped[bool] = mapped_column(Boolean, default=False)
    received_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Full-text search (populated by database trigger)
    search_vector = mapped_column(TSVector(), nullable=True)
    search_text: Mapped[str | None] = mapped_column(Text)

    # AI fields (populated by triage agent in M3)
    ai_category: Mapped[str | None] = mapped_column(String(50))
    ai_priority: Mapped[str | None] = mapped_column(String(20))
    ai_summary: Mapped[str | None] = mapped_column(Text)

    # Vector store ref (populated in M4)
    qdrant_point_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))

    thread: Mapped["Thread | None"] = relationship(back_populates="emails")
