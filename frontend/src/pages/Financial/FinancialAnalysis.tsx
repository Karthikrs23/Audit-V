import { useState, useEffect } from "react";
import FloatingPanel from "../../components/layout/FloatingPanel";
import {
  TrendingUp,
  DollarSign,
  PieChart as PieIcon,
  BarChart3,
  ArrowUpRight,
  Sparkles,
  Layers,
  Shield,
  Briefcase,
  Lock,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface AssetAllocationItem {
  asset_class: string;
  percentage: number;
  suggested_monthly_amount: number;
  description: string;
}

interface TaxSavingInstrumentInfo {
  name: string;
  section: string;
  lock_in_period: string;
  tax_treatment: string;
  risk_level: string;
  expected_returns_range: string;
  key_benefits: string[];
}

interface InvestmentGuidanceResponse {
  risk_profile: string;
  annual_gross_income: number;
  estimated_annual_tax: number;
  estimated_post_tax_surplus: number;
  suggested_monthly_investable_surplus: number;
  unused_80c_headroom: number;
  nps_80ccd1b_headroom: number;
  allocations: AssetAllocationItem[];
  eligible_tax_saving_instruments: TaxSavingInstrumentInfo[];
  disclaimer: string;
}

const MONTHLY_REVENUE_EXPENSE = [
  { month: "Mar", revenue: 4200000, expense: 2800000, profit: 1400000 },
  { month: "Apr", revenue: 4800000, expense: 3100000, profit: 1700000 },
  { month: "May", revenue: 5100000, expense: 3300000, profit: 1800000 },
  { month: "Jun", revenue: 4900000, expense: 2950000, profit: 1950000 },
  { month: "Jul", revenue: 5600000, expense: 3400000, profit: 2200000 },
  { month: "Aug", revenue: 6200000, expense: 3700000, profit: 2500000 },
];

const EXPENSE_BREAKDOWN = [
  { name: "Payroll & Salaries", value: 45, color: "#38bdf8" },
  { name: "Vendor Contracts", value: 25, color: "#818cf8" },
  { name: "IT Infrastructure & Cloud", value: 15, color: "#c084fc" },
  { name: "Office & Facilities", value: 10, color: "#f472b6" },
  { name: "Miscellaneous", value: 5, color: "#fb7185" },
];

const ALLOCATION_COLORS = ["#38bdf8", "#818cf8", "#fbbf24", "#34d399"];

export default function FinancialAnalysis() {
  const [selectedTimeframe, setSelectedTimeframe] = useState("H1 2026");

  // Investment Guidance State
  const [income, setIncome] = useState<number>(1200000);
  const [riskProfile, setRiskProfile] = useState<string>("moderate");
  const [regime, setRegime] = useState<string>("new");
  const [existing80c, setExisting80c] = useState<number>(50000);

  const [guidance, setGuidance] = useState<InvestmentGuidanceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGuidance = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("http://localhost:8000/api/v1/investments/guidance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          annual_income: income,
          risk_profile: riskProfile,
          regime: regime,
          existing_80c_deductions: existing80c,
        }),
      });

      if (!res.ok) {
        throw new Error(`Investment guidance API returned status ${res.status}`);
      }

      const data = await res.json();
      setGuidance(data);
    } catch (err: any) {
      console.error("Error fetching investment guidance:", err);
      setError("Failed to fetch investment guidance. Ensure backend API is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuidance();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <FloatingPanel className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan-300">
              Audit V Advisory
            </span>
            <span className="flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              Rule-Based Asset Allocation Engine
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black text-white md:text-3xl">
            Financial Analysis & Wealth Advisory
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Automated asset allocation heuristics, Section 80C tax headroom analysis, and cash flow intelligence.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {["Q1 2026", "Q2 2026", "H1 2026"].map((tf) => (
            <button
              key={tf}
              onClick={() => setSelectedTimeframe(tf)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                selectedTimeframe === tf
                  ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/30"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </FloatingPanel>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FloatingPanel>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Total H1 Revenue</p>
              <h3 className="mt-1 text-2xl font-bold text-white">₹3,08,00,000</h3>
              <p className="mt-1 text-xs text-emerald-400 flex items-center gap-1 font-medium">
                <ArrowUpRight className="h-3.5 w-3.5" /> +14.2% YoY growth
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
        </FloatingPanel>

        <FloatingPanel>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Net Operating Profit</p>
              <h3 className="mt-1 text-2xl font-bold text-emerald-400">₹1,15,50,000</h3>
              <p className="mt-1 text-xs text-emerald-300">37.5% Operating Margin</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
        </FloatingPanel>

        <FloatingPanel>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Current Liquidity Ratio</p>
              <h3 className="mt-1 text-2xl font-bold text-cyan-300">2.45x</h3>
              <p className="mt-1 text-xs text-cyan-200">Strong working capital position</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
              <Layers className="h-6 w-6" />
            </div>
          </div>
        </FloatingPanel>

        <FloatingPanel>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">EBITDA Margin</p>
              <h3 className="mt-1 text-2xl font-bold text-violet-400">41.8%</h3>
              <p className="mt-1 text-xs text-violet-300">+2.3% improvement from Q1</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-400/10 text-violet-300">
              <BarChart3 className="h-6 w-6" />
            </div>
          </div>
        </FloatingPanel>
      </div>

      {/* Rule-Based Investment Advisory Workspace */}
      <FloatingPanel className="space-y-6 border-cyan-400/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-cyan-400" />
              <h2 className="text-xl font-bold text-white">Rule-Based Asset Allocation Engine</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Select your risk tolerance and financial inputs to calculate suggested asset class weightings and tax-saving headroom.
            </p>
          </div>
          <span className="text-xs font-bold text-cyan-300 bg-cyan-400/10 border border-cyan-400/30 px-3 py-1 rounded-full shrink-0">
            DETERMINISTIC HEURISTIC MODEL
          </span>
        </div>

        {/* Input Parameters Form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl border border-white/10 bg-black/30">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
              Annual Income (₹)
            </label>
            <input
              type="number"
              value={income}
              onChange={(e) => setIncome(Number(e.target.value))}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs font-bold text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
              Risk Profile
            </label>
            <select
              value={riskProfile}
              onChange={(e) => setRiskProfile(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs font-bold text-white focus:border-cyan-400 focus:outline-none capitalize"
            >
              <option value="conservative">Conservative (Capital Safety)</option>
              <option value="moderate">Moderate (Balanced Growth)</option>
              <option value="aggressive">Aggressive (Maximum Equity)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
              Declared Sec 80C (₹)
            </label>
            <input
              type="number"
              value={existing80c}
              onChange={(e) => setExisting80c(Number(e.target.value))}
              max={150000}
              min={0}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs font-bold text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
              Tax Regime
            </label>
            <select
              value={regime}
              onChange={(e) => setRegime(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs font-bold text-white focus:border-cyan-400 focus:outline-none"
            >
              <option value="new">New Tax Regime (Sec 115BAC)</option>
              <option value="old">Old Tax Regime</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={fetchGuidance}
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition"
          >
            {loading ? "Calculating Guidance..." : "Re-Calculate Asset Allocation"}
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Results Workspace */}
        {guidance && (
          <div className="space-y-6 pt-2">
            {/* Key Headroom & Surplus Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10">
                <p className="text-[11px] font-semibold text-emerald-300 uppercase">Unused Section 80C Headroom</p>
                <h4 className="text-2xl font-extrabold text-white mt-1">₹{guidance.unused_80c_headroom.toLocaleString("en-IN")}</h4>
                <p className="text-[11px] text-slate-300 mt-1">Capped at ₹1,50,000 max deduction limit</p>
              </div>

              <div className="p-4 rounded-xl border border-cyan-400/30 bg-cyan-400/10">
                <p className="text-[11px] font-semibold text-cyan-300 uppercase">NPS Sec 80CCD(1B) Headroom</p>
                <h4 className="text-2xl font-extrabold text-white mt-1">₹{guidance.nps_80ccd1b_headroom.toLocaleString("en-IN")}</h4>
                <p className="text-[11px] text-slate-300 mt-1">Exclusive additional pension tax deduction</p>
              </div>

              <div className="p-4 rounded-xl border border-violet-400/30 bg-violet-400/10">
                <p className="text-[11px] font-semibold text-violet-300 uppercase">Suggested Monthly Surplus</p>
                <h4 className="text-2xl font-extrabold text-white mt-1">₹{guidance.suggested_monthly_investable_surplus.toLocaleString("en-IN")}</h4>
                <p className="text-[11px] text-slate-300 mt-1">Based on estimated post-tax savings rate</p>
              </div>
            </div>

            {/* Asset Allocation Percentage Breakdown */}
            <div className="space-y-4 pt-2">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PieIcon className="h-4 w-4 text-cyan-400" />
                Suggested Asset Class Weightings ({guidance.risk_profile.toUpperCase()} Profile - Total 100%)
              </h3>

              <div className="space-y-3">
                {guidance.allocations.map((item, idx) => (
                  <div key={item.asset_class} className="p-3.5 rounded-xl border border-white/5 bg-black/30 space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-white flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: ALLOCATION_COLORS[idx % ALLOCATION_COLORS.length] }}
                        />
                        {item.asset_class}
                      </span>
                      <span className="text-cyan-300 font-extrabold text-sm">{item.percentage}% (₹{item.suggested_monthly_amount.toLocaleString("en-IN")}/mo)</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${item.percentage}%`,
                          backgroundColor: ALLOCATION_COLORS[idx % ALLOCATION_COLORS.length],
                        }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Eligible Tax-Saving Instruments Table */}
            <div className="space-y-4 pt-2">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-400" />
                Eligible Tax-Saving Instrument Types (Section 80C & 80CCD)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {guidance.eligible_tax_saving_instruments.map((inst) => (
                  <div key={inst.name} className="p-4 rounded-xl border border-white/10 bg-slate-900/60 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white">{inst.name}</h4>
                        <span className="text-[10px] font-bold text-cyan-300 bg-cyan-400/10 px-2 py-0.5 rounded border border-cyan-400/20">
                          {inst.section}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-emerald-400">{inst.expected_returns_range}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] border-y border-white/5 py-2 text-slate-300">
                      <div>
                        <span className="text-slate-400 block font-semibold">Lock-In Period:</span>
                        <span className="font-bold text-amber-300 flex items-center gap-1 mt-0.5">
                          <Lock className="h-3 w-3" /> {inst.lock_in_period}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-semibold">Risk Level:</span>
                        <span className="font-bold text-slate-200 mt-0.5 block">{inst.risk_level}</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-300">
                      <strong className="text-slate-400 font-semibold">Tax Treatment: </strong>
                      {inst.tax_treatment}
                    </p>

                    <div className="space-y-1">
                      {inst.key_benefits.map((benefit, i) => (
                        <p key={i} className="text-[11px] text-slate-400 flex items-center gap-1.5">
                          <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                          {benefit}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Statutory Advisory Disclaimer */}
            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong className="font-bold text-amber-200">Statutory Advisor Disclaimer: </strong>
                {guidance.disclaimer}
              </span>
            </div>
          </div>
        )}
      </FloatingPanel>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Revenue vs Expense Bar Chart */}
        <FloatingPanel className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-cyan-400" />
              Monthly Revenue vs Expense Comparison (₹)
            </h3>
            <span className="text-xs text-slate-400">Audit V Ledger Synced</span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MONTHLY_REVENUE_EXPENSE} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} tickFormatter={(v) => `₹${v / 100000}L`} />
                <Tooltip
                  formatter={(value: any) => [`₹${Number(value).toLocaleString("en-IN")}`, ""]}
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                    borderColor: "rgba(56, 189, 248, 0.2)",
                    borderRadius: "0.75rem",
                    color: "#fff",
                  }}
                />
                <Bar dataKey="revenue" name="Revenue" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="#fb7185" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </FloatingPanel>

        {/* Expense Category Pie Chart */}
        <FloatingPanel className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-cyan-400" />
              Expense Distribution
            </h3>
            <span className="text-xs text-slate-400">Percentage</span>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={EXPENSE_BREAKDOWN}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {EXPENSE_BREAKDOWN.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => [`${value}%`, "Share"]}
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                    borderColor: "rgba(56, 189, 248, 0.2)",
                    borderRadius: "0.75rem",
                    color: "#fff",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 border-t border-slate-800 pt-3 text-xs">
            {EXPENSE_BREAKDOWN.map((item) => (
              <div key={item.name} className="flex justify-between items-center text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="truncate max-w-[140px]">{item.name}</span>
                </div>
                <strong className="text-white">{item.value}%</strong>
              </div>
            ))}
          </div>
        </FloatingPanel>
      </div>
    </div>
  );
}
