#!/usr/bin/env python3
"""Knowledge Base Ingestion Script for Audit V RAG System.

Discovers JSON knowledge documents in datasets/knowledge/, chunks content,
generates embeddings, and upserts vectors into ChromaDB.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(backend_dir))

from app.core.logging import configure_logging
from app.rag.pipeline import ingest_knowledge_base

logger = configure_logging()


def main() -> None:
    print("=" * 60)
    print("AUDIT V KNOWLEDGE BASE INGESTION PIPELINE")
    print("=" * 60)

    try:
        results = ingest_knowledge_base()

        print("\nINGESTION COMPLETED SUCCESSFULLY!")
        print(f"  * Documents Loaded:  {results['documents_loaded']}")
        print(f"  * Chunks Created:    {results['chunks_created']}")
        print(f"  * Chunks Inserted:   {results['chunks_inserted']}")
        print(f"  * Total Vectors DB:  {results['total_vectors_in_db']}")
        print("=" * 60)
    except Exception as e:
        logger.error(f"Ingestion failed with error: {e}", exc_info=True)
        print(f"\nINGESTION FAILED: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
