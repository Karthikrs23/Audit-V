from __future__ import annotations

import math
from datetime import datetime
from typing import Any, Dict, List, Tuple
import numpy as np
from sklearn.preprocessing import StandardScaler


class TransactionFeaturePreprocessor:
    """Feature engineering and scaling pipeline for financial transaction anomaly detection."""

    def __init__(self) -> None:
        self.scaler = StandardScaler()
        self.category_averages: Dict[str, float] = {}
        self.category_counts: Dict[str, int] = {}
        self.merchant_counts: Dict[str, int] = {}
        self.is_fitted: bool = False

    def _extract_hour(self, time_str: str) -> int:
        """Extract hour of day (0-23) from time string."""
        try:
            return int(time_str.split(":")[0])
        except Exception:
            return 12

    def _extract_day_of_week(self, date_str: str) -> int:
        """Extract day of week (0=Monday, 6=Sunday) from date string."""
        try:
            return datetime.strptime(date_str, "%Y-%m-%d").weekday()
        except Exception:
            return 0

    def fit_transform(self, transactions: List[Dict[str, Any]]) -> np.ndarray:
        """Fit preprocessor statistics on transaction list and return scaled feature matrix."""
        # Compute dataset frequency statistics
        self.category_counts.clear()
        self.merchant_counts.clear()
        cat_sums: Dict[str, float] = {}

        for tx in transactions:
            cat = str(tx.get("category", "General"))
            merch = str(tx.get("merchant", "General"))
            amount = float(tx.get("amount", 0.0))

            self.category_counts[cat] = self.category_counts.get(cat, 0) + 1
            self.merchant_counts[merch] = self.merchant_counts.get(merch, 0) + 1
            cat_sums[cat] = cat_sums.get(cat, 0.0) + amount

        for cat, total in cat_sums.items():
            count = self.category_counts[cat]
            self.category_averages[cat] = total / count if count > 0 else 1000.0

        raw_features = self._extract_raw_features(transactions)
        scaled = self.scaler.fit_transform(raw_features)
        self.is_fitted = True
        return scaled

    def transform(self, transactions: List[Dict[str, Any]]) -> np.ndarray:
        """Transform transactions using fitted scaler and statistics."""
        if not self.is_fitted:
            return self.fit_transform(transactions)
        raw_features = self._extract_raw_features(transactions)
        return self.scaler.transform(raw_features)

    def _extract_raw_features(self, transactions: List[Dict[str, Any]]) -> np.ndarray:
        """Extract 10 numerical features for each transaction (excluding ground-truth labels)."""
        feature_rows = []

        # Map duplicate time-space occurrences
        tx_signatures: Dict[str, int] = {}
        for tx in transactions:
            sig = f"{tx.get('amount')}:{tx.get('merchant')}"
            tx_signatures[sig] = tx_signatures.get(sig, 0) + 1

        for tx in transactions:
            amount = float(tx.get("amount", 0.0))
            log_amt = math.log1p(max(0.0, amount))
            hour = self._extract_hour(str(tx.get("time", "12:00:00")))
            dow = self._extract_day_of_week(str(tx.get("date", "2024-03-01")))

            # Rule flags
            is_odd_hour = 1.0 if (hour >= 0 and hour <= 5) else 0.0
            is_round_num = 1.0 if (amount >= 10000.0 and (amount % 1000.0 == 0 or amount % 10000.0 == 0)) else 0.0

            sig = f"{tx.get('amount')}:{tx.get('merchant')}"
            is_duplicate = 1.0 if tx_signatures.get(sig, 1) > 1 else 0.0

            cat = str(tx.get("category", "General"))
            merch = str(tx.get("merchant", "General"))

            cat_avg = self.category_averages.get(cat, 1000.0)
            amount_ratio = amount / cat_avg if cat_avg > 0 else 1.0

            cat_freq = float(self.category_counts.get(cat, 1))
            merch_freq = float(self.merchant_counts.get(merch, 1))

            row = [
                amount,
                log_amt,
                float(hour),
                float(dow),
                is_odd_hour,
                is_round_num,
                is_duplicate,
                amount_ratio,
                cat_freq,
                merch_freq,
            ]
            feature_rows.append(row)

        return np.array(feature_rows, dtype=np.float64)
