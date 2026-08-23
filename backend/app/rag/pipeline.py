from __future__ import annotations

import sys
from typing import Dict, Any
from app.core.logging import configure_logging
from app.rag.chunker import TextChunker
from app.rag.embeddings import EmbeddingService
from app.rag.loaders import DocumentLoader
from app.rag.retriever import KnowledgeRetriever
from app.rag.vector_store import VectorStore

logger = configure_logging()


def ingest_knowledge_base() -> Dict[str, Any]:
    """Ingests all knowledge documents from datasets/knowledge/ into ChromaDB."""
    logger.info("Starting knowledge base ingestion...")
    sys.stdout.flush()

    loader = DocumentLoader()
    chunker = TextChunker()
    embeddings_service = EmbeddingService()
    vector_store = VectorStore()
    vector_store.clear()

    documents = loader.load_all_documents()
    logger.info(f"Loaded {len(documents)} documents. Starting chunking...")
    sys.stdout.flush()

    all_chunks = []
    for doc in documents:
        chunks = chunker.chunk_document(doc)
        all_chunks.extend(chunks)

    logger.info(f"Created {len(all_chunks)} chunks. Generating embeddings...")
    sys.stdout.flush()

    if not all_chunks:
        logger.warning("No text chunks generated for ingestion.")
        return {"documents_loaded": len(documents), "chunks_created": 0, "chunks_inserted": 0}

    chunk_texts = [c["content"] for c in all_chunks]
    vectors = embeddings_service.embed_documents(chunk_texts)
    logger.info(f"Generated {len(vectors)} vector embeddings. Inserting into ChromaDB...")
    sys.stdout.flush()

    inserted_count = vector_store.upsert_chunks(all_chunks, vectors)
    total_vectors = vector_store.count()
    logger.info(f"Upserted {inserted_count} chunks into ChromaDB. Total vectors in collection: {total_vectors}")
    sys.stdout.flush()

    result = {
        "documents_loaded": len(documents),
        "chunks_created": len(all_chunks),
        "chunks_inserted": inserted_count,
        "total_vectors_in_db": total_vectors,
    }
    return result


def get_retriever() -> KnowledgeRetriever:
    """Return a configured KnowledgeRetriever singleton instance."""
    return KnowledgeRetriever()
