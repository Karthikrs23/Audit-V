from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException, status

from app.ml.anomaly_detector import TransactionAnomalyDetector
from app.ml.explanation_engine import generate_risk_summary_text
from app.schemas.risk import (
    AnalyzedTransaction,
    RiskAnalysisRequest,
    RiskAnalysisResponse,
    RiskSummary,
)

router = APIRouter(prefix="/risk", tags=["Risk & Fraud Detection"])
detector = TransactionAnomalyDetector(contamination=0.06, n_estimators=100, random_state=42)

# Absolute path to root datasets/financial/transactions_synthetic.json
ROOT_DIR = Path(__file__).resolve().parents[4].parent
DATASET_PATH = ROOT_DIR / "datasets" / "financial" / "transactions_synthetic.json"


def load_synthetic_dataset() -> List[Dict[str, Any]]:
    """Load default 300 synthetic financial transactions."""
    paths_to_try = [
        DATASET_PATH,
        Path("C:/Audit-V/datasets/financial/transactions_synthetic.json"),
        Path(__file__).resolve().parents[4] / "datasets" / "financial" / "transactions_synthetic.json",
    ]

    found_path = None
    for p in paths_to_try:
        if p.exists():
            found_path = p
            break

    if not found_path:
        raise FileNotFoundError(f"Synthetic dataset not found. Tried: {paths_to_try}")

    with open(found_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("transactions", [])


@router.post(
    "/analyze",
    response_model=RiskAnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Transaction Anomaly & Fraud Risk Analysis",
    description=(
        "Analyzes financial transactions using Scikit-Learn Isolation Forest machine learning. "
        "Returns anomaly scores, risk levels (LOW, MEDIUM, HIGH, CRITICAL), and feature-based explanations."
    ),
)
def analyze_transactions(request: RiskAnalysisRequest) -> RiskAnalysisResponse:
    """Analyze transactions for anomaly scores, risk levels, and explanation tags."""
    try:
        synthetic_txs = load_synthetic_dataset()
        
        # Ensure detector is fitted on reference dataset
        if not detector.is_fitted:
            detector.fit(synthetic_txs)

        if request.transactions and len(request.transactions) > 0:
            tx_data = [t.model_dump() for t in request.transactions]
        else:
            tx_data = synthetic_txs

        # Run IsolationForest prediction pipeline
        analyzed_items = detector.predict(tx_data)

        # Count risk levels
        summary_counts = {"low": 0, "medium": 0, "high": 0, "critical": 0}
        anomalies_detected = 0

        parsed_items: List[AnalyzedTransaction] = []
        for item in analyzed_items:
            risk_key = item["risk_level"].lower()
            summary_counts[risk_key] = summary_counts.get(risk_key, 0) + 1
            if item["is_anomaly"]:
                anomalies_detected += 1
            parsed_items.append(AnalyzedTransaction(**item))

        # Filter top anomalies for summary explanation
        top_anomalies = [i for i in analyzed_items if i["is_anomaly"]]
        top_anomalies.sort(key=lambda x: x["anomaly_score"], reverse=True)

        risk_summary = RiskSummary(**summary_counts)
        explanation_text = generate_risk_summary_text(
            total_transactions=len(tx_data),
            anomalies_count=anomalies_detected,
            risk_summary=summary_counts,
            top_anomalies=top_anomalies,
        )

        return RiskAnalysisResponse(
            total_transactions=len(tx_data),
            anomalies_detected=anomalies_detected,
            risk_summary=risk_summary,
            summary_explanation=explanation_text,
            transactions=parsed_items,
            model_metadata={
                "algorithm": "Isolation Forest",
                "contamination": detector.contamination,
                "n_estimators": detector.n_estimators,
                "dataset_size": len(tx_data),
            },
        )
    except FileNotFoundError as fnf_err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(fnf_err),
        ) from fnf_err
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error performing risk analysis: {str(err)}",
        ) from err
