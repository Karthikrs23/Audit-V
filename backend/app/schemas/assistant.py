from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class SourceReference(BaseModel):
    """Metadata of knowledge source chunk used to ground response."""

    title: str
    category: str
    topic: str
    source: str
    reference: Optional[str] = None
    similarity_score: Optional[float] = None


class AuditTrail(BaseModel):
    """Structured audit trail detailing execution pipeline steps and latency."""

    intent: str = Field(description="Detected query intent.")
    tax_engine_invoked: bool = Field(default=False, description="Whether deterministic tax engine was called.")
    tax_engine_summary: Optional[Dict[str, Any]] = Field(default=None, description="Summary of tax engine inputs and outputs.")
    rag_invoked: bool = Field(default=False, description="Whether RAG knowledge vector store was queried.")
    retrieved_sources_count: int = Field(default=0, description="Number of unique grounded source documents retrieved.")
    guardrail_triggered: bool = Field(default=False, description="Whether investment/stock recommendation guardrail was triggered.")
    processing_time_ms: float = Field(default=0.0, description="Total backend processing time in milliseconds.")


class AssistantChatRequest(BaseModel):
    """Request payload for AI Assistant chat endpoint."""

    message: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="User question or query text.",
    )
    stream: bool = Field(
        default=True,
        description="Whether to stream response tokens via Server-Sent Events (SSE).",
    )

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Query message cannot be empty or consist solely of whitespace.")
        if len(v) > 2000:
            raise ValueError("Query message exceeds maximum allowed length of 2000 characters.")
        return v.strip()


class AssistantChatResponse(BaseModel):
    """Structured response from Audit V AI Assistant."""

    answer: str
    intent: str
    sources: List[SourceReference] = Field(default_factory=list)
    used_rag: bool = False
    used_tax_engine: bool = False
    calculation: Optional[Dict[str, Any]] = None
    insufficient_grounding: bool = False
    audit_trail: Optional[AuditTrail] = None
    disclaimer: str = (
        "Audit V AI Assistant provides information grounded in tax rules and database context. "
        "It does not constitute official legal or tax filing guarantees."
    )
