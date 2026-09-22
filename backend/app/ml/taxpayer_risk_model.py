import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

from app.core.logging import get_logger

logger = get_logger("taxpayer_risk_model")

MODEL_SAVE_PATH = Path(__file__).resolve().parent / "taxpayer_risk_model.joblib"
DATASET_PATH = Path(__file__).resolve().parents[3] / "datasets" / "financial" / "taxpayer_risk_dataset.csv"


class TaxpayerRiskModel:
    """Machine learning model for predicting Taxpayer Compliance & Risk Level (Low, Medium, High)."""

    def __init__(self) -> None:
        self.numerical_features = [
            "Revenue",
            "Expenses",
            "Tax_Liability",
            "Tax_Paid",
            "Late_Filings",
            "Compliance_Violations",
            "Profit",
            "Tax_Compliance_Ratio",
            "Audit_Findings",
            "Audit_to_Tax_Ratio",
        ]
        self.categorical_features = ["Industry"]
        
        preprocessor = ColumnTransformer(
            transformers=[
                ("num", StandardScaler(), self.numerical_features),
                ("cat", OneHotEncoder(handle_unknown="ignore"), self.categorical_features),
            ]
        )

        self.pipeline = Pipeline(
            steps=[
                ("preprocessor", preprocessor),
                ("classifier", RandomForestClassifier(n_estimators=100, random_state=42)),
            ]
        )
        self.is_fitted = False

    def train_from_csv(self, csv_path: Optional[Path] = None) -> Dict[str, Any]:
        """Train Random Forest Taxpayer Risk model on dataset CSV."""
        path = csv_path or DATASET_PATH
        if not path.exists():
            # Try fallback paths
            alt = Path("C:/Audit-V/datasets/financial/taxpayer_risk_dataset.csv")
            if alt.exists():
                path = alt
            else:
                raise FileNotFoundError(f"Taxpayer risk dataset not found at {path}")

        df = pd.read_csv(path)
        logger.info(f"Training TaxpayerRiskModel on {len(df)} records from {path}")

        # Features & Target
        X = df[self.numerical_features + self.categorical_features]
        y = df["Risk_Label"]

        self.pipeline.fit(X, y)
        self.is_fitted = True

        # Compute accuracy score on training dataset
        acc = float(self.pipeline.score(X, y))
        logger.info(f"TaxpayerRiskModel trained successfully. Accuracy: {acc:.4f}")

        self.save_model()
        return {"records_trained": len(df), "accuracy": round(acc, 4)}

    def predict_taxpayer(self, taxpayer_data: Dict[str, Any]) -> Dict[str, Any]:
        """Predict risk level, probability distribution, and compliance flags for a taxpayer."""
        if not self.is_fitted:
            if MODEL_SAVE_PATH.exists():
                self.load_model()
            else:
                self.train_from_csv()

        # Standardize key names (support both snake_case lowercase and Title_Case)
        key_map = {
            "revenue": "Revenue",
            "expenses": "Expenses",
            "tax_liability": "Tax_Liability",
            "tax_paid": "Tax_Paid",
            "late_filings": "Late_Filings",
            "compliance_violations": "Compliance_Violations",
            "industry": "Industry",
            "profit": "Profit",
            "tax_compliance_ratio": "Tax_Compliance_Ratio",
            "audit_findings": "Audit_Findings",
            "audit_to_tax_ratio": "Audit_to_Tax_Ratio",
        }
        normalized_data = {}
        for k, v in taxpayer_data.items():
            canonical_key = key_map.get(k.lower(), k)
            normalized_data[canonical_key] = v

        df_input = pd.DataFrame([normalized_data])
        
        # Calculate derived fields if missing
        if "Profit" not in df_input.columns or pd.isna(df_input["Profit"].iloc[0]):
            rev = float(df_input["Revenue"].iloc[0]) if "Revenue" in df_input.columns and not pd.isna(df_input["Revenue"].iloc[0]) else 0.0
            exp = float(df_input["Expenses"].iloc[0]) if "Expenses" in df_input.columns and not pd.isna(df_input["Expenses"].iloc[0]) else 0.0
            df_input["Profit"] = rev - exp

        if "Tax_Compliance_Ratio" not in df_input.columns or pd.isna(df_input["Tax_Compliance_Ratio"].iloc[0]):
            paid = float(df_input["Tax_Paid"].iloc[0]) if "Tax_Paid" in df_input.columns and not pd.isna(df_input["Tax_Paid"].iloc[0]) else 0.0
            liab = float(df_input["Tax_Liability"].iloc[0]) if "Tax_Liability" in df_input.columns and not pd.isna(df_input["Tax_Liability"].iloc[0]) else 1.0
            df_input["Tax_Compliance_Ratio"] = round(paid / liab, 2) if liab > 0 else 1.0

        if "Audit_to_Tax_Ratio" not in df_input.columns or pd.isna(df_input["Audit_to_Tax_Ratio"].iloc[0]):
            audit = float(df_input["Audit_Findings"].iloc[0]) if "Audit_Findings" in df_input.columns and not pd.isna(df_input["Audit_Findings"].iloc[0]) else 0.0
            liab = float(df_input["Tax_Liability"].iloc[0]) if "Tax_Liability" in df_input.columns and not pd.isna(df_input["Tax_Liability"].iloc[0]) else 1.0
            df_input["Audit_to_Tax_Ratio"] = round(audit / liab, 4) if liab > 0 else 0.0

        for col in self.numerical_features:
            if col not in df_input.columns:
                df_input[col] = 0.0

        if "Industry" not in df_input.columns:
            df_input["Industry"] = "Finance"

        X_input = df_input[self.numerical_features + self.categorical_features]
        predicted_risk = self.pipeline.predict(X_input)[0]
        probs = self.pipeline.predict_proba(X_input)[0]
        classes = self.pipeline.classes_

        prob_dict = {str(c): round(float(p), 4) for c, p in zip(classes, probs)}

        # Risk Flags
        flags = []
        comp_ratio = float(df_input["Tax_Compliance_Ratio"].iloc[0])
        late_filings = int(df_input["Late_Filings"].iloc[0])
        violations = int(df_input["Compliance_Violations"].iloc[0])

        if comp_ratio < 0.8:
            flags.append(f"Low Tax Compliance Ratio ({comp_ratio:.2f} paid vs liability)")
        if late_filings > 2:
            flags.append(f"Multiple Late Filings ({late_filings} occurrences)")
        if violations > 0:
            flags.append(f"Active Compliance Violations ({violations} flagged)")

        return {
            "predicted_risk_level": predicted_risk,
            "risk_probabilities": prob_dict,
            "risk_flags": flags,
            "taxpayer_summary": {
                "revenue": float(df_input["Revenue"].iloc[0]),
                "expenses": float(df_input["Expenses"].iloc[0]),
                "profit": float(df_input["Profit"].iloc[0]),
                "tax_liability": float(df_input["Tax_Liability"].iloc[0]),
                "tax_paid": float(df_input["Tax_Paid"].iloc[0]),
                "industry": str(df_input["Industry"].iloc[0]),
            },
        }

    def save_model(self, save_path: Optional[Path] = None) -> None:
        path = save_path or MODEL_SAVE_PATH
        joblib.dump(self.pipeline, path)
        logger.info(f"Saved TaxpayerRiskModel to {path}")

    def load_model(self, load_path: Optional[Path] = None) -> None:
        path = load_path or MODEL_SAVE_PATH
        if not path.exists():
            self.train_from_csv()
            return
        self.pipeline = joblib.load(path)
        self.is_fitted = True
        logger.info(f"Loaded TaxpayerRiskModel from {path}")
