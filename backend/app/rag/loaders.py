from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List
from app.core.logging import configure_logging

logger = configure_logging()


class DocumentLoader:
    """Discovers and loads JSON knowledge documents from datasets/knowledge/."""

    def __init__(self, knowledge_dir: Path | str | None = None) -> None:
        if knowledge_dir is None:
            # Base directory resolved relative to backend root
            backend_dir = Path(__file__).resolve().parents[2]
            root_dir = backend_dir.parent
            self.knowledge_dir = root_dir / "datasets" / "knowledge"
        else:
            self.knowledge_dir = Path(knowledge_dir)

    def load_all_documents(self) -> List[Dict[str, Any]]:
        """Discover and parse all JSON documents under income_tax, gst, and financial subdirectories."""
        documents: List[Dict[str, Any]] = []

        if not self.knowledge_dir.exists():
            logger.warning(f"Knowledge directory {self.knowledge_dir} does not exist.")
            return documents

        for json_path in self.knowledge_dir.rglob("*.json"):
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    doc = json.load(f)

                # Validate required metadata fields
                required_fields = ["title", "category", "topic", "source", "content"]
                if all(field in doc for field in required_fields):
                    doc["file_path"] = str(json_path)
                    documents.append(doc)
                else:
                    logger.warning(f"Skipping {json_path}: missing required metadata fields.")
            except Exception as e:
                logger.error(f"Error reading JSON file {json_path}: {e}")

        logger.info(f"Successfully loaded {len(documents)} knowledge documents.")
        return documents
