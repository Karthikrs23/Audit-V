import { useState, useEffect } from "react";
import FloatingPanel from "../../components/layout/FloatingPanel";
import {
  PieChart as PieIcon,
  Trash2,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Save,
  CheckCircle2,
  Info,
  RefreshCw,
  Coins,
  DollarSign,
} from "lucide-react";
import {
  fetchInvestmentHoldings,
  saveInvestmentHoldings,
  type InvestmentHolding,
} from "../../services/financialApi";

const DEMO_HOLDINGS: InvestmentHolding[] = [
  {
    id: "HOLD-01",
    symbol: "RELIANCE",
    name: "Reliance Industries Ltd",
    assetType: "Equity",
    quantity: 50,
    buyPrice: 1250,
    currentPrice: 1290,
    purchaseDate: "2026-03-15",
  },
  {
    id: "HOLD-02",
    symbol: "HDFCBANK",
    name: "HDFC Bank Ltd",
    assetType: "Equity",
    quantity: 100,
    buyPrice: 720,
    currentPrice: 755,
    purchaseDate: "2026-04-10",
  },
  {
    id: "HOLD-03",
    symbol: "UTI-NIFTY50",
    name: "UTI Nifty 50 Index Mutual Fund",
    assetType: "Mutual Fund",
    quantity: 1200,
    buyPrice: 150,
    currentPrice: 172,
    purchaseDate: "2026-01-20",
  },
  {
    id: "HOLD-04",
    symbol: "SGB-2026",
    name: "Sovereign Gold Bond Series II",
    assetType: "Gold & Bullion",
    quantity: 15,
    buyPrice: 6800,
    currentPrice: 7180,
    purchaseDate: "2026-02-14",
  },
  {
    id: "HOLD-05",
    symbol: "GOI-SEC-7.26",
    name: "Government of India 7.26% GS 2033",
    assetType: "Debt / Fixed Income",
    quantity: 200,
    buyPrice: 99.5,
    currentPrice: 101.2,
    purchaseDate: "2026-05-02",
  },
];

interface GuidanceAllocation {
  asset_class: string;
  percentage: number;
  description: string;
}

export default function Investment() {
  const [holdings, setHoldings] = useState<InvestmentHolding[]>([]);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Form state
  const [sym, setSym] = useState("");
  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState<InvestmentHolding["assetType"]>("Equity");
  const [qty, setQty] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [currPrice, setCurrPrice] = useState("");
  const [txDate, setTxDate] = useState(new Date().toISOString().split("T")[0]);

  // Backend Guidance state
  const [riskProfile, setRiskProfile] = useState<"conservative" | "moderate" | "aggressive">("moderate");
  const [guidanceAllocations, setGuidanceAllocations] = useState<GuidanceAllocation[]>([]);
  const [headroom80c, setHeadroom80c] = useState<number>(0);
  const [loadingGuidance, setLoadingGuidance] = useState<boolean>(false);

  // Load user holdings
  useEffect(() => {
    let active = true;
    fetchInvestmentHoldings().then((res) => {
      if (active && res.length > 0) {
        setHoldings(res);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const activeHoldings = isDemoMode && holdings.length === 0 ? DEMO_HOLDINGS : holdings;

  // Real Mathematical Calculations
  const totalInvested = activeHoldings.reduce((sum, h) => sum + h.quantity * h.buyPrice, 0);
  const totalCurrentValue = activeHoldings.reduce((sum, h) => sum + h.quantity * h.currentPrice, 0);
  const totalUnrealizedPnL = totalCurrentValue - totalInvested;
  const returnPercentage = totalInvested > 0 ? (totalUnrealizedPnL / totalInvested) * 100 : 0;

  // Asset Class Allocation Percentages
  const classBreakdown = activeHoldings.reduce((acc, h) => {
    const val = h.quantity * h.currentPrice;
    acc[h.assetType] = (acc[h.assetType] || 0) + val;
    return acc;
  }, {} as Record<string, number>);

  // Load Rule-Based Guidance from Backend
  useEffect(() => {
    let active = true;
    setLoadingGuidance(true);
    fetch("http://localhost:8000/api/v1/investments/guidance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        annual_gross_income: 1200000,
        tax_regime: "new",
        risk_profile: riskProfile,
        existing_80c_deductions: 50000,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (active && data.allocations) {
          setGuidanceAllocations(data.allocations);
          setHeadroom80c(data.unused_80c_headroom || 0);
        }
      })
      .catch((err) => {
        console.warn("Could not fetch investment guidance:", err);
      })
      .finally(() => {
        if (active) setLoadingGuidance(false);
      });

    return () => {
      active = false;
    };
  }, [riskProfile]);

  const handleAddHolding = (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseFloat(qty);
    const bp = parseFloat(buyPrice);
    const cp = parseFloat(currPrice || buyPrice);

    if (!name.trim() || isNaN(q) || q <= 0 || isNaN(bp) || bp <= 0) return;

    const newH: InvestmentHolding = {
      id: `HOLD-${Date.now().toString().slice(-4)}`,
      symbol: (sym || name.slice(0, 6)).toUpperCase().trim(),
      name: name.trim(),
      assetType,
      quantity: q,
      buyPrice: bp,
      currentPrice: cp,
      purchaseDate: txDate,
    };

    const updated = [newH, ...holdings];
    setHoldings(updated);
    setSym("");
    setName("");
    setQty("");
    setBuyPrice("");
    setCurrPrice("");
    saveInvestmentHoldings(updated);
  };

  const handleDeleteHolding = (id: string) => {
    const updated = holdings.filter((h) => h.id !== id);
    setHoldings(updated);
    saveInvestmentHoldings(updated);
  };

  const handleSavePortfolio = async () => {
    setIsSaving(true);
    try {
      await saveInvestmentHoldings(holdings);
      setSaveStatus("Portfolio holdings saved ✓");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch {
      setSaveStatus("Failed to save holdings.");
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <FloatingPanel className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan-300">
              Audit V Portfolio Engine
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-400">
              Deterministic Valuation
            </span>
            {isDemoMode && (
              <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1 text-xs font-bold">
                Demo data
              </span>
            )}
          </div>
          <h1 className="mt-2 text-2xl font-black text-white md:text-3xl">
            Investment Portfolio & Asset Allocation
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Real portfolio arithmetic derived from verified user-entered holdings and purchase values.
          </p>
        </div>

        {/* Demo Mode Toggle & Save Button */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
            <span>Demo Mode:</span>
            <input
              type="checkbox"
              checked={isDemoMode}
              onChange={(e) => setIsDemoMode(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-cyan-400 focus:ring-cyan-400"
            />
          </label>
          <button
            onClick={handleSavePortfolio}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-cyan-500/20 hover:bg-cyan-400 transition"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save Portfolio"}
          </button>
        </div>
      </FloatingPanel>

      {/* Statutory Advisory Notice */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200 flex items-start gap-3">
        <Info className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
        <div className="leading-relaxed">
          <strong>Valuation & Advisory Notice:</strong> Valuations are computed from user-entered cost bases and current reference quotes. Asset allocation targets are algorithmic heuristics for educational planning and do not constitute SEBI-registered financial advice. Past performance does not guarantee future market returns.
        </div>
      </div>

      {saveStatus && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {saveStatus}
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FloatingPanel>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Total Invested Cost</p>
              <h3 className="mt-1 text-2xl font-bold text-white font-mono">
                ₹{totalInvested.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="mt-1 text-[11px] text-slate-400">{activeHoldings.length} Recorded Assets</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300">
              <Coins className="h-6 w-6" />
            </div>
          </div>
        </FloatingPanel>

        <FloatingPanel>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Current Valuation</p>
              <h3 className="mt-1 text-2xl font-bold text-cyan-300 font-mono">
                ₹{totalCurrentValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="mt-1 text-[11px] text-slate-400">Manual / Reference Quotes</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
        </FloatingPanel>

        <FloatingPanel>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Unrealized P&L (₹)</p>
              <h3 className={`mt-1 text-2xl font-bold font-mono ${totalUnrealizedPnL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {totalUnrealizedPnL >= 0 ? "+" : ""}₹{totalUnrealizedPnL.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="mt-1 text-[11px] text-slate-400">
                {totalUnrealizedPnL >= 0 ? "Net Unrealized Gain" : "Net Unrealized Drawdown"}
              </p>
            </div>
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl border ${
              totalUnrealizedPnL >= 0 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-rose-500/30 bg-rose-500/10 text-rose-400"
            }`}>
              {totalUnrealizedPnL >= 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
            </div>
          </div>
        </FloatingPanel>

        <FloatingPanel>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Portfolio Return Rate</p>
              <h3 className={`mt-1 text-2xl font-bold font-mono ${returnPercentage >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {returnPercentage >= 0 ? "+" : ""}{returnPercentage.toFixed(2)}%
              </h3>
              <p className="mt-1 text-[11px] text-slate-400">Absolute Holding Return</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300">
              <PieIcon className="h-6 w-6" />
            </div>
          </div>
        </FloatingPanel>
      </div>

      {/* Holdings Table & Add Holding Workspace */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Holdings Ledger (8 cols) */}
        <FloatingPanel className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Coins className="h-4 w-4 text-cyan-400" />
              Recorded Portfolio Holdings
            </h3>
            <span className="text-xs text-slate-400">{activeHoldings.length} Assets</span>
          </div>

          {/* Add Holding Form */}
          <form onSubmit={handleAddHolding} className="space-y-2.5 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs">
            <span className="font-bold text-slate-300">Add Holding to Portfolio</span>
            <div className="grid grid-cols-4 gap-2">
              <input
                type="text"
                placeholder="Ticker / Symbol"
                value={sym}
                onChange={(e) => setSym(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white outline-none focus:border-cyan-400"
              />
              <input
                type="text"
                placeholder="Asset Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="col-span-2 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white outline-none focus:border-cyan-400"
              />
              <select
                value={assetType}
                onChange={(e) => setAssetType(e.target.value as any)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white outline-none focus:border-cyan-400"
              >
                <option value="Equity">Equity Stocks</option>
                <option value="Mutual Fund">Mutual Fund / ETF</option>
                <option value="Debt / Fixed Income">Debt / Bonds</option>
                <option value="Gold & Bullion">Gold & Bullion</option>
                <option value="Sovereign Bonds">Govt Securities (G-Sec)</option>
                <option value="Crypto">Crypto (Discretionary)</option>
              </select>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <input
                type="number"
                step="any"
                min="0"
                placeholder="Quantity"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white outline-none focus:border-cyan-400"
              />
              <input
                type="number"
                step="any"
                min="0"
                placeholder="Buy Price (₹)"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white outline-none focus:border-cyan-400"
              />
              <input
                type="number"
                step="any"
                min="0"
                placeholder="Current Price (₹)"
                value={currPrice}
                onChange={(e) => setCurrPrice(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white outline-none focus:border-cyan-400"
              />
              <input
                type="date"
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white outline-none focus:border-cyan-400"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-cyan-500 py-1.5 text-xs font-bold text-white hover:bg-cyan-400 transition"
            >
              Add Holding
            </button>
          </form>

          {/* Holdings Table */}
          {activeHoldings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-400">
              No investment holdings recorded. Add your stocks, mutual funds, or gold above, or enable Demo Mode.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-slate-800 bg-slate-800/40 font-bold uppercase text-slate-400">
                  <tr>
                    <th className="py-2.5 px-3">Asset</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right">Avg Cost</th>
                    <th className="py-2.5 px-3 text-right">Current</th>
                    <th className="py-2.5 px-3 text-right">Cur. Value</th>
                    <th className="py-2.5 px-3 text-right">P&L</th>
                    {!isDemoMode && <th className="py-2.5 px-3 text-center">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {activeHoldings.map((h) => {
                    const cost = h.quantity * h.buyPrice;
                    const val = h.quantity * h.currentPrice;
                    const pnl = val - cost;
                    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;

                    return (
                      <tr key={h.id} className="hover:bg-slate-800/20 transition">
                        <td className="py-2.5 px-3">
                          <strong className="text-white block">{h.symbol}</strong>
                          <span className="text-[10px] text-slate-400">{h.name}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                            {h.assetType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">{h.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-mono">₹{h.buyPrice.toLocaleString("en-IN")}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-cyan-300">₹{h.currentPrice.toLocaleString("en-IN")}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                          ₹{val.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-mono font-bold ${
                          pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}>
                          {pnl >= 0 ? "+" : ""}₹{pnl.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                          <span className="block text-[10px]">({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%)</span>
                        </td>
                        {!isDemoMode && (
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => handleDeleteHolding(h.id)}
                              className="text-slate-500 hover:text-rose-400 transition"
                            >
                              <Trash2 className="h-3.5 w-3.5 mx-auto" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </FloatingPanel>

        {/* Right Column: Allocation & Rule-Based Guidance (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Real Asset Allocation from User Holdings */}
          <FloatingPanel className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PieIcon className="h-4 w-4 text-cyan-400" />
                Actual Portfolio Allocation
              </h3>
            </div>

            {totalCurrentValue === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No holdings to calculate allocation.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(classBreakdown).map(([cls, amt]) => {
                  const pct = totalCurrentValue > 0 ? (amt / totalCurrentValue) * 100 : 0;
                  return (
                    <div key={cls} className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-300">
                        <span>{cls}</span>
                        <strong className="font-mono text-white">
                          {pct.toFixed(1)}% (₹{amt.toLocaleString("en-IN", { maximumFractionDigits: 0 })})
                        </strong>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-400 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </FloatingPanel>

          {/* Rule-Based Advisory Model Guidance */}
          <FloatingPanel className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  Target Heuristic Guidance
                </h3>
                <span className="text-[10px] text-slate-400">Rule-based model via backend</span>
              </div>
              {loadingGuidance && <RefreshCw className="h-3.5 w-3.5 animate-spin text-cyan-400" />}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Risk Profile Strategy</label>
              <select
                value={riskProfile}
                onChange={(e) => setRiskProfile(e.target.value as any)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
              >
                <option value="conservative">Conservative (Capital Preservation & Debt)</option>
                <option value="moderate">Moderate (Balanced 50/50 Growth & Stability)</option>
                <option value="aggressive">Aggressive (High Equity & Long-Term Compounding)</option>
              </select>
            </div>

            <div className="space-y-2.5 text-xs">
              {guidanceAllocations.map((g) => (
                <div key={g.asset_class} className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white">{g.asset_class}</span>
                    <span className="font-mono text-cyan-300 font-bold">{g.percentage}%</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">{g.description}</p>
                </div>
              ))}
            </div>

            {headroom80c > 0 && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-[11px] text-emerald-300">
                <strong>Tax Optimization:</strong> You have ₹{headroom80c.toLocaleString("en-IN")} unused Section 80C headroom eligible for tax-saving ELSS / PPF instruments under the Old Regime.
              </div>
            )}
          </FloatingPanel>
        </div>
      </div>
    </div>
  );
}
