# Audit V — Financial, Tax Compliance & AI Advisory Platform

Audit V is an enterprise-grade AI financial intelligence, tax compliance, and anomaly detection platform. It features a FastAPI backend, a fine-tuned LLM (Qwen + LoRA), RAG retrieval over tax knowledge via ChromaDB, deterministic tax & GST engines, taxpayer risk classification, and an end-to-end Voice Assistant.

---

## 🎙️ Voice Assistant Integration

Audit V features a real-time, browser-native Voice Assistant designed for voice-driven tax and financial navigation.

### Architecture Pipeline

```
[Microphone (en-IN)]
        │
        ▼
[Web Speech API (SpeechRecognition / webkitSpeechRecognition)]
        │ (Transcribed Utterance Text)
        ▼
[Voice Intent API: POST /api/v1/assistant/voice-intent]
        │
        ▼
[TF-IDF Vectorizer + Logistic Regression Classifier (voice_intent_model.pkl)]
        │ (Predicted Intent + Confidence Score)
        ▼
┌─────────────────────────────────────────────────────────────┐
│                 Controlled Downstream Action                │
├───────────────────────┬─────────────────────────────────────┤
│ Intent                │ Action                              │
├───────────────────────┼─────────────────────────────────────┤
│ `greeting`            │ Spoken & visual welcome guidance    │
│ `stop_cancel`         │ Stop TTS audio & reset voice session│
│ `time_date`           │ Localized IST time & date display   │
│ `set_alarm`           │ Compliance calendar reminders       │
│ `play_music`          │ Advisory disclaimer on scope        │
│ `smart_home`          │ Budgeting & deduction guidance      │
│ `weather`             │ Economic/market climate advisory    │
│ `general_knowledge`   │ Route to RAG AI Assistant Chat (SSE)│
└───────────────────────┴─────────────────────────────────────┘
```

### Dataset & Model Specifications
- **Dataset**: Located at `datasets/basic_voice_intents.json`. Contains 47 curated utterances across 8 intents.
- **Model Type**: Scikit-Learn Pipeline combining `TfidfVectorizer` and `LogisticRegression`.
- **Model Weights**: Serialized in `models/voice_intent_model.pkl`.
- **Confidence Computation**: Computed via `predict_proba` normalized class probability distribution.
- **Inference Service**: Safe, thread-safe, cached singleton in `backend/app/services/voice_intent_service.py`.

### Backend API Specification

#### `POST /api/v1/assistant/voice-intent`

- **Request Body**:
  ```json
  {
    "text": "what is the standard deduction"
  }
  ```
- **Response Body**:
  ```json
  {
    "input_text": "what is the standard deduction",
    "intent": "general_knowledge",
    "confidence": 0.8421,
    "success": true,
    "action": "chat_query",
    "message": "Query routed to Audit V AI Assistant knowledge base."
  }
  ```

### Frontend Integration & Accessibility
- **Component**: `frontend/src/components/voice/VoiceHeaderAssistant.tsx` mounted across all layouts.
- **Speech-to-Text**: Native `window.SpeechRecognition` / `webkitSpeechRecognition` configured with `en-IN` for Indian tax terminology.
- **Text-to-Speech**: Native `window.speechSynthesis` with Indian/UK English voice selection and markdown cleaning.
- **Visual UX States**:
  - **Idle**: Clean microphone icon with accessible tooltip.
  - **Listening**: Pulsing red ring with live audio waveform bars.
  - **Processing**: Cyan glowing status with real-time classification indicator.
  - **Success**: Floating glassmorphic response card with intent badge and confidence score.
  - **Unsupported Browser**: Helpful notification banner explaining speech recognition requirements with typing fallback.
  - **Error**: Permission and microphone error alerts with "Retry Mic" recovery button.

---

## 🚀 Getting Started

### Backend Setup
```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup
```powershell
cd frontend
npm install
npm run dev
```

### Running Tests
```powershell
backend\venv\Scripts\python.exe -m pytest backend/tests/test_voice_intent.py backend/tests/test_assistant_api.py -o pythonpath=backend -v
```
