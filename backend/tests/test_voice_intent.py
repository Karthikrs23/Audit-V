from __future__ import annotations

from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.services.voice_intent_service import VoiceIntentService

client = TestClient(app)


def test_voice_intent_valid_request():
    """Test 1: Valid voice-intent request returns 200 and expected fields."""
    response = client.post(
        "/api/v1/assistant/voice-intent",
        json={"text": "hello assistant"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["input_text"] == "hello assistant"
    assert "intent" in data
    assert "confidence" in data
    assert 0.0 <= data["confidence"] <= 1.0
    assert data["intent"] == "greeting"


def test_voice_intent_empty_input():
    """Test 2: Empty or whitespace input is rejected with HTTP 400."""
    response = client.post(
        "/api/v1/assistant/voice-intent",
        json={"text": "   "},
    )
    assert response.status_code == 400

    response_missing = client.post(
        "/api/v1/assistant/voice-intent",
        json={},
    )
    assert response_missing.status_code == 400


def test_voice_intent_known_intents():
    """Test 3: Known intent predictions across the dataset's 8 intents."""
    intent_samples = [
        ("good morning", "greeting"),
        ("what is the weather like today", "weather"),
        ("what time is it", "time_date"),
        ("set an alarm for 7 am", "set_alarm"),
        ("play some music", "play_music"),
        ("stop", "stop_cancel"),
        ("turn on the lights", "smart_home"),
        ("who is the president", "general_knowledge"),
    ]

    for utterance, expected_intent in intent_samples:
        response = client.post(
            "/api/v1/assistant/voice-intent",
            json={"text": utterance},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["intent"] == expected_intent, f"Expected {expected_intent} for '{utterance}', got {data['intent']}"
        assert data["confidence"] > 0.0


def test_voice_intent_confidence_generation():
    """Test 4: Confidence score generation is bounded properly."""
    response = client.post(
        "/api/v1/assistant/voice-intent",
        json={"text": "is it going to rain"},
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data["confidence"], float)
    assert 0.0 <= data["confidence"] <= 1.0


def test_voice_intent_response_structure():
    """Test 5: Response contains full required structure."""
    response = client.post(
        "/api/v1/assistant/voice-intent",
        json={"text": "what day is today"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "input_text" in data
    assert "intent" in data
    assert "confidence" in data
    assert "success" in data
    assert "action" in data
    assert "message" in data


def test_voice_intent_model_loading_failure():
    """Test 6: Handles model loading failure gracefully with 503."""
    with patch.object(VoiceIntentService, "predict_intent", side_effect=RuntimeError("Model unavailable")):
        response = client.post(
            "/api/v1/assistant/voice-intent",
            json={"text": "hello"},
        )
        assert response.status_code == 503
        data = response.json()
        assert "detail" in data
        assert "unavailable" in data["detail"]


def test_existing_assistant_chat_remains_functional():
    """Test 7: Regression test ensuring existing chat endpoint remains functional."""
    with patch("app.services.llm_service.load_finetuned_model", return_value=(None, None)):
        response = client.post(
            "/api/v1/assistant/chat",
            json={"message": "What is Section 80C?", "stream": False},
        )
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        assert "intent" in data
