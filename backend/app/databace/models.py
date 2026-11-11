"""SQLAlchemy ORM models for users and their personal workspace data."""
from __future__ import annotations

import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.orm import relationship

from app.databace.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # One-to-many relationships
    chat_messages = relationship("UserChatMessage", back_populates="user", cascade="all, delete-orphan")
    financial_entries = relationship("UserFinancialEntry", back_populates="user", cascade="all, delete-orphan")
    documents = relationship("UserDocument", back_populates="user", cascade="all, delete-orphan")
    settings = relationship("UserSetting", back_populates="user", uselist=False, cascade="all, delete-orphan")


class UserChatMessage(Base):
    """Stores AI assistant chat history per user."""
    __tablename__ = "user_chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String(20), nullable=False)   # "user" | "assistant"
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="chat_messages")


class UserFinancialEntry(Base):
    """Stores any financial data entry per user (banking, tax, investment, salary, etc.)."""
    __tablename__ = "user_financial_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category = Column(String(50), nullable=False)   # e.g. "tax", "investment", "salary"
    data = Column(JSON, nullable=False)             # flexible JSON blob
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User", back_populates="financial_entries")


class UserDocument(Base):
    """Metadata record for documents/invoices stored in the vault per user."""
    __tablename__ = "user_documents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="documents")


class UserSetting(Base):
    """Per-user application settings blob."""
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    api_url = Column(String(255), default="http://localhost:8000")
    hf_model = Column(String(255), default="Qwen/Qwen2.5-3B-Instruct")
    hf_adapter = Column(String(255), default="peterrs23/audit-v-qwen-3b")
    similarity_threshold = Column(String(10), default="0.35")

    user = relationship("User", back_populates="settings")
