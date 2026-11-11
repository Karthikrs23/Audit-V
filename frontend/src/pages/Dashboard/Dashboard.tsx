import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import FloatingPanel from "../../components/layout/FloatingPanel";
import {
  ArrowUpRight,
  Bot,
  ChartNoAxesCombined,
  CircleDollarSign,
  FileCheck2,
  TrendingUp,
  Sparkles,
  Wallet,
  PlusCircle,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchBankingRecords, fetchInvestmentHoldings } from "../../services/financialApi";

interface IndexQuote {
  symbol: string;
  name: string;
  price?: number | null;
  change?: number | null;
  change_percent?: number | null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [liquidBalance, setLiquidBalance] = useState<number | null>(null);
  const [accountCount, setAccountCount] = useState<number>(0);
  const [portfolioValue, setPortfolioValue] = useState<number | null>(null);
  const [holdingCount, setHoldingCount] = useState<number>(0);
  const [portfolioPnl, setPortfolioPnl] = useState<number>(0);
  const [marketQuotes, setMarketQuotes] = useState<IndexQuote[]>([]);
  const [marketStatus, setMarketStatus] = useState<string>("Checking market feed...");
  const [marketSource, setMarketSource] = useState<string>("Twelve Data Feed");

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const displayName = user?.full_name?.split(" ")[0] ?? user?.username ?? "";

  // Load actual user summaries from storage
  useEffect(() => {
    let active = true;

    // Banking
    fetchBankingRecords().then((res) => {
      if (active) {
        if (res.accounts.length > 0) {
          const total = res.accounts.reduce((s, a) => s + a.balance, 0);
          setLiquidBalance(total);
          setAccountCount(res.accounts.length);
        } else {
          setLiquidBalance(null);
          setAccountCount(0);
        }
      }
    });

    // Investments
    fetchInvestmentHoldings().then((res) => {
      if (active) {
        if (res.length > 0) {
          const cost = res.reduce((s, h) => s + h.quantity * h.buyPrice, 0);
          const current = res.reduce((s, h) => s + h.quantity * h.currentPrice, 0);
          setPortfolioValue(current);
          setPortfolioPnl(current - cost);
          setHoldingCount(res.length);
        } else {
          setPortfolioValue(null);
          setHoldingCount(0);
        }
      }
    });

    // Market Quotes from backend API
    fetch("http://localhost:8000/api/v1/market/quotes")
      .then((res) => res.json())
      .then((data) => {
        if (active && data.indices) {
          setMarketQuotes(data.indices.slice(0, 4));
          setMarketStatus(data.is_market_open ? "Market Active" : "Market Closed");
          setMarketSource(data.provider || "Twelve Data Reference");
        }
      })
      .catch(() => {
        if (active) {
          setMarketStatus("API Offline");
          setMarketQuotes([
            { symbol: "^NSEI", name: "NIFTY 50", price: 24850, change_percent: 1.24 },
            { symbol: "^BSESN", name: "SENSEX", price: 81920, change_percent: 0.92 },
            { symbol: "GOLD", name: "GOLD (10g)", price: 71850, change_percent: 0.48 },
            { symbol: "BTC-USD", name: "BITCOIN", price: 64820, change_percent: 2.16 },
          ]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const hasUserData = liquidBalance !== null || portfolioValue !== null;

  return (
    <div className="space-y-8 relative">
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 1. FLOATING WELCOME GLASS PANEL                                     */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <FloatingPanel className="overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-1.5 text-xs font-semibold text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
            <Bot className="h-4 w-4 text-cyan-400 animate-pulse" />
            <span>Audit V Intelligence</span>
          </div>

          {displayName && (
            <p className="text-sm font-semibold text-cyan-400/80 tracking-wide">
              {greeting}, {displayName} 👋
            </p>
          )}

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.12]">
            Your financial world,{" "}
            <span className="block bg-gradient-to-r from-cyan-300 via-cyan-400 to-violet-400 bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(6,182,212,0.35)]">
              transparent & input-driven.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal max-w-2xl">
            Track bank accounts, compute exact GST and personal income tax liabilities, analyze portfolios, and consult your grounded AI tax assistant.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate("/ai-assistant")}
              className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-cyan-500 px-6 py-3 text-sm font-bold text-slate-950 shadow-[0_0_30px_rgba(6,182,212,0.35)] transition hover:scale-105 hover:from-cyan-300 hover:to-cyan-400 cursor-pointer"
            >
              <span>Ask AI Assistant</span>
              <ArrowUpRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/tax")}
              className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-bold text-cyan-300 hover:bg-cyan-400/20 transition cursor-pointer"
            >
              <span>GST & Tax Engine</span>
            </button>
          </div>
        </div>
      </FloatingPanel>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 2. REAL FINANCIAL STAT CARDS GRID                                   */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4 relative z-10">
        {/* Card 1: Liquid Bank Balance */}
        <FloatingPanel
          onClick={() => navigate("/banking")}
          className="group !p-6 hover:-translate-y-1 hover:border-cyan-400/30 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-300">
              <Wallet className="h-5 w-5" />
            </div>
            <span className="rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400">
              {accountCount > 0 ? `${accountCount} Accounts` : "No Data"}
            </span>
          </div>
          <p className="mt-5 text-xs font-medium uppercase tracking-wider text-slate-400">Liquid Cash Balance</p>
          <div className="mt-1 text-2xl font-extrabold text-white font-mono">
            {liquidBalance !== null
              ? `₹${liquidBalance.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
              : "₹0.00"}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {liquidBalance !== null ? "From recorded accounts" : "Click to add bank accounts"}
          </p>
        </FloatingPanel>

        {/* Card 2: Investment Portfolio */}
        <FloatingPanel
          onClick={() => navigate("/investments")}
          className="group !p-6 hover:-translate-y-1 hover:border-cyan-400/30 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-300">
              <CircleDollarSign className="h-5 w-5" />
            </div>
            {portfolioValue !== null && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold border ${
                portfolioPnl >= 0
                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-300 border-rose-500/20"
              }`}>
                {portfolioPnl >= 0 ? "+" : ""}₹{portfolioPnl.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </span>
            )}
          </div>
          <p className="mt-5 text-xs font-medium uppercase tracking-wider text-slate-400">Recorded Portfolio</p>
          <div className="mt-1 text-2xl font-extrabold text-white font-mono">
            {portfolioValue !== null
              ? `₹${portfolioValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
              : "₹0.00"}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {holdingCount > 0 ? `${holdingCount} active holdings` : "Click to record holdings"}
          </p>
        </FloatingPanel>

        {/* Card 3: Tax Engine Status */}
        <FloatingPanel
          onClick={() => navigate("/tax")}
          className="group !p-6 hover:-translate-y-1 hover:border-cyan-400/30 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-emerald-300">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
              Active
            </span>
          </div>
          <p className="mt-5 text-xs font-medium uppercase tracking-wider text-slate-400">Statutory Tax Engine</p>
          <div className="mt-1 text-2xl font-extrabold text-white">FY 2026-27</div>
          <p className="mt-1 text-xs text-slate-400">GST & Dual-Regime Income Tax</p>
        </FloatingPanel>

        {/* Card 4: Market Telemetry */}
        <FloatingPanel
          onClick={() => navigate("/market")}
          className="group !p-6 hover:-translate-y-1 hover:border-cyan-400/30 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-300">
              <TrendingUp className="h-5 w-5" />
            </div>
            <span className="rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400">
              ~15m Delay
            </span>
          </div>
          <p className="mt-5 text-xs font-medium uppercase tracking-wider text-slate-400">Market Feed Status</p>
          <div className="mt-1 text-2xl font-extrabold text-white truncate text-base sm:text-xl">
            {marketStatus}
          </div>
          <p className="mt-1 text-xs text-slate-400">{marketSource}</p>
        </FloatingPanel>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 3. HONEST EMPTY STATE ONBOARDING (IF NO DATA)                       */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {!hasUserData && (
        <FloatingPanel className="border-dashed border-slate-700/80 bg-slate-900/40 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-cyan-400" />
                No Personal Records Found — Get Started with Audit V
              </h3>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                Audit V does not generate fake bank balances or fictitious financial scores. Enter your bank accounts, record expenses, or log investment holdings to see real mathematical calculations.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate("/banking")}
                className="rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-400 transition"
              >
                + Add Bank Account
              </button>
              <button
                type="button"
                onClick={() => navigate("/investments")}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200 hover:text-white transition"
              >
                + Add Holdings
              </button>
            </div>
          </div>
        </FloatingPanel>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 4. LOWER DASHBOARD (LIVE MARKET FEED & AI SUMMARY)                  */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="grid gap-6 lg:grid-cols-3 relative z-10">
        {/* Real Market Quotes Panel */}
        <FloatingPanel
          onClick={() => navigate("/market")}
          className="lg:col-span-2 space-y-5 cursor-pointer hover:border-cyan-400/30 transition"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                Market Intelligence
              </p>
              <h2 className="mt-1 text-lg font-bold text-white flex items-center gap-2">
                Live / Delayed Benchmark Quotes
                {marketStatus === "API Offline" && (
                  <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold">
                    Demo data
                  </span>
                )}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-mono">
                {marketSource} (delayed ~15 min, informational only)
              </span>
              <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-cyan-400">
                <ChartNoAxesCombined className="h-4 w-4" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {marketQuotes.map((q) => {
              const chg = q.change_percent ?? 0;
              return (
                <div
                  key={q.symbol}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 transition hover:border-cyan-400/30"
                >
                  <p className="text-xs font-medium text-slate-400 truncate">{q.name}</p>
                  <p className="mt-1.5 text-base font-bold text-white font-mono">
                    {q.price !== undefined && q.price !== null
                      ? `₹${q.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
                      : "--"}
                  </p>
                  <p className={`mt-0.5 text-xs font-mono font-semibold ${chg >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {chg >= 0 ? "+" : ""}{chg.toFixed(2)}%
                  </p>
                </div>
              );
            })}
          </div>
        </FloatingPanel>

        {/* AI Insight Floating Panel */}
        <FloatingPanel className="border-cyan-400/20 bg-gradient-to-br from-cyan-500/[0.08] via-violet-600/[0.08] to-transparent flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-3 text-cyan-300">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                  AI Compliance Engine
                </p>
                <p className="text-xs text-slate-400">
                  Audit V Deterministic RAG
                </p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-300 pt-1">
              Deterministic engines are active for GST tariff calculations and dual-regime Income Tax optimization under Section 115BAC (recodified as Section 202 under Income Tax Act 2025).
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/ai-assistant")}
            className="mt-6 w-full rounded-xl border border-cyan-400/30 bg-cyan-400/10 py-2.5 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-400/20 hover:text-white cursor-pointer"
          >
            Consult AI Assistant
          </button>
        </FloatingPanel>
      </section>
    </div>
  );
}