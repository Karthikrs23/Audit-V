from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional
import chromadb
from chromadb.config import Settings as ChromaSettings
from app.core.config import get_settings
from app.core.logging import configure_logging

logger = configure_logging()


class VectorStore:
    """Persistent ChromaDB vector database manager."""

    def __init__(
        self,
        persist_dir: Optional[str] = None,
        collection_name: Optional[str] = None,
    ) -> None:
        settings = get_settings()
        self.persist_dir = Path(persist_dir or settings.CHROMA_PERSIST_DIRECTORY)
        self.collection_name = collection_name or settings.CHROMA_COLLECTION_NAME

        # Ensure directory exists
        self.persist_dir.mkdir(parents=True, exist_ok=True)

        self.client = chromadb.PersistentClient(
            path=str(self.persist_dir),
            settings=ChromaSettings(allow_reset=True, anonymized_telemetry=False),
        )

        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            embedding_function=None,
            metadata={"hnsw:space": "cosine"},
        )
        logger.info(
            f"ChromaDB initialized at {self.persist_dir} (Collection: '{self.collection_name}')"
        )

    def upsert_chunks(
        self,
        chunks: List[Dict[str, Any]],
        embeddings: List[List[float]],
    ) -> int:
        """Upsert text chunks and their precomputed embeddings into ChromaDB."""
        if not chunks or not embeddings:
            return 0

        unique_chunks: List[Dict[str, Any]] = []
        unique_embeddings: List[List[float]] = []
        seen_ids = set()

        for c, emb in zip(chunks, embeddings):
            cid = c["chunk_id"]
            if cid not in seen_ids:
                seen_ids.add(cid)
                unique_chunks.append(c)
                unique_embeddings.append(emb)

        ids = [c["chunk_id"] for c in unique_chunks]
        documents = [c["content"] for c in unique_chunks]
        metadatas = [c["metadata"] for c in unique_chunks]

        self.collection.upsert(
            ids=ids,
            embeddings=unique_embeddings,
            documents=documents,
            metadatas=metadatas,
        )

        logger.info(f"Upserted {len(ids)} unique chunks into ChromaDB collection '{self.collection_name}'.")
        return len(ids)

    def query(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        category_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Query top_k most relevant text chunks matching the embedding vector."""
        where_clause = {"category": category_filter} if category_filter else None

        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            where=where_clause,
            include=["documents", "metadatas", "distances"],
        )

        retrieved_items: List[Dict[str, Any]] = []

        if results and results.get("documents") and len(results["documents"]) > 0:
            docs = results["documents"][0]
            metas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(docs)
            ids = results["ids"][0] if results.get("ids") else [""] * len(docs)
            distances = (
                results["distances"][0] if results.get("distances") else [0.0] * len(docs)
            )

            for i in range(len(docs)):
                similarity = round(max(0.0, 1.0 - float(distances[i])), 4)
                retrieved_items.append(
                    {
                        "chunk_id": ids[i],
                        "content": docs[i],
                        "metadata": metas[i],
                        "similarity_score": similarity,
                        "distance": float(distances[i]),
                    }
                )

        return retrieved_items

    def count(self) -> int:
        """Return total number of vectors in collection."""
        return self.collection.count()

    def clear(self) -> None:
        """Delete all existing items in the collection."""
        try:
            self.client.delete_collection(self.collection_name)
            self.collection = self.client.get_or_create_collection(
                name=self.collection_name,
                embedding_function=None,
                metadata={"hnsw:space": "cosine"},
            )
            logger.info(f"Cleared collection '{self.collection_name}'.")
        except Exception as e:
            logger.warning(f"Error clearing collection '{self.collection_name}': {e}")
