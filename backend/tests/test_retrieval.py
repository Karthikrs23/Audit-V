from __future__ import annotations

import pytest
from app.rag.loaders import DocumentLoader
from app.rag.chunker import TextChunker
from app.rag.embeddings import EmbeddingService
from app.rag.vector_store import VectorStore
from app.rag.retriever import KnowledgeRetriever


@pytest.fixture(scope="module")
def setup_knowledge_db(tmp_path_factory):
    """Module-level test fixture setting up temporary ChromaDB collection and ingesting test documents."""
    test_db_dir = tmp_path_factory.mktemp("chroma_test")
    loader = DocumentLoader()
    chunker = TextChunker()
    embeddings_service = EmbeddingService()
    vector_store = VectorStore(
        persist_dir=str(test_db_dir), collection_name="test_audit_v_knowledge"
    )

    documents = loader.load_all_documents()
    all_chunks = []
    for doc in documents:
        chunks = chunker.chunk_document(doc)
        all_chunks.extend(chunks)

    if all_chunks:
        chunk_texts = [c["content"] for c in all_chunks]
        vectors = embeddings_service.embed_documents(chunk_texts)
        vector_store.upsert_chunks(all_chunks, vectors)

    retriever = KnowledgeRetriever(
        vector_store=vector_store, embedding_service=embeddings_service
    )
    return retriever


def test_retrieval_suite_accuracy(setup_knowledge_db):
    """Retrieval Test Suite: Runs 20 distinct domain questions and measures vector retrieval accuracy."""
    retriever = setup_knowledge_db

    test_cases = [
        ("What is Section 80C?", "Section 80C"),
        ("What is Section 80D health insurance deduction?", "Section 80D"),
        ("What is Section 80CCD NPS deduction?", "Section 80CCD"),
        ("How to claim HRA exemption under Section 10(13A)?", "HRA Exemption"),
        ("What is the standard deduction for salaried employees?", "Standard Deduction"),
        ("What is the New Tax Regime Section 115BAC?", "Tax Regimes"),
        ("What are Section 87A rebate rules?", "Section 87A Rebate"),
        ("How much is Health and Education Cess?", "Surcharge and Cess"),
        ("What is Gross Total Income vs Taxable Income?", "Basic Tax Concepts"),
        ("What is Goods and Services Tax (GST)?", "GST Basics"),
        ("What are GST registration threshold limits?", "GST Registration"),
        ("How to claim Input Tax Credit under GST?", "Input Tax Credit"),
        ("What is the GST Composition Scheme?", "Composition Scheme"),
        ("What is GSTR-1 and GSTR-3B compliance filing?", "GST Compliance"),
        ("What are basic investment asset classes?", "Investment Basics"),
        ("What is portfolio diversification?", "Risk and Diversification"),
        ("Is interest from Fixed Deposit taxable?", "Fixed Deposits"),
        ("What is CTC vs Take Home salary?", "Financial Terminology"),
        ("What is the maximum deduction under Section 80C?", "Section 80C"),
        ("What is the Section 80D limit for senior citizens?", "Section 80D"),
    ]

    successful_retrievals = 0
    total_questions = len(test_cases)

    print("\n" + "=" * 60)
    print("RUNNING RAG RETRIEVAL ACCURACY TEST SUITE (20 QUESTIONS)")
    print("=" * 60)

    for idx, (query, expected_topic) in enumerate(test_cases, 1):
        results = retriever.retrieve(query, top_k=3)
        assert len(results) > 0, f"No chunks retrieved for query: '{query}'"

        retrieved_topics = [r["metadata"].get("topic", "") for r in results]
        is_relevant = any(expected_topic.lower() in t.lower() for t in retrieved_topics)

        if is_relevant:
            successful_retrievals += 1
            status = "PASS"
        else:
            status = "FAIL"

        top_title = results[0]["metadata"].get("title", "Unknown")
        sim_score = results[0].get("similarity_score", 0.0)
        print(f"Q{idx:02d}: '{query}' -> [{status}] Top: '{top_title}' (Score: {sim_score:.4f})")

    accuracy_pct = (successful_retrievals / total_questions) * 100.0
    print("-" * 60)
    print(f"RETRIEVAL TEST ACCURACY: {successful_retrievals}/{total_questions} ({accuracy_pct:.1f}%)")
    print("=" * 60)

    assert accuracy_pct >= 90.0, f"Retrieval accuracy {accuracy_pct}% fell below 90% target."
