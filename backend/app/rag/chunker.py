from __future__ import annotations

import hashlib
from typing import Any, Dict, List
from app.core.config import get_settings


class TextChunker:
    """Configurable text chunker preserving document metadata and sentence boundaries."""

    def __init__(self, chunk_size: int | None = None, chunk_overlap: int | None = None) -> None:
        settings = get_settings()
        self.chunk_size = chunk_size or settings.CHUNK_SIZE
        self.chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP

    def _generate_chunk_id(self, doc_topic: str, content: str, index: int) -> str:
        """Create a deterministic unique chunk ID based on doc topic, chunk index, and content hash."""
        digest = hashlib.sha256(f"{doc_topic}:{index}:{content}".encode("utf-8")).hexdigest()[:16]
        return f"chunk_{digest}"

    def chunk_document(self, document: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Splits document content into overlapping text chunks attached with metadata."""
        content = document.get("content", "").strip()
        if not content:
            return []

        chunks: List[Dict[str, Any]] = []
        doc_title = str(document.get("title", ""))
        doc_cat = str(document.get("category", ""))
        doc_topic = str(document.get("topic", ""))
        doc_src = str(document.get("source", ""))
        doc_ref = str(document.get("reference", "") or "")

        header_prefix = f"[{doc_title} - {doc_topic}] "

        # If document content fits within chunk_size, keep as single chunk
        if len(content) <= self.chunk_size:
            full_content = f"{header_prefix}{content}"
            chunk_id = self._generate_chunk_id(doc_topic, full_content, 0)
            chunks.append(
                {
                    "chunk_id": chunk_id,
                    "content": full_content,
                    "metadata": {
                        "title": doc_title,
                        "category": doc_cat,
                        "topic": doc_topic,
                        "source": doc_src,
                        "reference": doc_ref,
                        "chunk_index": 0,
                    },
                }
            )
            return chunks

        # Sliding window chunking
        start = 0
        chunk_idx = 0
        while start < len(content):
            end = start + self.chunk_size
            chunk_text = content[start:end]

            # Attempt to end at sentence or clause boundary
            if end < len(content):
                last_period = max(chunk_text.rfind(". "), chunk_text.rfind("; "))
                if last_period > self.chunk_size // 2:
                    chunk_text = chunk_text[: last_period + 1]

            chunk_text_clean = chunk_text.strip()
            if chunk_text_clean:
                if len(chunk_text_clean) < 120 and chunks:
                    chunks[-1]["content"] += " " + chunk_text_clean
                    break
                full_content = f"{header_prefix}{chunk_text_clean}"
                chunk_id = self._generate_chunk_id(doc_topic, full_content, chunk_idx)
                chunks.append(
                    {
                        "chunk_id": chunk_id,
                        "content": full_content,
                        "metadata": {
                            "title": doc_title,
                            "category": doc_cat,
                            "topic": doc_topic,
                            "source": doc_src,
                            "reference": doc_ref,
                            "chunk_index": chunk_idx,
                        },
                    }
                )
                chunk_idx += 1

            advance = max(1, len(chunk_text) - self.chunk_overlap)
            start += advance

            if start >= len(content) or len(chunk_text) == 0:
                break

        return chunks
