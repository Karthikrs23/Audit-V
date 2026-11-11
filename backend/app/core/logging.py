from __future__ import annotations

import json
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
import sys
from typing import Any, Dict, Optional
from datetime import datetime, timezone

from app.core.config import get_settings


class JSONFormatter(logging.Formatter):
    """Custom logging formatter that outputs log records as structured JSON."""

    def format(self, record: logging.LogRecord) -> str:
        log_data: Dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Include structured fields if available
        if hasattr(record, "structured_data"):
            log_data.update(getattr(record, "structured_data"))

        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_data, ensure_ascii=False)


def configure_logging() -> logging.Logger:
    """Configure the application logger with stdout and rotating JSON file handler."""
    settings = get_settings()

    logger = logging.getLogger("audit_v")
    logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))

    if logger.handlers:
        return logger

    # Ensure backend/logs directory exists
    log_dir = Path(__file__).resolve().parents[2] / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / "audit_v.log"

    json_formatter = JSONFormatter()

    # Rotating file handler (5 MB max per file, 5 backup files)
    file_handler = RotatingFileHandler(
        log_file, maxBytes=5_000_000, backupCount=5, encoding="utf-8"
    )
    file_handler.setFormatter(json_formatter)
    logger.addHandler(file_handler)

    import io

    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    # Console stdout handler with utf-8 encoding
    stdout_formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
    )
    safe_stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace") if hasattr(sys.stdout, "buffer") else sys.stdout
    stream_handler = logging.StreamHandler(safe_stdout)
    stream_handler.setFormatter(stdout_formatter)
    logger.addHandler(stream_handler)

    logger.propagate = False
    return logger


def get_logger(name: str | None = None) -> logging.Logger:
    """Return a namespaced logger for application modules."""
    logger = configure_logging()
    return logger.getChild(name or "app") if name else logger


def log_structured_event(
    logger: logging.Logger,
    engine: str,
    processing_time_ms: float,
    status: str,
    metadata: Optional[Dict[str, Any]] = None,
    level: int = logging.INFO,
) -> None:
    """Log a structured request execution event to JSON log output."""
    structured_data = {
        "engine": engine,
        "processing_time_ms": round(processing_time_ms, 2),
        "status": status,
        "metadata": metadata or {},
    }
    msg = f"[{engine}] Executed request in {processing_time_ms:.2f}ms (Status: {status})"
    logger.log(level, msg, extra={"structured_data": structured_data})
