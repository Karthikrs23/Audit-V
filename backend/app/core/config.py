from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Typed application settings loaded from environment variables.

    The values are resolved from the backend/.env file in development and from
    the process environment in deployment.
    """

    PROJECT_NAME: str = "Audit V"
    PROJECT_VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: Literal["development", "testing", "production"] = "development"
    DEBUG: bool = False

    BACKEND_CORS_ORIGINS: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
    )

    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "audit_v"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"

    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/audit_v"

    CHROMA_HOST: str = "localhost"
    CHROMA_PORT: int = 8000
    CHROMA_COLLECTION_NAME: str = "audit_v_knowledge"
    CHROMA_PERSIST_DIRECTORY: str = str(BASE_DIR / "models" / "chroma")

    # Production LLM & Fine-Tuned Adapter Settings
    HF_MODEL_NAME: str = "Qwen/Qwen2.5-3B-Instruct"
    HF_ADAPTER_REPO: str = "peterrs23/audit-v-qwen-3b"
    HF_API_TOKEN: str | None = None
    EMBEDDING_MODEL_NAME: str = "sentence-transformers/all-MiniLM-L6-v2"

    LLM_MAX_NEW_TOKENS: int = 300
    LLM_TEMPERATURE: float = 0.2

    RAG_TOP_K: int = 5
    RAG_MIN_SIMILARITY_THRESHOLD: float = 0.35
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50

    # Market Intelligence & Twelve Data Settings
    TWELVE_DATA_API_KEY: str | None = None
    MARKET_CACHE_TTL_SECONDS: int = 60  # 1-minute market update cycle
    TWELVE_DATA_DAILY_LIMIT: int = 800  # 800 requests/day Twelve Data free tier limit

    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached settings instance for dependency injection."""
    return Settings()
