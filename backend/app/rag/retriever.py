from __future__ import annotations

from typing import Any, Dict, List, Optional
from app.core.config import get_settings
from app.rag.embeddings import EmbeddingService
from app.rag.vector_store import VectorStore


class KnowledgeRetriever:
    """Retriever service for semantic search over Audit V tax & financial knowledge base."""

    def __init__(
        self,
        vector_store: Optional[VectorStore] = None,
        embedding_service: Optional[EmbeddingService] = None,
    ) -> None:
        self.settings = get_settings()
        self.vector_store = vector_store or VectorStore()
        self.embedding_service = embedding_service or EmbeddingService()

    def retrieve(
        self,
        query: str,
        top_k: Optional[int] = None,
        category_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Retrieve top_k most relevant knowledge chunks matching user query."""
        if not query or not query.strip():
            return []

        k = top_k or self.settings.RAG_TOP_K
        query_vector = self.embedding_service.embed_text(query.strip())
        results = self.vector_store.query(
            query_embedding=query_vector,
            top_k=k,
            category_filter=category_filter,
        )
        return results
