#!/usr/bin/env python3
"""Audit V — Live Production Assistant API & Model Verification.

Tests live POST /api/v1/assistant/chat endpoint with fine-tuned Qwen 4-bit model:
- Test 1: Information Query ("What is Section 80C?")
- Test 2: Tax Calculation Query ("I earn ₹12 lakh per year. Explain my estimated tax.")

Records & Reports:
- Model loading time
- First response latency
- Subsequent response latency
- GPU VRAM usage
"""

from __future__ import annotations

import sys
import time
from pathlib import Path
import torch

# Ensure backend package is on Python path
BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
from app.main import app
from app.services.llm_service import get_model_metrics

client = TestClient(app)


def run_live_api_verification():
    print("=" * 65)
    print("AUDIT V - LIVE PRODUCTION ASSISTANT API TEST")
    print("=" * 65)

    # Pre-loading metrics
    initial_metrics = get_model_metrics()
    print(f"Pre-load status: {initial_metrics}")

    # 1. Information Query Test
    print("\n[Test 1/2] POST /api/v1/assistant/chat -> 'What is Section 80C?'")
    t0 = time.time()
    resp1 = client.post("/api/v1/assistant/chat", json={"message": "What is Section 80C?"})
    latency1 = time.time() - t0

    assert resp1.status_code == 200, f"Failed: {resp1.status_code} - {resp1.text}"
    data1 = resp1.json()

    print(f"  * Status: {resp1.status_code} OK | First Latency (Load + Gen): {latency1:.2f}s")
    print(f"  * Intent Detected: '{data1.get('intent')}'")
    print(f"  * Used RAG: {data1.get('used_rag')} | Used Tax Engine: {data1.get('used_tax_engine')}")
    print(f"  * Sources Count: {len(data1.get('sources', []))}")
    
    answer1 = data1.get("answer", "").encode("ascii", "replace").decode("ascii")[:250]
    print(f"  * Answer Preview:\n{answer1}...\n")

    metrics_after_load = get_model_metrics()
    print(f"Model Load Metrics: {metrics_after_load}")

    # 2. Calculation Query Test
    print("\n[Test 2/2] POST /api/v1/assistant/chat -> 'I earn 12 lakh per year. Explain my estimated tax.'")
    t1 = time.time()
    resp2 = client.post("/api/v1/assistant/chat", json={"message": "I earn 12 lakh per year. Explain my estimated tax."})
    latency2 = time.time() - t1

    assert resp2.status_code == 200, f"Failed: {resp2.status_code} - {resp2.text}"
    data2 = resp2.json()

    print(f"  * Status: {resp2.status_code} OK | Subsequent Latency (Warmed Cache): {latency2:.2f}s")
    print(f"  * Intent Detected: '{data2.get('intent')}'")
    print(f"  * Used RAG: {data2.get('used_rag')} | Used Tax Engine: {data2.get('used_tax_engine')}")
    print(f"  * Tax Calculation Data Included: {data2.get('calculation') is not None}")

    answer2 = data2.get("answer", "").encode("ascii", "replace").decode("ascii")[:250]
    print(f"  * Answer Preview:\n{answer2}...\n")

    # VRAM stats
    if torch.cuda.is_available():
        allocated = torch.cuda.memory_allocated(0) / (1024**3)
        reserved = torch.cuda.memory_reserved(0) / (1024**3)
        print(f"GPU VRAM Status: Allocated={allocated:.2f} GB | Reserved={reserved:.2f} GB")

    print("=" * 65)
    print("[OK] PRODUCTION ASSISTANT API VERIFICATION COMPLETED SUCCESSFULLY!")
    print("=" * 65)


if __name__ == "__main__":
    run_live_api_verification()
