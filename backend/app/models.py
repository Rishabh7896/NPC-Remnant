from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Text, Float, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

def now_utc(): return datetime.now(timezone.utc)

class SessionRow(Base):
    __tablename__ = "sessions"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    player_name: Mapped[str] = mapped_column(String, default="Visitor")
    scenario_id: Mapped[str] = mapped_column(String, default="evening_food_plaza")
    game_state_json: Mapped[str] = mapped_column(Text)
    mission_state_json: Mapped[str] = mapped_column(Text)
    relationship_trust: Mapped[float] = mapped_column(Float, default=0.5)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

class MessageRow(Base):
    __tablename__ = "messages"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"), index=True)
    role: Mapped[str] = mapped_column(String)
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

class MemoryRow(Base):
    __tablename__ = "memories"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"), index=True)
    claim_key: Mapped[str] = mapped_column(String, index=True)
    claim_text: Mapped[str] = mapped_column(Text)
    subject: Mapped[str] = mapped_column(String, index=True)
    predicate: Mapped[str] = mapped_column(String, index=True)
    value: Mapped[str] = mapped_column(String)
    source_type: Mapped[str] = mapped_column(String)
    source_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    confidence: Mapped[float] = mapped_column(Float, default=0.5)
    status: Mapped[str] = mapped_column(String, default="unverified")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

class ConflictRow(Base):
    __tablename__ = "conflicts"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"), index=True)
    memory_a_id: Mapped[str] = mapped_column(ForeignKey("memories.id"))
    memory_b_id: Mapped[str] = mapped_column(ForeignKey("memories.id"))
    status: Mapped[str] = mapped_column(String, default="unresolved")
    resolution_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
