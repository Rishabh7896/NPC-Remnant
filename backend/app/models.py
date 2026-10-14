from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Text, Float, Integer, ForeignKey, DateTime
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


class CartRow(Base):
    __tablename__ = "carts"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"), index=True)
    vendor_id: Mapped[str] = mapped_column(String, index=True)
    state: Mapped[str] = mapped_column(String, default="building_cart")
    items_json: Mapped[str] = mapped_column(Text, default="[]")
    subtotal: Mapped[int] = mapped_column(Integer, default=0)
    discount_amount: Mapped[int] = mapped_column(Integer, default=0)
    discount_reason: Mapped[str] = mapped_column(String, default="")
    total: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class OrderRow(Base):
    __tablename__ = "orders"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"), index=True)
    vendor_id: Mapped[str] = mapped_column(String, index=True)
    vendor_name: Mapped[str] = mapped_column(String)
    items_json: Mapped[str] = mapped_column(Text)
    subtotal: Mapped[int] = mapped_column(Integer)
    discount_applied: Mapped[int] = mapped_column(Integer, default=0)
    total_amount: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String, default="confirmed")
    idempotency_key: Mapped[str] = mapped_column(String, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class WalletTransactionRow(Base):
    __tablename__ = "wallet_transactions"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"), index=True)
    amount: Mapped[int] = mapped_column(Integer)
    balance_after: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String)
    reference_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class InventoryStockRow(Base):
    __tablename__ = "inventory_stock"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"), index=True)
    product_id: Mapped[str] = mapped_column(String, index=True)
    vendor_id: Mapped[str] = mapped_column(String, index=True)
    stock_quantity: Mapped[int] = mapped_column(Integer, default=40)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

