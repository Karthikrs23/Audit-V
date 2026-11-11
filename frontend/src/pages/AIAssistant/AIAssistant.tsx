import { useState, useRef, useEffect, useCallback } from "react";
import FloatingPanel from "../../components/layout/FloatingPanel";
import {
  Bot,
  Send,
  Sparkles,
  AlertCircle,
  HelpCircle,
  AlertTriangle,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Trash2,
  Zap,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { apiGetChatHistory, apiSaveChatMessage, apiClearChatHistory } from "../../services/authApi";

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

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  intent?: string;
  sources?: SourceRef[];
  used_tax_engine?: boolean;
  calculation?: Record<string, any>;
  insufficient_grounding?: boolean;
  audit_trail?: AuditTrailData;
  isStreaming?: boolean;
}

const SUGGESTED_QUESTIONS = [
  "What is Section 80C?",
  "How does GST registration work?",
  "What is the standard deduction?",
  "How can I reduce my taxable income?",
  "Calculate tax for ₹12 lakh annual income.",
];

const WELCOME_MSG: ChatMessage = {
  id: "init",
  sender: "ai",
  text: "Hello! I am Audit V, your AI-powered tax compliance, RAG knowledge, and financial advisory assistant. Ask me any question about Indian Income Tax sections, GST rules, or calculate your tax obligations.",
};

export default function AIAssistant() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MSG]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [isFastMode, setIsFastMode] = useState<boolean>(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Load persisted chat history for the user on mount
  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    apiGetChatHistory(200)
      .then((history) => {
        if (cancelled) return;
        if (history.length === 0) {
          setMessages([WELCOME_MSG]);
        } else {
          const loaded: ChatMessage[] = history.map((m) => ({
            id: String(m.id),
            sender: m.role === "user" ? "user" : "ai",
            text: m.content,
          }));
          setMessages([WELCOME_MSG, ...loaded]);
        }
      })
      .catch(() => setMessages([WELCOME_MSG]))
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
    return () => { abortControllerRef.current?.abort(); };
  }, []);

  // Helper: persist a message to the backend silently
  const persistMessage = useCallback((role: string, content: string) => {
    apiSaveChatMessage(role, content).catch(() => { /* non-blocking */ });
  }, []);

  const clearHistory = async () => {
    await apiClearChatHistory();
    setMessages([WELCOME_MSG]);
  };

  // Text-to-Speech playback for chat message bubbles
  const speakMessage = (msgId: string, textToSpeak: string) => {
    if (!window.speechSynthesis) return;

    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();

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

    utterance.onstart = () => setSpeakingMsgId(msgId);
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);

    window.speechSynthesis.speak(utterance);
  };

  // Speech-to-Text for chat input box
  const toggleVoiceInput = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMsg("Speech recognition is not supported in this browser.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-IN";

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) setInput(transcript);
      };
      recognition.onerror = (err: any) => {
        console.warn("Speech error:", err);
        setIsListening(false);
      };
      recognition.onend = () => setIsListening(false);

      recognition.start();
    } catch (e) {
      console.error("Mic start error:", e);
      setIsListening(false);
    }
  };

  const sendMessage = async (queryText?: string) => {
    const messageToSend = queryText || input;
    if (!messageToSend.trim() || loading) return;

    // Abort any ongoing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userMsgId = Date.now().toString();
    const userMsg: ChatMessage = { id: userMsgId, sender: "user", text: messageToSend };
    persistMessage("user", messageToSend);

    const aiMsgId = (Date.now() + 1).toString();
    const initialAiMsg: ChatMessage = {
      id: aiMsgId,
      sender: "ai",
      text: "",
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, initialAiMsg]);
    if (!queryText) setInput("");
    setLoading(true);
    setErrorMsg(null);

    try {
      const apiHost =
        typeof window !== "undefined" && window.location.hostname === "127.0.0.1"
          ? "http://127.0.0.1:8000"
          : "http://localhost:8000";

      const response = await fetch(`${apiHost}/api/v1/assistant/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageToSend, stream: true, fast_mode: isFastMode }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || "Error communicating with AI Assistant API.");
      }

      if (!response.body) {
        throw new Error("No response body received from server.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let currentEvent = "message";
      let currentData = "";

      const handleSseEvent = (eventName: string, dataStr: string) => {
        if (!dataStr) return;
        try {
          const parsed = JSON.parse(dataStr);
          if (eventName === "metadata") {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === aiMsgId
                  ? {
                      ...msg,
                      intent: parsed.intent,
                      sources: parsed.sources || [],
                      used_tax_engine: parsed.used_tax_engine,
                      calculation: parsed.calculation,
                      insufficient_grounding: parsed.insufficient_grounding,
                      audit_trail: parsed.audit_trail,
                    }
                  : msg
              )
            );
          } else if (eventName === "token") {
            const tokenText = parsed.content ?? "";
            if (tokenText) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === aiMsgId ? { ...msg, text: msg.text + tokenText } : msg
                )
              );
            }
          }
        } catch (e) {
          console.warn("SSE JSON Parse notice:", e, dataStr);
        }
      };

      const processLine = (line: string) => {
        if (line.endsWith("\r")) {
          line = line.slice(0, -1);
        }

        if (line === "") {
          if (currentData) {
            handleSseEvent(currentEvent, currentData);
          }
          currentEvent = "message";
          currentData = "";
          return;
        }

        if (line.startsWith("event:")) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          const dataContent = line.slice(5).trimStart();
          currentData = currentData ? `${currentData}\n${dataContent}` : dataContent;
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          if (buffer) {
            processLine(buffer);
            buffer = "";
          }
          if (currentData) {
            handleSseEvent(currentEvent, currentData);
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          processLine(line);
        }
      }

      // Finalize streaming flag, persist AI response, ensure text is not blank
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === aiMsgId) {
            const finalText = msg.text.trim()
              ? msg.text
              : "Unable to generate the response. The knowledge retrieval completed, but the language model response failed. Please check your query or try again.";
            persistMessage("assistant", finalText);
            return { ...msg, text: finalText, isStreaming: false };
          }
          return msg;
        })
      );
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      const msg = err instanceof Error ? err.message : "Failed to connect to Audit V Assistant API.";
      setErrorMsg(msg);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? {
                ...m,
                text: m.text.trim()
                  ? m.text
                  : "Unable to generate the response. An error occurred while communicating with the assistant service.",
                isStreaming: false,
              }
            : m
        )
      );
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  // User initials for chat avatar
  const userInitials = user
    ? (user.full_name ?? user.username).split(" ").map((w) => w[0]?.toUpperCase()).slice(0, 2).join("")
    : "U";

  return (
    <FloatingPanel className="h-[calc(100vh-105px)] flex flex-col justify-between !p-5 sm:!p-6 relative">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
              Audit V Intelligence Assistant
            </h2>
            <p className="text-[11px] sm:text-xs text-cyan-400 flex items-center gap-1.5 font-medium">
              <Sparkles className="h-3 w-3 animate-pulse" />
              {historyLoading ? "Loading your chat history…" : "Real-Time SSE Streaming & Grounded RAG Knowledge"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Quick Mode Toggle */}
          <button
            type="button"
            onClick={() => setIsFastMode((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
              isFastMode
                ? "bg-amber-400/10 text-amber-300 border-amber-400/30 shadow-[0_0_12px_rgba(251,191,36,0.15)]"
                : "bg-white/5 text-slate-400 border-white/10 hover:text-white"
            }`}
            title={
              isFastMode
                ? "Quick Mode: grounded answer from verified sources"
                : "AI-generated by fine-tuned Qwen2.5-3B"
            }
          >
            <Zap className={`h-3.5 w-3.5 ${isFastMode ? "text-amber-400 fill-amber-400" : ""}`} />
            <span>{isFastMode ? "Quick Mode: grounded answer from verified sources" : "AI-generated by fine-tuned Qwen2.5-3B"}</span>
          </button>

          {/* Clear history button */}
          {messages.length > 1 && !loading && (
            <button
              type="button"
              onClick={clearHistory}
              title="Clear your chat history"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-slate-400 border border-white/10 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 transition cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="mt-2 flex items-center gap-2 p-3 rounded-xl border border-rose-400/30 bg-rose-500/10 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Chat Feed - Maximized Vertical Area */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-2 custom-scrollbar">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start gap-3.5 max-w-5xl ${
              m.sender === "user" ? "ml-auto flex-row-reverse" : ""
            }`}
          >
            {/* Avatar */}
            <div
              className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold shadow-md ${
                m.sender === "user"
                  ? "bg-gradient-to-br from-cyan-400 to-violet-600 text-white"
                  : "border border-cyan-400/30 bg-cyan-400/10 text-cyan-300"
              }`}
            >
              {m.sender === "user" ? (
                <span className="text-[11px] font-black">{userInitials}</span>
              ) : (
                <Bot className="h-4 w-4" />
              )}
            </div>

            {/* Message Bubble */}
            <div className="space-y-3 max-w-4xl w-full">
              <div
                className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-line shadow-lg ${
                  m.sender === "user"
                    ? "bg-cyan-500/20 border border-cyan-400/30 text-white"
                    : "bg-black/50 border border-white/10 text-slate-200"
                }`}
              >
                {m.text ? (
                  <>
                    {m.text}
                    {m.isStreaming && (
                      <span className="inline-block w-1.5 h-4 ml-1 bg-cyan-400 animate-pulse rounded-full align-middle" />
                    )}
                  </>
                ) : m.isStreaming ? (
                  <span className="text-slate-400 italic flex items-center gap-2">
                    <span className="inline-block w-2 h-2 bg-cyan-400 rounded-full animate-ping" />
                    Analyzing tax regulations & preparing response...
                  </span>
                ) : (
                  <span className="text-slate-400 italic">No response content received. Please try again.</span>
                )}

                {m.sender === "ai" && m.text && !m.isStreaming && (
                  <div className="flex items-center justify-end gap-2 mt-2 pt-1.5 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => speakMessage(m.id, m.text)}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-cyan-300 transition"
                      title={speakingMsgId === m.id ? "Stop speaking" : "Listen to response"}
                    >
                      {speakingMsgId === m.id ? (
                        <>
                          <VolumeX className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                          <span className="text-emerald-400 font-medium">Stop Voice</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="h-3.5 w-3.5 text-cyan-400" />
                          <span>Listen</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Insufficient Grounding Warning (only when confidence is extremely low and no answer was generated) */}
              {m.insufficient_grounding && !m.text && (
                <div className="flex items-center gap-2 p-3 rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-300 text-xs font-medium">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>I need more details or verified statutory context to answer this query reliably.</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && !messages.some((m) => m.isStreaming) && (
          <div className="flex items-center gap-3 text-xs text-cyan-300 animate-pulse p-2">
            <Bot className="h-4 w-4" />
            <span>Audit V RAG Engine initializing stream & computing tax rules...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Suggested Prompt Chips */}
      <div className="shrink-0 pt-2 pb-3 border-t border-white/10 flex items-center gap-2 overflow-x-auto custom-scrollbar">
        <HelpCircle className="h-4 w-4 text-slate-400 shrink-0" />
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={loading}
            onClick={() => sendMessage(q)}
            className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs text-slate-300 hover:border-cyan-400/40 hover:bg-cyan-400/10 hover:text-cyan-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div className="shrink-0 pt-2">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/60 p-2.5 focus-within:border-cyan-400/40">
          <input
            ref={inputRef}
            id="ai-assistant-chat-input"
            type="text"
            placeholder={loading ? "Generating response..." : "Ask Audit V about Section 80C, GST rules, or calculate tax (Press M to focus)..."}
            value={input}
            disabled={loading}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && sendMessage()}
            className="flex-1 bg-transparent text-xs sm:text-sm text-white outline-none placeholder:text-slate-500 disabled:opacity-50"
          />

          <button
            type="button"
            onClick={toggleVoiceInput}
            className={`p-2.5 rounded-xl transition ${
              isListening
                ? "bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.4)]"
                : "text-slate-400 hover:text-cyan-300 hover:bg-white/10"
            }`}
            title={isListening ? "Listening... Click to stop" : "Voice Input"}
          >
            {isListening ? <MicOff className="h-4 w-4 text-red-400 animate-pulse" /> : <Mic className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-500 text-slate-950 font-bold hover:from-cyan-300 hover:to-cyan-400 transition disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </FloatingPanel>
  );
}
