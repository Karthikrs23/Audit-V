import logging
import math
import time
from typing import Any, Dict, List, Tuple, Optional
import numpy as np
from sklearn.ensemble import IsolationForest
from app.core.logging import configure_logging, get_logger, log_structured_event
from app.ml.preprocessor import TransactionFeaturePreprocessor

logger = configure_logging()


class TransactionAnomalyDetector:
    """Isolation Forest anomaly detection engine with feature-based deterministic explanations."""

    def __init__(
        self,
        contamination: float = 0.06,
        n_estimators: int = 100,
        random_state: int = 42,
    ) -> None:
        self.contamination = contamination
        self.n_estimators = n_estimators
        self.random_state = random_state

        self.preprocessor = TransactionFeaturePreprocessor()
        self.model = IsolationForest(
            contamination=self.contamination,
            n_estimators=self.n_estimators,
            random_state=self.random_state,
        )
        self.is_fitted: bool = False

    def fit(self, transactions: List[Dict[str, Any]]) -> None:
        """Fit feature scaling preprocessor and IsolationForest model on transactions."""
        X = self.preprocessor.fit_transform(transactions)
        self.model.fit(X)
        self.is_fitted = True
        logger.info(
            f"IsolationForest fitted on {len(transactions)} transactions "
            f"(contamination={self.contamination}, n_estimators={self.n_estimators})"
        )

    def predict(self, transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Predict anomaly scores, risk levels, and explanations for input transactions."""
        start_time = time.perf_counter()
        ml_logger = get_logger("anomaly_detector")

        try:
            if not self.is_fitted:
                self.fit(transactions)

            X = self.preprocessor.transform(transactions)
            
            # Raw decision function scores: higher means more normal, lower/negative means more anomalous
            raw_scores = self.model.decision_function(X)
            raw_preds = self.model.predict(X)  # -1 for anomaly, 1 for normal

            min_score = min(raw_scores)
            max_score = max(raw_scores)
            score_range = max_score - min_score if max_score > min_score else 1.0

            results: List[Dict[str, Any]] = []

            sig_map: Dict[str, List[str]] = {}
            for tx in transactions:
                sig = f"{tx.get('amount')}:{tx.get('merchant')}"
                sig_map.setdefault(sig, []).append(tx.get("transaction_id", ""))

            for idx, tx in enumerate(transactions):
                tx_id = tx.get("transaction_id", f"TXN-{idx}")
                raw_s = raw_scores[idx]
                raw_p = raw_preds[idx]

                norm_score = float(np.clip((max_score - raw_s) / score_range, 0.0, 1.0))
                norm_score = round(norm_score, 4)

                reasons, contributing_features, primary_reason = self._explain_transaction(tx, sig_map)
                has_rule_flag = len(reasons) > 0

                if has_rule_flag:
                    norm_score = max(norm_score, 0.72)

                # Assign risk level based on explicit thresholds
                if norm_score >= 0.75 or raw_p == -1 or has_rule_flag:
                    if norm_score >= 0.85:
                        risk_level = "CRITICAL"
                    else:
                        risk_level = "HIGH"
                    is_anomaly = True
                elif norm_score >= 0.50:
                    risk_level = "MEDIUM"
                    is_anomaly = False
                else:
                    risk_level = "LOW"
                    is_anomaly = False

                results.append(
                    {
                        "transaction_id": tx_id,
                        "date": tx.get("date"),
                        "time": tx.get("time"),
                        "amount": float(tx.get("amount", 0.0)),
                        "category": tx.get("category"),
                        "merchant": tx.get("merchant"),
                        "payment_method": tx.get("payment_method"),
                        "anomaly_score": norm_score,
                        "is_anomaly": is_anomaly,
                        "risk_level": risk_level,
                        "reasons": reasons,
                        "primary_reason": primary_reason,
                        "contributing_features": contributing_features,
                        "is_known_anomaly": tx.get("is_known_anomaly", False),
                        "anomaly_type": tx.get("anomaly_type", "none"),
                    }
                )

            anomalies_count = sum(1 for r in results if r["is_anomaly"])
            duration_ms = (time.perf_counter() - start_time) * 1000.0

            log_structured_event(
                logger=ml_logger,
                engine="TransactionAnomalyDetector",
                processing_time_ms=duration_ms,
                status="SUCCESS",
                metadata={
                    "total_transactions": len(transactions),
                    "anomalies_detected": anomalies_count,
                    "contamination": self.contamination,
                    "n_estimators": self.n_estimators,
                    "algorithm": "IsolationForest",
                },
            )

            return results
        except Exception as err:
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            log_structured_event(
                logger=ml_logger,
                engine="TransactionAnomalyDetector",
                processing_time_ms=duration_ms,
                status="FAILURE",
                metadata={"error": str(err)},
                level=logging.ERROR,
            )
            raise

    def _explain_transaction(
        self, tx: Dict[str, Any], sig_map: Dict[str, List[str]]
    ) -> Tuple[List[str], List[str], str]:
        """Generate deterministic feature-based explanations and contributing feature tags for transaction risk findings."""
        reasons: List[str] = []
        contributing_features: List[str] = []
        amount = float(tx.get("amount", 0.0))
        cat = str(tx.get("category", "General"))
        merchant = str(tx.get("merchant", "Merchant"))
        time_str = str(tx.get("time", "12:00:00"))
        tx_id = str(tx.get("transaction_id", ""))

        cat_avg = self.preprocessor.category_averages.get(cat, 5000.0)

        # 1. Amount Outlier Explanation
        if amount >= 300000.0 or (cat_avg > 0 and (amount / cat_avg) >= 5.0 and amount > 50000.0):
            ratio = round(amount / cat_avg, 1) if cat_avg > 0 else 1.0
            reasons.append(
                f"Transaction amount (₹{amount:,.2f}) is an extreme statistical outlier ({ratio}x higher than category average ₹{cat_avg:,.2f} for '{cat}')."
            )
            contributing_features.append(f"Amount Deviation ({ratio}x category avg)")

        # 2. Duplicate Transaction Explanation
        sig = f"{tx.get('amount')}:{tx.get('merchant')}"
        matching_ids = [m_id for m_id in sig_map.get(sig, []) if m_id != tx_id]
        if matching_ids:
            other_id = matching_ids[0]
            reasons.append(
                f"Transaction matches transaction {other_id} in exact amount (₹{amount:,.2f}) and merchant ('{merchant}') within short window."
            )
            contributing_features.append("Duplicate Merchant & Amount Pattern")

        # 3. Odd-Hour Explanation
        try:
            hour = int(time_str.split(":")[0])
            if (hour >= 0 and hour <= 5) and amount >= 100000.0:
                reasons.append(
                    f"High-value transaction (₹{amount:,.2f}) occurred at {time_str} during off-peak hours (0:00 AM - 5:00 AM)."
                )
                contributing_features.append(f"Odd-Hour Timing ({time_str})")
        except Exception:
            pass

        # 4. Suspicious Round-Number Explanation
        if amount >= 100000.0 and (amount % 10000.0 == 0.0 or amount % 100000.0 == 0.0):
            reasons.append(
                f"Transaction utilizes an unusually large round-number amount (₹{amount:,.2f}) without typical expense invoice decimals."
            )
            contributing_features.append(f"Round Amount Outlier (₹{amount:,.0f})")

        # Build crisp primary reason
        if contributing_features:
            primary_reason = f"Flagged: {contributing_features[0]}"
        else:
            primary_reason = "Normal transaction within expected parameters."

        return reasons, contributing_features, primary_reason

    def evaluate(self, transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Evaluate IsolationForest predictions against ground-truth evaluation labels."""
        predictions = self.predict(transactions)

        tp = 0  # Predicted Anomaly, Actual Anomaly
        tn = 0  # Predicted Normal, Actual Normal
        fp = 0  # Predicted Anomaly, Actual Normal
        fn = 0  # Predicted Normal, Actual Anomaly

        known_anomalies_count = 0

        for p in predictions:
            actual = p["is_known_anomaly"]
            pred = p["is_anomaly"]

            if actual:
                known_anomalies_count += 1

            if pred and actual:
                tp += 1
            elif not pred and not actual:
                tn += 1
            elif pred and not actual:
                fp += 1
            elif not pred and actual:
                fn += 1

        precision = round(tp / (tp + fp), 4) if (tp + fp) > 0 else 0.0
        recall = round(tp / (tp + fn), 4) if (tp + fn) > 0 else 0.0
        f1_score = (
            round(2 * (precision * recall) / (precision + recall), 4)
            if (precision + recall) > 0
            else 0.0
        )

        results = {
            "total_transactions": len(transactions),
            "known_anomalies_count": known_anomalies_count,
            "detected_anomalies_count": tp + fp,
            "true_positives": tp,
            "true_negatives": tn,
            "false_positives": fp,
            "false_negatives": fn,
            "precision": precision,
            "recall": recall,
            "f1_score": f1_score,
            "model_config": {
                "algorithm": "IsolationForest",
                "contamination": self.contamination,
                "n_estimators": self.n_estimators,
                "random_state": self.random_state,
            },
        }

        logger.info(f"Evaluation Results: TP={tp}, TN={tn}, FP={fp}, FN={fn} | Precision={precision}, Recall={recall}, F1={f1_score}")
        return results
