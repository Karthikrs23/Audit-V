from __future__ import annotations

import os
from pathlib import Path
import pickle
import threading
from typing import Any, Dict, Optional
import numpy as np

from app.core.logging import get_logger

logger = get_logger("voice_intent_service")

# Candidate model paths
DEFAULT_MODEL_PATHS = [
    Path(__file__).resolve().parents[3] / "models" / "voice_intent_model.pkl",
    Path("C:/Audit-V/models/voice_intent_model.pkl"),
    Path("models/voice_intent_model.pkl"),
]

# Controlled intent-to-action definitions for the 8 trained intents
INTENT_ACTION_MAP: Dict[str, Dict[str, str]] = {
    "greeting": {
        "action": "greet",
        "message": "Hello! Welcome to Audit V. How can I assist you with tax compliance, GST, or financial planning today?",
    },
    "weather": {
        "action": "inform",
        "message": "Weather inquiry recognized. Note that Audit V specializes in tax compliance and financial intelligence.",
    },
    "time_date": {
        "action": "time_date",
        "message": "Current time and date request recognized.",
    },
    "set_alarm": {
        "action": "reminder",
        "message": "Reminder noted. You can view your tax deadlines and compliance calendar on the dashboard.",
    },
    "play_music": {
        "action": "media",
        "message": "Media control recognized. Audit V is optimized for financial auditing and advisory.",
    },
    "stop_cancel": {
        "action": "stop",
        "message": "Speech output stopped and voice session reset.",
    },
    "smart_home": {
        "action": "device_control",
        "message": "Smart device command recognized. Device control is outside the tax and audit scope.",
    },
    "general_knowledge": {
        "action": "chat_query",
        "message": "Query routed to Audit V AI Assistant knowledge base.",
    },
}


class VoiceIntentService:
    """Service for classifying voice/text utterances into intents using a pre-trained TF-IDF + Logistic Regression pipeline."""

    _instance: Optional[VoiceIntentService] = None
    _lock = threading.Lock()

    def __new__(cls, *args: Any, **kwargs: Any) -> VoiceIntentService:
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, model_path: Optional[Path] = None) -> None:
        if getattr(self, "_initialized", False):
            return

        self._model_path = model_path
        self._model: Any = None
        self._load_lock = threading.Lock()
        self._load_model()
        self._initialized = True

    def _resolve_model_path(self) -> Path:
        """Find the existing trained model file from expected locations."""
        if self._model_path and self._model_path.exists():
            return self._model_path

        for p in DEFAULT_MODEL_PATHS:
            if p.exists():
                return p

        # Default fallback to first path
        return DEFAULT_MODEL_PATHS[0]

    def _load_model(self) -> None:
        """Safely load and cache the pre-trained pipeline."""
        with self._load_lock:
            resolved_path = self._resolve_model_path()
            if not resolved_path.exists():
                logger.warning(
                    "Voice intent model file not found during initialization. "
                    "Inference will fail until the model is available."
                )
                self._model = None
                return

            try:
                with open(resolved_path, "rb") as f:
                    self._model = pickle.load(f)
                logger.info("Voice intent model successfully loaded and cached.")
            except Exception as exc:
                logger.error(f"Failed to load voice intent model: {exc}")
                self._model = None

    @property
    def is_ready(self) -> bool:
        """Check if the model pipeline is loaded and ready for prediction."""
        return self._model is not None

    def predict_intent(self, text: str) -> Dict[str, Any]:
        """Classify input utterance text into an intent with confidence score.

        Does not retrain or mutate the model.
        """
        cleaned_text = (text or "").strip()
        if not cleaned_text:
            raise ValueError("Input text cannot be empty or whitespace.")

        if self._model is None:
            # Attempt one lazy reload
            self._load_model()
            if self._model is None:
                raise RuntimeError("Voice intent model is not loaded or unavailable.")

        try:
            # Predict intent
            predicted_intent = str(self._model.predict([cleaned_text])[0])

            # Calculate confidence using class probabilities
            confidence = 1.0
            if hasattr(self._model, "predict_proba"):
                probs = self._model.predict_proba([cleaned_text])[0]
                confidence = float(np.max(probs))
            confidence = round(confidence, 4)

            # Map intent to controlled action
            action_info = INTENT_ACTION_MAP.get(
                predicted_intent,
                {
                    "action": "chat_query",
                    "message": "Query routed to AI Assistant.",
                },
            )

            logger.info(
                f"Voice intent predicted: '{predicted_intent}' (confidence: {confidence:.4f}) for utterance: '{cleaned_text}'"
            )

            return {
                "input_text": cleaned_text,
                "intent": predicted_intent,
                "confidence": confidence,
                "success": True,
                "action": action_info["action"],
                "message": action_info["message"],
            }
        except Exception as exc:
            logger.error(f"Error during voice intent inference: {exc}")
            raise RuntimeError(f"Voice intent prediction failed: {exc}") from exc
