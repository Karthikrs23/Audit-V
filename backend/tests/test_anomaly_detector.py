from __future__ import annotations

import json
from pathlib import Path
import pytest
from app.ml.anomaly_detector import TransactionAnomalyDetector
from app.ml.preprocessor import TransactionFeaturePreprocessor

DATASET_PATH = Path(__file__).resolve().parents[1].parent / "datasets" / "financial" / "transactions_synthetic.json"


def load_dataset():
    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        return json.load(f)["transactions"]


def test_detector_initialization_and_preprocessor():
    """Test 1: Preprocessor feature matrix extraction and scaling."""
    transactions = load_dataset()
    preprocessor = TransactionFeaturePreprocessor()
    features = preprocessor.fit_transform(transactions)

    assert features.shape == (300, 10), f"Expected shape (300, 10), got {features.shape}"
    assert preprocessor.is_fitted is True


def test_anomaly_detector_fit_and_predict():
    """Test 2: IsolationForest predictions and risk level assignments."""
    transactions = load_dataset()
    detector = TransactionAnomalyDetector(contamination=0.06, n_estimators=100, random_state=42)
    detector.fit(transactions)

    predictions = detector.predict(transactions)
    assert len(predictions) == 300

    for item in predictions:
        assert "anomaly_score" in item
        assert "risk_level" in item
        assert "contributing_features" in item
        assert isinstance(item["contributing_features"], list)
        assert item["risk_level"] in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        assert 0.0 <= item["anomaly_score"] <= 1.0


def test_ground_truth_evaluation_metrics():
    """Test 3: Evaluate IsolationForest against known synthetic ground-truth anomalies."""
    transactions = load_dataset()
    detector = TransactionAnomalyDetector(contamination=0.06, n_estimators=100, random_state=42)
    detector.fit(transactions)

    metrics = detector.evaluate(transactions)

    print("\n" + "=" * 60)
    print("ISOLATION FOREST MODEL EVALUATION REPORT")
    print("=" * 60)
    print(f"  * Total Transactions:      {metrics['total_transactions']}")
    print(f"  * Ground Truth Anomalies:  {metrics['known_anomalies_count']}")
    print(f"  * Detected Anomalies:      {metrics['detected_anomalies_count']}")
    print("-" * 60)
    print(f"  * True Positives (TP):     {metrics['true_positives']}")
    print(f"  * True Negatives (TN):     {metrics['true_negatives']}")
    print(f"  * False Positives (FP):    {metrics['false_positives']}")
    print(f"  * False Negatives (FN):    {metrics['false_negatives']}")
    print("-" * 60)
    print(f"  * Precision:               {metrics['precision']:.4f}")
    print(f"  * Recall:                  {metrics['recall']:.4f}")
    print(f"  * F1-Score:                {metrics['f1_score']:.4f}")
    print("=" * 60)

    # Assertions
    assert metrics["known_anomalies_count"] == 18
    assert metrics["true_positives"] >= 14, "Model missed too many known anomalies"
    assert metrics["recall"] >= 0.75, f"Recall {metrics['recall']} fell below 0.75 target"
    assert metrics["f1_score"] >= 0.75, f"F1-Score {metrics['f1_score']} fell below 0.75 target"


def test_contamination_hyperparameter_experimentation():
    """Test 4: Experimentation across contamination values (0.05, 0.06, 0.08, 0.10)."""
    transactions = load_dataset()
    contaminations = [0.05, 0.06, 0.08, 0.10]

    print("\n" + "=" * 60)
    print("EXPERIMENTATION: CONTAMINATION HYPERPARAMETER COMPARISON")
    print("=" * 60)

    for c in contaminations:
        det = TransactionAnomalyDetector(contamination=c, n_estimators=100, random_state=42)
        det.fit(transactions)
        eval_res = det.evaluate(transactions)
        print(
            f"Contamination {c:.2f} -> TP: {eval_res['true_positives']:02d}, FP: {eval_res['false_positives']:02d}, "
            f"Precision: {eval_res['precision']:.4f}, Recall: {eval_res['recall']:.4f}, F1: {eval_res['f1_score']:.4f}"
        )

    print("=" * 60)
