import FloatingPanel from "../../components/layout/FloatingPanel";
import { PieChart, ShieldCheck } from "lucide-react";

export default function Investment() {
  const assets = [
    { type: "Equity Stocks", val: "₹9.2L", pct: "50%", returnPct: "+14.2%", color: "#00e5ff" },
    { type: "Mutual Funds", val: "₹5.1L", pct: "28%", returnPct: "+11.8%", color: "#8b5cf6" },
    { type: "Gold & Bullion", val: "₹2.3L", pct: "12%", returnPct: "+8.4%", color: "#f59e0b" },
    { type: "Crypto & Web3", val: "₹1.8L", pct: "10%", returnPct: "+22.5%", color: "#34d399" },
  ];

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Asset Allocation Breakdown */}
      <FloatingPanel className="lg:col-span-2 space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
              Portfolio Overview
            </p>
            <h2 className="text-xl font-bold text-white mt-1">
              Multi-Asset Allocation & Performance
            </h2>
          </div>
          <div className="p-2.5 rounded-xl border border-white/10 bg-white/5 text-cyan-400">
            <PieChart className="h-5 w-5" />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {assets.map((a) => (
            <div
              key={a.type}
              className="p-5 rounded-2xl border border-white/10 bg-black/40 space-y-3"
            >
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-white">{a.type}</span>
                <span className="px-2 py-0.5 rounded-full bg-cyan-400/10 text-cyan-300 font-bold border border-cyan-400/20">
                  {a.pct}
                </span>
              </div>

              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-extrabold text-white">{a.val}</span>
                <span className="text-emerald-400 font-bold text-xs">{a.returnPct}</span>
              </div>

              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: a.pct, backgroundColor: a.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </FloatingPanel>

      {/* Risk Profile & Suggestions */}
      <FloatingPanel className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Risk Profile</h3>
            <p className="text-xs text-slate-400">Moderate Growth Strategy</p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-white/5 bg-black/30 space-y-3 text-xs">
          <div className="flex justify-between text-slate-300">
            <span>Risk Tolerance</span>
            <span className="font-bold text-cyan-300">68 / 100</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Diversification Score</span>
            <span className="font-bold text-emerald-400">Optimal (89%)</span>
          </div>
        </div>

        <div className="pt-2 space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Suggestions</h4>
          <p className="text-xs text-slate-300 leading-relaxed p-3 rounded-xl border border-cyan-400/20 bg-cyan-400/10">
            Rebalance 5% from Crypto into S&P 500 Index Funds to reduce high-volatility tail risk before the quarter end.
          </p>
        </div>
      </FloatingPanel>
    </div>
  );
}
