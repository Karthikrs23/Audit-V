import { useState } from "react";
import FloatingPanel from "../../components/layout/FloatingPanel";
import { Landmark, Calculator } from "lucide-react";

export default function Banking() {
  const [principal, setPrincipal] = useState<number>(100000);
  const [rate, setRate] = useState<number>(7.2);
  const [tenure, setTenure] = useState<number>(3); // years

  const interest = Math.round((principal * rate * tenure) / 100);
  const maturity = principal + interest;

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* FD & Savings Calculator Workspace */}
      <FloatingPanel className="lg:col-span-2 space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
              Banking Tools
            </p>
            <h2 className="text-xl font-bold text-white mt-1">
              Fixed Deposit & Savings Growth Calculator
            </h2>
          </div>
          <div className="p-2.5 rounded-xl border border-white/10 bg-white/5 text-cyan-400">
            <Calculator className="h-5 w-5" />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">Deposit Amount (₹)</label>
            <input
              type="number"
              value={principal}
              onChange={(e) => setPrincipal(Number(e.target.value))}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white focus:border-cyan-400 outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">Interest Rate (% p.a.)</label>
            <input
              type="number"
              step="0.1"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white focus:border-cyan-400 outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">Tenure (Years)</label>
            <input
              type="number"
              value={tenure}
              onChange={(e) => setTenure(Number(e.target.value))}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white focus:border-cyan-400 outline-none"
            />
          </div>
        </div>

        {/* Output Summary */}
        <div className="grid sm:grid-cols-3 gap-4 pt-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
            <p className="text-xs text-slate-400">Principal Invested</p>
            <p className="mt-1 text-xl font-bold text-white">₹{principal.toLocaleString()}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
            <p className="text-xs text-slate-400">Estimated Interest</p>
            <p className="mt-1 text-xl font-bold text-emerald-400">₹{interest.toLocaleString()}</p>
          </div>

          <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-4 text-center">
            <p className="text-xs text-cyan-300 font-semibold">Total Maturity Value</p>
            <p className="mt-1 text-xl font-extrabold text-white">₹{maturity.toLocaleString()}</p>
          </div>
        </div>
      </FloatingPanel>

      {/* Live Bank Rates Table */}
      <FloatingPanel className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Top Bank Interest Rates</h3>
            <p className="text-xs text-slate-400">1 to 3 Year Tenure</p>
          </div>
        </div>

        <div className="space-y-3">
          {[
            { bank: "HDFC Bank", fd: "7.25%", savings: "3.50%" },
            { bank: "ICICI Bank", fd: "7.20%", savings: "3.50%" },
            { bank: "State Bank of India", fd: "6.80%", savings: "2.70%" },
            { bank: "Axis Bank", fd: "7.25%", savings: "3.50%" },
          ].map((b) => (
            <div
              key={b.bank}
              className="flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-black/30 text-xs"
            >
              <div>
                <p className="font-bold text-white">{b.bank}</p>
                <p className="text-slate-400">Savings: {b.savings}</p>
              </div>
              <div className="text-right">
                <p className="font-extrabold text-cyan-300 text-sm">{b.fd}</p>
                <p className="text-[10px] text-slate-400">FD Rate</p>
              </div>
            </div>
          ))}
        </div>
      </FloatingPanel>
    </div>
  );
}
