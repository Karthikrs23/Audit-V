"""Pydantic schemas for user auth and personal data endpoints."""
from __future__ import annotations

import datetime
from typing import Any
from pydantic import BaseModel, EmailStr, Field


# ─── Auth Schemas ──────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    full_name: str | None = None
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: str | None
    created_at: datetime.datetime

    model_config = {"from_attributes": True}


# ─── Chat Schemas ──────────────────────────────────────────────────────────────

class ChatMessageIn(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class ChatMessageOut(BaseModel):
    id: int
    role: str
    content: str
    timestamp: datetime.datetime

    model_config = {"from_attributes": True}


# ─── Financial Entry Schemas ───────────────────────────────────────────────────

class FinancialEntryIn(BaseModel):
    category: str   # "tax" | "investment" | "salary" | "banking" | etc.
    data: dict[str, Any]


class FinancialEntryOut(BaseModel):
    id: int
    category: str
    data: dict[str, Any]
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = {"from_attributes": True}


# ─── Document Schemas ──────────────────────────────────────────────────────────

class DocumentIn(BaseModel):
    filename: str
    file_type: str | None = None
    notes: str | None = None


class DocumentOut(BaseModel):
    id: int
    filename: str
    file_type: str | None
    notes: str | None
    created_at: datetime.datetime

    model_config = {"from_attributes": True}


# ─── Settings Schemas ──────────────────────────────────────────────────────────

class UserSettingsIn(BaseModel):
    api_url: str | None = None
    hf_model: str | None = None
    hf_adapter: str | None = None
    similarity_threshold: str | None = None


class UserSettingsOut(BaseModel):
    api_url: str
    hf_model: str
    hf_adapter: str
    similarity_threshold: str

    model_config = {"from_attributes": True}
