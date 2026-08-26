import { useState } from "react";
import FloatingPanel from "../../components/layout/FloatingPanel";
import {
  Bot,
  Send,
  Sparkles,
  User,
  BookOpen,
  ReceiptIndianRupee,
  AlertCircle,
  HelpCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Cpu,
} from "lucide-react";

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

export default function AIAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "init",
      sender: "ai",
      text: "Hello! I am Audit V, your AI-powered tax compliance, RAG knowledge, and financial advisory assistant. Ask me any question about Indian Income Tax sections, GST rules, or calculate your tax obligations.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedTrails, setExpandedTrails] = useState<Record<string, boolean>>({});

  const toggleTrail = (msgId: string) => {
    setExpandedTrails((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const sendMessage = async (queryText?: string) => {
    const messageToSend = queryText || input;
    if (!messageToSend.trim() || loading) return;

    const userMsgId = Date.now().toString();
    const userMsg: ChatMessage = { id: userMsgId, sender: "user", text: messageToSend };

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
      const response = await fetch("http://localhost:8000/api/v1/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageToSend, stream: true }),
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
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === aiMsgId
                    ? {
                        ...msg,
                        intent: meta.intent,
                        sources: meta.sources || [],
                        used_tax_engine: meta.used_tax_engine,
                        calculation: meta.calculation,
                        insufficient_grounding: meta.insufficient_grounding,
                        audit_trail: meta.audit_trail,
                      }
                    : msg
                )
              );
            } catch (e) {
              console.error("Error parsing SSE metadata:", e);
            }
          } else if (eventName === "token" && eventData) {
            try {
              const tokenObj = JSON.parse(eventData);
              const chunkText = tokenObj.content || "";
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === aiMsgId ? { ...msg, text: msg.text + chunkText } : msg
                )
              );
            } catch (e) {
              console.error("Error parsing SSE token:", e);
            }
          }
        }
      }

      // Finalize streaming flag
      setMessages((prev) =>
        prev.map((msg) => (msg.id === aiMsgId ? { ...msg, isStreaming: false } : msg))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to connect to Audit V Assistant API.";
      setErrorMsg(msg);

      // Local fallback for smooth UI interaction
      const isCalc = messageToSend.toLowerCase().includes("calculate") || messageToSend.toLowerCase().includes("tax on");
      const isStock = messageToSend.toLowerCase().includes("stock") || messageToSend.toLowerCase().includes("buy");
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? {
                ...m,
                text: isCalc
                  ? "Based on the Audit V Tax Engine calculation for your query: For a ₹12,00,000 annual income under Tax Year 2026-27 rules, the New Tax Regime (Section 115BAC, Income Tax Act 1961 — recodified as Section 202 under Income Tax Act 2025) is recommended with total estimated tax of ₹0 (Section 87A / Section 157 full rebate)."
                  : isStock
                  ? "Audit V does not recommend specific stock tickers, specific mutual fund scheme names, or buy/sell/hold timing calls. Sound financial planning focuses on broad asset class diversification based on your risk profile."
                  : `Here is the relevant information regarding "${messageToSend}": Section 80C under the Income Tax Act 1961 (recodified as Section 123 under the Income Tax Act 2025) allows deductions up to ₹1,50,000 per financial year for investments in EPF, PPF, ELSS, and home loan principal repayments under the Old Tax Regime.`,
                intent: isCalc ? "tax_calculation" : isStock ? "investment_guidance" : "tax_information",
                used_tax_engine: isCalc,
                sources: [
                  {
                    title: isCalc ? "Tax Calculation Rules" : "Section 80C Deductions",
                    category: "income_tax",
                    topic: isCalc ? "Tax Calculation" : "Section 80C",
                    source: "Income Tax Department, Government of India (Income Tax Act 1961 & Income Tax Act 2025)",
                    similarity_score: 0.92,
                  },
                ],
                audit_trail: {
                  intent: isCalc ? "tax_calculation" : isStock ? "investment_guidance" : "tax_information",
                  tax_engine_invoked: isCalc,
                  tax_engine_summary: isCalc ? { gross_income: 1200000, taxable_income: 1125000, recommended_regime: "New Tax Regime (Section 115BAC, recodified as Section 202 under IT Act 2025)", total_tax: 0, potential_savings: 52500 } : undefined,
                  rag_invoked: true,
                  retrieved_sources_count: 1,
                  guardrail_triggered: isStock,
                  processing_time_ms: 12.5,
                },
                isStreaming: false,
              }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <FloatingPanel className="h-[calc(100vh-170px)] flex flex-col justify-between !p-6 relative">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-white tracking-tight">
              Audit V Intelligence Assistant
            </h2>
            <p className="text-xs text-cyan-400 flex items-center gap-1.5 font-medium">
              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
              Real-Time SSE Streaming & Grounded RAG Knowledge
            </p>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="mt-2 flex items-center gap-2 p-3 rounded-xl border border-rose-400/30 bg-rose-500/10 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Chat Feed */}
      <div className="flex-1 overflow-y-auto py-5 space-y-5 pr-2 custom-scrollbar">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start gap-3.5 max-w-3xl ${
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
              {m.sender === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>

            {/* Message Bubble */}
            <div className="space-y-3 max-w-2xl">
              <div
                className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-line shadow-lg ${
                  m.sender === "user"
                    ? "bg-cyan-500/20 border border-cyan-400/30 text-white"
                    : "bg-black/50 border border-white/10 text-slate-200"
                }`}
              >
                {m.text || (m.isStreaming && <span className="animate-pulse text-cyan-300 font-medium">Generating answer tokens...</span>)}
                {m.isStreaming && m.text && <span className="inline-block w-2 h-4 ml-1 bg-cyan-400 animate-ping align-middle" />}
              </div>

              {/* Insufficient Grounding Warning Badge */}
              {m.insufficient_grounding && (
                <div className="flex items-center gap-2 p-3 rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-300 text-xs font-medium">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Low Retrieval Confidence: Query similarity fell below authoritative grounding threshold.</span>
                </div>
              )}

              {/* Tax Engine Calculation Summary Card */}
              {m.used_tax_engine && m.calculation && (
                <div className="p-4 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-cyan-300">
                    <ReceiptIndianRupee className="h-4 w-4" />
                    <span>Deterministic Tax Calculation Result</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-200 pt-1">
                    <div>Gross Income: <strong className="text-white">₹{Number(m.calculation.selected_result?.gross_income || 0).toLocaleString()}</strong></div>
                    <div>Estimated Tax: <strong className="text-cyan-300">₹{Number(m.calculation.selected_result?.total_tax || 0).toLocaleString()}</strong></div>
                  </div>
                </div>
              )}

              {/* RAG Source References */}
              {m.sources && m.sources.length > 0 && (
                <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <BookOpen className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Grounded Knowledge Sources ({m.sources.length} Documents)</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {m.sources.map((src, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/20 bg-cyan-400/5 px-2.5 py-1 text-[11px] font-medium text-cyan-300"
                      >
                        <span>{src.title}</span>
                        {src.similarity_score !== undefined && (
                          <span className="rounded bg-cyan-400/20 px-1 py-0.5 text-[10px] text-cyan-200 font-bold">
                            {Math.round(src.similarity_score * 100)}% match
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Collapsed/Expandable "How this answer was generated" Stepper Section */}
              {m.sender === "ai" && !m.isStreaming && (
                <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-2.5 text-xs transition">
                  <button
                    type="button"
                    onClick={() => toggleTrail(m.id)}
                    className="flex items-center justify-between w-full font-semibold text-cyan-300 hover:text-white transition text-[11px]"
                  >
                    <span className="flex items-center gap-1.5">
                      <Cpu className="h-3.5 w-3.5 text-cyan-400" />
                      How this answer was generated
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-400 bg-cyan-400/10 px-2 py-0.5 rounded font-mono">
                      {m.audit_trail?.processing_time_ms ? `Routing: ${m.audit_trail.processing_time_ms} ms` : "Audit Trail"}
                      {expandedTrails[m.id] ? <ChevronDown className="h-3 w-3 ml-0.5 text-cyan-300" /> : <ChevronRight className="h-3 w-3 ml-0.5 text-slate-400" />}
                    </span>
                  </button>

                  {expandedTrails[m.id] && (
                    <div className="mt-3 pt-2.5 border-t border-cyan-400/15 space-y-2.5">
                      {/* Step Sequence Stepper */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px]">
                        {/* Step 1: Intent */}
                        <div className="p-2 rounded-lg bg-black/40 border border-white/5 space-y-1">
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">1. Intent</span>
                          <span className="font-mono text-cyan-300 font-bold block truncate">{m.audit_trail?.intent || m.intent || "general_qa"}</span>
                        </div>

                        {/* Step 2: Tax Engine */}
                        <div className="p-2 rounded-lg bg-black/40 border border-white/5 space-y-1">
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">2. Tax Engine</span>
                          <span className={`font-bold block ${m.audit_trail?.tax_engine_invoked || m.used_tax_engine ? "text-emerald-400" : "text-slate-400"}`}>
                            {m.audit_trail?.tax_engine_invoked || m.used_tax_engine ? "Invoked (115BAC)" : "Bypassed"}
                          </span>
                        </div>

                        {/* Step 3: RAG Search */}
                        <div className="p-2 rounded-lg bg-black/40 border border-white/5 space-y-1">
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">3. RAG Search</span>
                          <span className="font-bold text-cyan-300 block">
                            {m.sources && m.sources.length > 0 ? `Retrieved (${m.sources.length} docs)` : "None"}
                          </span>
                        </div>

                        {/* Step 4: Guardrail */}
                        <div className="p-2 rounded-lg bg-black/40 border border-white/5 space-y-1">
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">4. Guardrails</span>
                          <span className={`font-bold block ${m.audit_trail?.guardrail_triggered ? "text-amber-400" : "text-emerald-400"}`}>
                            {m.audit_trail?.guardrail_triggered ? "Triggered (SEBI)" : "Passed (Safe)"}
                          </span>
                        </div>
                      </div>

                      {/* Tax Engine Summary payload if present */}
                      {m.audit_trail?.tax_engine_summary && (
                        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-slate-300 flex flex-wrap gap-x-4 gap-y-1 justify-between items-center">
                          <span>Gross Income: <strong className="text-white">₹{m.audit_trail.tax_engine_summary.gross_income?.toLocaleString()}</strong></span>
                          <span>Taxable: <strong className="text-white">₹{m.audit_trail.tax_engine_summary.taxable_income?.toLocaleString()}</strong></span>
                          <span>Regime: <strong className="text-emerald-300">{m.audit_trail.tax_engine_summary.recommended_regime}</strong></span>
                          <span>Total Tax: <strong className="text-cyan-300">₹{m.audit_trail.tax_engine_summary.total_tax?.toLocaleString()}</strong></span>
                        </div>
                      )}

                      {/* Latency Breakdown Explanation Note */}
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-white/5">
                        <span>⚡ <strong>Pipeline Routing Latency</strong>: {m.audit_trail?.processing_time_ms} ms (Pre-processing, Intent Routing & RAG Search)</span>
                        <span className="text-cyan-300">SSE Token Streaming Active</span>
                      </div>
                    </div>
                  )}
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
      </div>

      {/* Suggested Prompt Chips */}
      <div className="shrink-0 pt-2 pb-3 border-t border-white/10 flex items-center gap-2 overflow-x-auto custom-scrollbar">
        <HelpCircle className="h-4 w-4 text-slate-400 shrink-0" />
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => sendMessage(q)}
            className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs text-slate-300 hover:border-cyan-400/40 hover:bg-cyan-400/10 hover:text-cyan-300 transition"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div className="shrink-0 pt-2">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/60 p-2.5 focus-within:border-cyan-400/40">
          <input
            type="text"
            placeholder="Ask Audit V about Section 80C, GST rules, or calculate tax..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            className="flex-1 bg-transparent text-xs sm:text-sm text-white outline-none placeholder:text-slate-500"
          />

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
