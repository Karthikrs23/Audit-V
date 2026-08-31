import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Square,
  RotateCcw,
  Sparkles,
  X,
  User,
  ShieldAlert,
  ArrowRight,
  AlertTriangle,
  HelpCircle,
  Compass,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

// Standard Web Speech API Types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface SourceRef {
  title: string;
  category: string;
  topic: string;
  source: string;
  reference?: string;
  similarity_score?: number;
}

interface AuditTrailData {
  intent: string;
  tax_engine_invoked: boolean;
  tax_engine_summary?: Record<string, any>;
  rag_invoked: boolean;
  retrieved_sources_count: number;
  guardrail_triggered: boolean;
  processing_time_ms: number;
}

interface VoiceResponse {
  query: string;
  answer: string;
  intent?: string;
  sources?: SourceRef[];
  used_tax_engine?: boolean;
  calculation?: Record<string, any>;
  guardrail_triggered?: boolean;
  audit_trail?: AuditTrailData;
}

interface VoiceHeaderAssistantProps {
  onVoiceQuerySubmit?: (queryText: string) => void;
}

export default function VoiceHeaderAssistant({ onVoiceQuerySubmit }: VoiceHeaderAssistantProps) {
  const [queryInput, setQueryInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [sttSupported, setSttSupported] = useState(true);

  // Response overlay state
  const [voiceResponse, setVoiceResponse] = useState<VoiceResponse | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [navToast, setNavToast] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);

  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const VOICE_COMMAND_MAP = [
    {
      keywords: ["dashboard", "home", "command center", "overview", "go to dashboard", "open dashboard", "show dashboard"],
      route: "/dashboard",
      label: "Financial Command Center",
      spokenText: "Opening Financial Command Center Dashboard.",
    },
    {
      keywords: ["ai assistant", "assistant", "chat", "ask ai", "gpt", "open assistant", "go to assistant", "talk to ai"],
      route: "/ai-assistant",
      label: "AI Tax & Financial Assistant",
      spokenText: "Opening AI Tax and Financial Assistant.",
    },
    {
      keywords: ["tax", "tax calculator", "income tax", "gst", "compliance", "open tax", "go to tax", "tax engine"],
      route: "/tax",
      label: "Tax & GST Compliance Engine",
      spokenText: "Opening Tax and GST Compliance Engine.",
    },
    {
      keywords: ["salary", "salary planner", "salary tax", "optimize salary", "pay slip", "open salary"],
      route: "/salary-tax",
      label: "Salary & Tax Optimizer",
      spokenText: "Opening Salary and Tax Optimizer.",
    },
    {
      keywords: ["market", "stock market", "nifty", "sensex", "stocks", "open market", "market intelligence"],
      route: "/market",
      label: "Market Intelligence Hub",
      spokenText: "Opening Market Intelligence Hub.",
    },
    {
      keywords: ["banking", "bank accounts", "bank feeds", "transactions", "open banking"],
      route: "/banking",
      label: "Banking & Financial Feeds",
      spokenText: "Opening Banking and Financial Feeds.",
    },
    {
      keywords: ["investments", "portfolio", "investment tracker", "mutual funds", "open investments"],
      route: "/investments",
      label: "Investment Tracker",
      spokenText: "Opening Investment Tracker.",
    },
    {
      keywords: ["risk", "fraud", "anomalies", "security", "anomaly detection", "open risk", "show anomalies"],
      route: "/risk-fraud",
      label: "Risk & Fraud Anomaly Detection",
      spokenText: "Opening Risk and Fraud Anomaly Detection.",
    },
    {
      keywords: ["financial analysis", "cashflow", "cash flow", "financial reports", "open financial analysis"],
      route: "/financial-analysis",
      label: "Financial Analysis & Cashflow",
      spokenText: "Opening Financial Analysis and Cashflow.",
    },
    {
      keywords: ["documents", "vault", "invoices", "bills", "open documents", "storage"],
      route: "/documents",
      label: "Document & Invoice Storage Vault",
      spokenText: "Opening Document and Invoice Storage Vault.",
    },
    {
      keywords: ["reports", "audit reports", "financial statements", "open reports"],
      route: "/reports",
      label: "Financial Reports",
      spokenText: "Opening Financial Reports.",
    },
    {
      keywords: ["settings", "configuration", "preferences", "open settings", "system settings"],
      route: "/settings",
      label: "Application Settings",
      spokenText: "Opening Application Settings.",
    },
  ];

  // Initialize Web Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSttSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-IN"; // Configured for Indian English context (Tax/Financial queries)

      recognition.onstart = () => {
        setIsListening(true);
        setMicError(null);
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcriptText = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptText;
          } else {
            interimTranscript += transcriptText;
          }
        }

        const currentText = finalTranscript || interimTranscript;
        if (currentText) {
          setQueryInput(currentText);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("[Voice Assistant] Recognition error:", event.error);
        setIsListening(false);

        if (event.error === "not-allowed" || event.error === "permission-denied") {
          setMicError("Microphone permission denied. Please allow microphone access in browser settings.");
        } else if (event.error === "no-speech") {
          setMicError("No speech detected. Please click the mic and try again.");
        } else if (event.error !== "aborted") {
          setMicError(`Voice error: ${event.error}. Please retry.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch (err) {
      console.error("[Voice Assistant] Failed to initialize SpeechRecognition:", err);
      setSttSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Cleanup speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Handle Speech-to-Text Toggle
  const toggleListening = () => {
    if (!sttSupported) {
      setMicError("Speech recognition is not supported in this browser. Please type your query.");
      return;
    }

    // Stop TTS if speaking
    stopSpeaking();

    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const startListening = () => {
    if (!recognitionRef.current) return;
    setMicError(null);
    try {
      recognitionRef.current.start();
    } catch (err) {
      // If already started, abort and restart
      try {
        recognitionRef.current.abort();
        setTimeout(() => recognitionRef.current.start(), 150);
      } catch (e) {
        console.error("Error starting speech recognition:", e);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }
    setIsListening(false);
  };

  const retryListening = () => {
    setMicError(null);
    setQueryInput("");
    startListening();
  };

  // Text-to-Speech Execution
  const speakText = (textToSpeak: string) => {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel(); // Stop any active speech

    // Clean text: strip markdown syntax (**bold**, headers, bullet points) for clear speech
    const cleanText = textToSpeak
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/#+\s/g, "")
      .replace(/`{1,3}.*?`{1,3}/g, "")
      .replace(/\[(.*?)\]\(.*?\)/g, "$1")
      .replace(/[-*]\s/g, "")
      .replace(/\n+/g, " ")
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Pick appropriate English voice if available
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(
      (v) => v.lang.includes("en-IN") || v.lang.includes("en-GB") || v.lang.includes("en-US")
    );
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  // Submit query through Voice Navigation Router & EXISTING Audit V Assistant API
  const handleSubmitQuery = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const queryToSend = queryInput.trim();
    if (!queryToSend || isProcessing) return;

    stopListening();
    stopSpeaking();

    const lowerQuery = queryToSend.toLowerCase().trim();

    // 1. Audio Control Voice Commands
    if (["stop speaking", "mute", "be quiet", "silence", "stop audio", "stop voice"].some((k) => lowerQuery.includes(k))) {
      stopSpeaking();
      setIsProcessing(false);
      setShowOverlay(false);
      return;
    }

    // 2. Help Voice Commands
    if (["help", "voice commands", "what can i say", "commands list", "options"].some((k) => lowerQuery === k || lowerQuery.includes("voice command"))) {
      setShowHelpModal(true);
      setIsProcessing(false);
      setShowOverlay(false);
      speakText("Here are the available voice commands to control Audit V.");
      return;
    }

    // 3. Direct Navigation Voice Commands across Audit V pages
    for (const cmd of VOICE_COMMAND_MAP) {
      if (cmd.keywords.some((kw) => lowerQuery === kw || lowerQuery.includes(kw))) {
        setIsProcessing(false);
        setShowOverlay(false);
        setNavToast(`Navigated to ${cmd.label}`);
        navigate(cmd.route);
        speakText(cmd.spokenText);
        setTimeout(() => setNavToast(null), 3500);
        return;
      }
    }

    // 4. Financial / Tax / RAG / Anomaly Queries passed to Backend Pipeline
    setIsProcessing(true);
    setMicError(null);
    setShowOverlay(true);

    const initialVoiceResp: VoiceResponse = {
      query: queryToSend,
      answer: "",
    };
    setVoiceResponse(initialVoiceResp);

    // If callback provided (e.g. AIAssistant page), notify parent
    if (onVoiceQuerySubmit) {
      onVoiceQuerySubmit(queryToSend);
    }

    try {
      // Retain context by attaching recent conversation turns if available
      let contextualMessage = queryToSend;
      if (conversationHistory.length > 0) {
        const lastTurns = conversationHistory.slice(-4); // Last 2 back-and-forths
        const historyPrompt = lastTurns
          .map((turn) => `${turn.role === "user" ? "User" : "Assistant"}: ${turn.content}`)
          .join("\n");
        contextualMessage = `Previous Context:\n${historyPrompt}\n\nCurrent Question: ${queryToSend}`;
      }

      // Call EXISTING Audit V Assistant API
      const response = await fetch("http://localhost:8000/api/v1/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: contextualMessage, stream: true }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || "Failed to communicate with Audit V AI Assistant API.");
      }

      if (!response.body) {
        throw new Error("No response stream body received from server.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let accumulatedAnswer = "";
      let responseMeta: Partial<VoiceResponse> = {};

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const lines = part.split("\n");
          let eventName = "";
          let eventData = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventName = line.replace("event: ", "").trim();
            } else if (line.startsWith("data: ")) {
              eventData = line.replace("data: ", "").trim();
            }
          }

          if (eventName === "metadata" && eventData) {
            try {
              const meta = JSON.parse(eventData);
              responseMeta = {
                intent: meta.intent,
                sources: meta.sources || [],
                used_tax_engine: meta.used_tax_engine,
                calculation: meta.calculation,
                guardrail_triggered: meta.guardrail_triggered || meta.audit_trail?.guardrail_triggered,
                audit_trail: meta.audit_trail,
              };
            } catch (_) {}
          } else if (eventName === "token" && eventData) {
            try {
              const tokenObj = JSON.parse(eventData);
              if (tokenObj.token) {
                accumulatedAnswer += tokenObj.token;
                setVoiceResponse((prev) =>
                  prev ? { ...prev, ...responseMeta, answer: accumulatedAnswer } : null
                );
              }
            } catch (_) {}
          } else if (eventName === "error" && eventData) {
            try {
              const errObj = JSON.parse(eventData);
              throw new Error(errObj.error || "Assistant stream error.");
            } catch (e) {
              throw e;
            }
          }
        }
      }

      const finalAnswer = accumulatedAnswer.trim() || "No response text generated.";

      setVoiceResponse((prev) =>
        prev ? { ...prev, ...responseMeta, answer: finalAnswer } : null
      );

      // Update conversation history context
      setConversationHistory((prev) => [
        ...prev,
        { role: "user", content: queryToSend },
        { role: "assistant", content: finalAnswer },
      ]);

      // Automatically trigger Text-to-Speech for final response!
      speakText(finalAnswer);
    } catch (err: any) {
      console.error("[Voice Assistant] API Error:", err);
      const errMsg = err.message || "Failed to process voice query.";
      setMicError(errMsg);
      setVoiceResponse((prev) =>
        prev ? { ...prev, answer: `⚠️ Error: ${errMsg}` } : null
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="relative">
      {/* ========================================================================= */}
      {/* 1. HEADER SEARCH BAR WITH INTEGRATED MICROPHONE CONTROL                   */}
      {/* Location: Top-Right Header [ 🔍 Search Audit V...        🎙️ ]            */}
      {/* ========================================================================= */}
      <form
        onSubmit={handleSubmitQuery}
        className={`
          relative hidden sm:flex h-10 items-center gap-2 rounded-xl border transition-all duration-300 px-3
          ${
            isListening
              ? "border-red-500/60 bg-red-950/20 shadow-[0_0_15px_rgba(239,68,68,0.25)]"
              : isSpeaking
              ? "border-emerald-500/60 bg-emerald-950/20 shadow-[0_0_15px_rgba(16,185,129,0.25)]"
              : isProcessing
              ? "border-cyan-500/60 bg-cyan-950/20 shadow-[0_0_15px_rgba(6,182,212,0.25)]"
              : "border-white/10 bg-white/[0.03] focus-within:border-cyan-400/40 focus-within:bg-white/[0.05]"
          }
        `}
      >
        <Search className="h-4 w-4 shrink-0 text-slate-400" />

        {/* Input & Waveform / Status Overlay */}
        <div className="relative flex-1 flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder={
              isListening
                ? "Listening... Speak your query..."
                : isProcessing
                ? "Processing voice query..."
                : isSpeaking
                ? "Speaking response..."
                : "Ask Audit V or click mic to speak..."
            }
            className="w-44 md:w-56 bg-transparent text-xs text-white outline-none placeholder:text-slate-500 pr-2"
          />

          {/* Active Audio Waveform Animation (when listening) */}
          {isListening && (
            <div className="absolute right-1 flex items-center gap-0.5 pointer-events-none">
              <span className="h-3 w-0.5 bg-red-400 animate-[bounce_0.8s_infinite_100ms] rounded-full" />
              <span className="h-4 w-0.5 bg-red-400 animate-[bounce_0.8s_infinite_200ms] rounded-full" />
              <span className="h-2 w-0.5 bg-red-400 animate-[bounce_0.8s_infinite_300ms] rounded-full" />
              <span className="h-4 w-0.5 bg-red-400 animate-[bounce_0.8s_infinite_400ms] rounded-full" />
            </div>
          )}

          {/* Speaking Audio Pulse (when TTS is active) */}
          {isSpeaking && (
            <div className="absolute right-1 flex items-center gap-0.5 pointer-events-none">
              <span className="h-3 w-0.5 bg-emerald-400 animate-[pulse_0.6s_infinite_100ms] rounded-full" />
              <span className="h-4 w-0.5 bg-emerald-400 animate-[pulse_0.6s_infinite_200ms] rounded-full" />
              <span className="h-3 w-0.5 bg-emerald-400 animate-[pulse_0.6s_infinite_300ms] rounded-full" />
            </div>
          )}
        </div>

        {/* Integrated Microphone & Speech Controls */}
        <div className="flex items-center gap-1 shrink-0 border-l border-white/10 pl-2">
          {/* TTS Stop Speaking Button */}
          {isSpeaking && (
            <button
              type="button"
              onClick={stopSpeaking}
              className="p-1 rounded-lg text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              title="Stop speaking"
              aria-label="Stop speaking"
            >
              <VolumeX className="h-4 w-4" />
            </button>
          )}

          {/* Stop Listening Button */}
          {isListening && (
            <button
              type="button"
              onClick={stopListening}
              className="p-1 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
              title="Stop listening"
              aria-label="Stop listening"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          )}

          {/* Voice Commands Help Button */}
          <button
            type="button"
            onClick={() => setShowHelpModal(true)}
            className="p-1 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-white/10 transition-colors"
            title="Voice Commands Guide & Navigation Help"
            aria-label="Voice Commands Guide"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>

          {/* Main Microphone Toggle Button */}
          <button
            type="button"
            onClick={toggleListening}
            className={`
              relative p-1.5 rounded-lg transition-all duration-300
              ${
                isListening
                  ? "bg-red-500/20 text-red-400 ring-2 ring-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.5)]"
                  : isSpeaking
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "text-slate-400 hover:text-cyan-300 hover:bg-white/10"
              }
            `}
            title={isListening ? "Listening... Click to stop" : "Voice Assistant — Click to speak"}
            aria-label="Toggle Voice Assistant Microphone"
          >
            {isListening ? (
              <MicOff className="h-4 w-4 animate-pulse text-red-400" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </button>
        </div>
      </form>

      {/* ========================================================================= */}
      {/* 2. MICROPHONE PERMISSION / ERROR TOOLTIP & RECOVER BANNER                 */}
      {/* ========================================================================= */}
      {micError && (
        <div className="absolute right-0 top-12 z-50 w-72 md:w-80 rounded-2xl border border-red-500/40 bg-[#090514]/95 p-3.5 backdrop-blur-2xl shadow-2xl text-xs">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-red-400 font-semibold">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Voice Error</span>
            </div>
            <button
              onClick={() => setMicError(null)}
              className="text-slate-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1.5 text-slate-300 leading-relaxed">{micError}</p>
          <div className="mt-3 flex items-center justify-end gap-2">
            {sttSupported && (
              <button
                type="button"
                onClick={retryListening}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors text-[11px] font-medium"
              >
                <RotateCcw className="h-3 w-3" />
                Retry Mic
              </button>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. FLOATING VOICE RESPONSE OVERLAY CARD                                    */}
      {/* Appears when a voice query is issued anywhere in the app                   */}
      {/* ========================================================================= */}
      {showOverlay && voiceResponse && (
        <div className="absolute right-0 top-12 z-50 w-80 md:w-96 rounded-3xl border border-cyan-500/30 bg-[#030712]/95 p-5 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] text-xs text-slate-200 animate-in fade-in slide-in-from-top-3 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <span className="font-bold text-white text-sm">Audit V Voice Response</span>
            </div>
            <button
              onClick={() => {
                setShowOverlay(false);
                stopSpeaking();
              }}
              className="p-1 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* User Spoken Query */}
          <div className="mt-3.5 rounded-xl border border-white/5 bg-white/[0.03] p-2.5 flex items-start gap-2">
            <User className="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Spoken Query</p>
              <p className="text-white text-xs mt-0.5 italic font-medium">"{voiceResponse.query}"</p>
            </div>
          </div>

          {/* Intent / Execution Badges */}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {voiceResponse.intent && (
              <span className="px-2 py-0.5 rounded-md border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-[10px] font-semibold uppercase tracking-wider">
                Intent: {voiceResponse.intent}
              </span>
            )}

            {voiceResponse.used_tax_engine && (
              <span className="px-2 py-0.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[10px] font-semibold">
                ⚡ Tax Engine
              </span>
            )}

            {voiceResponse.guardrail_triggered && (
              <span className="px-2 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[10px] font-semibold flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" />
                SEBI Guardrail Compliance
              </span>
            )}
          </div>

          {/* AI Answer Stream / Text */}
          <div className="mt-3 max-h-56 overflow-y-auto pr-1 text-slate-200 leading-relaxed font-normal space-y-2 border-t border-white/5 pt-2.5">
            {isProcessing && !voiceResponse.answer ? (
              <div className="flex items-center gap-2 text-cyan-400 text-xs py-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
                </span>
                Thinking & generating grounded response...
              </div>
            ) : (
              <p className="whitespace-pre-wrap">{voiceResponse.answer}</p>
            )}
          </div>

          {/* Footer Controls: Text-to-Speech Play/Stop & Open Page */}
          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
            <div className="flex items-center gap-2">
              {isSpeaking ? (
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-all text-xs font-medium"
                >
                  <VolumeX className="h-3.5 w-3.5" />
                  Stop Voice
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => speakText(voiceResponse.answer)}
                  disabled={!voiceResponse.answer || isProcessing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-300 transition-all text-xs font-medium disabled:opacity-40"
                >
                  <Volume2 className="h-3.5 w-3.5 text-cyan-400" />
                  Re-listen
                </button>
              )}
            </div>

            {/* Navigate to full AIAssistant view */}
            {location.pathname !== "/ai-assistant" && (
              <button
                type="button"
                onClick={() => {
                  setShowOverlay(false);
                  navigate("/ai-assistant");
                }}
                className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-xs font-semibold group"
              >
                <span>Full Chat View</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. VOICE NAVIGATION TOAST NOTIFICATION BANNER                             */}
      {/* Appears when a voice navigation command executes                          */}
      {/* ========================================================================= */}
      {navToast && (
        <div className="fixed top-20 right-8 z-50 flex items-center gap-2.5 rounded-2xl border border-cyan-400/40 bg-[#030712]/95 px-4 py-3 text-xs text-cyan-300 shadow-[0_0_25px_rgba(6,182,212,0.3)] backdrop-blur-2xl animate-in fade-in slide-in-from-top-2">
          <Zap className="h-4 w-4 text-cyan-400 animate-bounce" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">⚡ Voice Command Executed</span>
            <span className="font-bold text-white text-xs">{navToast}</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. VOICE COMMANDS CHEAT SHEET HELP MODAL                                   */}
      {/* Displays all available voice commands to control Audit V                  */}
      {/* ========================================================================= */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-xl rounded-3xl border border-cyan-500/30 bg-[#030712] p-6 shadow-2xl text-xs text-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <Compass className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Audit V Voice Commands Guide</h3>
                  <p className="text-slate-400 text-[11px]">Speak any of these commands to navigate & control Audit V</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content: Commands Categories Grid */}
            <div className="mt-4 max-h-96 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
              {/* Category 1: Navigation Voice Commands */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 mb-2 flex items-center gap-1.5">
                  <Compass className="h-3.5 w-3.5" />
                  Navigation Voice Commands
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl border border-white/5 bg-white/[0.03]">
                    <span className="font-semibold text-white">"Go to Dashboard"</span>
                    <p className="text-slate-400 text-[10px] mt-0.5">Navigates to Financial Command Center</p>
                  </div>
                  <div className="p-2.5 rounded-xl border border-white/5 bg-white/[0.03]">
                    <span className="font-semibold text-white">"Go to Tax" / "Tax Calculator"</span>
                    <p className="text-slate-400 text-[10px] mt-0.5">Navigates to Tax & GST Engine</p>
                  </div>
                  <div className="p-2.5 rounded-xl border border-white/5 bg-white/[0.03]">
                    <span className="font-semibold text-white">"Go to Salary Planner"</span>
                    <p className="text-slate-400 text-[10px] mt-0.5">Navigates to Salary Tax Optimizer</p>
                  </div>
                  <div className="p-2.5 rounded-xl border border-white/5 bg-white/[0.03]">
                    <span className="font-semibold text-white">"Open Market" / "Stocks"</span>
                    <p className="text-slate-400 text-[10px] mt-0.5">Navigates to Market Intelligence Hub</p>
                  </div>
                  <div className="p-2.5 rounded-xl border border-white/5 bg-white/[0.03]">
                    <span className="font-semibold text-white">"Open Banking"</span>
                    <p className="text-slate-400 text-[10px] mt-0.5">Navigates to Bank Feeds & Accounts</p>
                  </div>
                  <div className="p-2.5 rounded-xl border border-white/5 bg-white/[0.03]">
                    <span className="font-semibold text-white">"Show Risk and Fraud"</span>
                    <p className="text-slate-400 text-[10px] mt-0.5">Navigates to Risk & Anomaly Detection</p>
                  </div>
                  <div className="p-2.5 rounded-xl border border-white/5 bg-white/[0.03]">
                    <span className="font-semibold text-white">"Open Documents" / "Vault"</span>
                    <p className="text-slate-400 text-[10px] mt-0.5">Navigates to Document Vault</p>
                  </div>
                  <div className="p-2.5 rounded-xl border border-white/5 bg-white/[0.03]">
                    <span className="font-semibold text-white">"Open Settings"</span>
                    <p className="text-slate-400 text-[10px] mt-0.5">Navigates to Application Settings</p>
                  </div>
                </div>
              </div>

              {/* Category 2: Tax & Financial Voice Queries */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" />
                  Tax & Financial Voice Queries
                </h4>
                <div className="space-y-1.5">
                  <div className="p-2.5 rounded-xl border border-white/5 bg-white/[0.03] flex items-center justify-between">
                    <span className="font-semibold text-white">"Calculate tax for 12 lakh income"</span>
                    <span className="text-emerald-400 font-mono text-[10px]">Executes Tax Engine</span>
                  </div>
                  <div className="p-2.5 rounded-xl border border-white/5 bg-white/[0.03] flex items-center justify-between">
                    <span className="font-semibold text-white">"What is Section 80C under recodified Section 123?"</span>
                    <span className="text-cyan-400 font-mono text-[10px]">Queries RAG Vector DB</span>
                  </div>
                  <div className="p-2.5 rounded-xl border border-white/5 bg-white/[0.03] flex items-center justify-between">
                    <span className="font-semibold text-white">"What if I invest 50,000 in NPS?"</span>
                    <span className="text-violet-400 font-mono text-[10px]">Conversational Context</span>
                  </div>
                </div>
              </div>

              {/* Category 3: Voice Control Commands */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1.5">
                  <Volume2 className="h-3.5 w-3.5" />
                  Voice System Controls
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-xl border border-white/5 bg-white/[0.03]">
                    <span className="font-semibold text-white">"Stop speaking" / "Mute"</span>
                    <p className="text-slate-400 text-[10px]">Silences Text-to-Speech audio</p>
                  </div>
                  <div className="p-2 rounded-xl border border-white/5 bg-white/[0.03]">
                    <span className="font-semibold text-white">"Help"</span>
                    <p className="text-slate-400 text-[10px]">Opens this commands guide</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-3">
              <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Microphone status: Ready</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowHelpModal(false);
                  startListening();
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-500 text-slate-950 font-bold hover:from-cyan-300 hover:to-cyan-400 transition"
              >
                <Mic className="h-3.5 w-3.5" />
                <span>Start Voice Control</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
