from __future__ import annotations

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import router as v1_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.databace.database import Base, engine

settings = get_settings()
logger = configure_logging()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description="LLM-Based Tax Compliance, Anomaly Detection & Financial Advisory System",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Return structured HTTP 400 JSON response on Pydantic validation failure."""
    errors = []
    for err in exc.errors():
        loc_parts = [str(p) for p in err.get("loc", []) if p not in ("body", "query", "path")]
        field_name = " -> ".join(loc_parts) if loc_parts else "body"
        msg = err.get("msg", "Invalid input value")
        if msg.startswith("Value error, "):
            msg = msg[len("Value error, "):]
        errors.append({
            "field": field_name,
            "message": msg,
            "type": err.get("type", "value_error"),
        })
    first_msg = errors[0]["message"] if errors else "Input validation failed."
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "status_code": 400,
            "detail": f"Input validation failed: {first_msg}",
            "errors": errors,
        },
    )


@app.get("/")
def root() -> dict[str, str]:
    """Public landing endpoint for the Audit V backend."""
    return {
        "project": settings.PROJECT_NAME,
        "status": "running",
        "message": "Welcome to Audit V API 🚀",
    }


@app.on_event("startup")
def startup_event() -> None:
    """Initialize runtime logging, create DB tables, and startup diagnostics."""
    # Create all SQLite tables for user auth & personal data storage
    import app.databace.models  # noqa: F401 – ensures models are registered
    Base.metadata.create_all(bind=engine)

    logger.info(
        "Audit V API startup complete",
        extra={
            "environment": settings.ENVIRONMENT,
            "debug": settings.DEBUG,
        },
    )

    # Pre-warm Qwen LLM model asynchronously in background thread
    import threading
    from app.services.llm_service import warmup_model

    threading.Thread(target=warmup_model, daemon=True).start()

