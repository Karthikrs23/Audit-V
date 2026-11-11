import { useState, useEffect } from "react";
import FloatingPanel from "../../components/layout/FloatingPanel";
import {
  PieChart as PieIcon,
  BarChart3,
  Save,
  CheckCircle2,
  Building2,
  User,
} from "lucide-react";
import {
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  fetchBankingRecords,
  fetchFinancialAnalysisData,
  saveFinancialAnalysisData,
  type PersonalBudgetCategory,
} from "../../services/financialApi";

const DEFAULT_PERSONAL_CATEGORIES: PersonalBudgetCategory[] = [
  { category: "Housing & Rent", budgeted: 35000, actual: 35000 },
  { category: "Food & Groceries", budgeted: 15000, actual: 12400 },
  { category: "Utilities & Bills", budgeted: 6000, actual: 4800 },
  { category: "Healthcare & Meds", budgeted: 5000, actual: 2100 },
  { category: "Transport & Fuel", budgeted: 8000, actual: 6500 },
  { category: "Discretionary & Leisure", budgeted: 10000, actual: 8200 },
];

const PIE_COLORS = ["#38bdf8", "#818cf8", "#c084fc", "#f472b6", "#fbbf24", "#34d399"];

export default function FinancialAnalysis() {
  const [activeMode, setActiveMode] = useState<"personal" | "business">("personal");

  // Personal Finance State
  const [monthlyIncome, setMonthlyIncome] = useState<number>(125000);
  const [categories, setCategories] = useState<PersonalBudgetCategory[]>(DEFAULT_PERSONAL_CATEGORIES);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Business Mode State (Optional separate view)
  const [bizTurnover, setBizTurnover] = useState<number>(500000);
  const [bizOperatingCost, setBizOperatingCost] = useState<number>(320000);

  // Load saved analysis data or derive from banking records
  useEffect(() => {
    let active = true;
    async function loadData() {
      const saved = await fetchFinancialAnalysisData();
      if (active && saved.monthlyIncome > 0) {
        setMonthlyIncome(saved.monthlyIncome);
        if (saved.categories.length > 0) {
          setCategories(saved.categories);
        }
        return;
      }

      // Fallback: check if banking records exist to pre-fill
      const bank = await fetchBankingRecords();
      if (active && bank.transactions.length > 0) {
        const inc = bank.transactions
          .filter((t) => t.type === "income")
          .reduce((s, t) => s + t.amount, 0);
        if (inc > 0) setMonthlyIncome(inc);
      }
    }
    loadData();
    return () => {
      active = false;
    };
  }, []);

  // Real Calculated Metrics
  const totalActualExpense = categories.reduce((sum, c) => sum + c.actual, 0);
  const totalBudgetedExpense = categories.reduce((sum, c) => sum + c.budgeted, 0);
  const monthlySavings = Math.max(0, monthlyIncome - totalActualExpense);
  const savingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;
  const budgetVariance = totalBudgetedExpense - totalActualExpense; // Positive = Under budget (Good)

  // Pie chart dataset
  const pieData = categories.map((c, i) => ({
    name: c.category,
    value: c.actual,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }));

  const handleCategoryChange = (index: number, field: "budgeted" | "actual", val: number) => {
    const updated = [...categories];
    updated[index][field] = val;
    setCategories(updated);
  };

  const handleSaveAnalysis = async () => {
    setIsSaving(true);
    try {
      await saveFinancialAnalysisData({
        monthlyIncome,
        monthlyExpense: totalActualExpense,
        categories,
      });
      setSaveStatus("Financial budget & analysis saved ✓");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch {
      setSaveStatus("Failed to save data.");
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
              Personal Wealth Analytics
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-400">
              Input-Driven Models
            </span>
            <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1 text-xs font-bold">
              Demo data
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black text-white md:text-3xl">
            Financial Analysis & Budget Tracking
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Real personal financial ratios, expense allocation breakdowns, savings rates, and budget variance.
          </p>
        </div>

        {/* View Mode Toggle & Save Button */}
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl border border-slate-800 bg-slate-900 p-1">
            <button
              onClick={() => setActiveMode("personal")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeMode === "personal" ? "bg-cyan-500 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              <User className="h-3.5 w-3.5" />
              Personal
            </button>
            <button
              onClick={() => setActiveMode("business")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeMode === "business" ? "bg-cyan-500 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              Business
            </button>
          </div>

          <button
            onClick={handleSaveAnalysis}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-cyan-500/20 hover:bg-cyan-400 transition"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save Analysis"}
          </button>
        </div>
      </FloatingPanel>

      {saveStatus && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {saveStatus}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* PERSONAL FINANCES VIEW (PRIMARY DEFAULT)                            */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeMode === "personal" && (
        <div className="space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FloatingPanel>
              <p className="text-xs font-semibold uppercase text-slate-400">Monthly Net Income</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white font-mono">
                  ₹{monthlyIncome.toLocaleString("en-IN")}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-cyan-300">Take-home salary / Earnings</p>
            </FloatingPanel>

            <FloatingPanel>
              <p className="text-xs font-semibold uppercase text-slate-400">Total Monthly Expenses</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-rose-400 font-mono">
                  ₹{totalActualExpense.toLocaleString("en-IN")}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Sum of itemized categories</p>
            </FloatingPanel>

            <FloatingPanel>
              <p className="text-xs font-semibold uppercase text-slate-400">Monthly Savings Surplus</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-400 font-mono">
                  ₹{monthlySavings.toLocaleString("en-IN")}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-emerald-300">Available for investment & debt</p>
            </FloatingPanel>

            <FloatingPanel>
              <p className="text-xs font-semibold uppercase text-slate-400">Savings Rate</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-cyan-300 font-mono">
                  {savingsRate.toFixed(1)}%
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                {savingsRate >= 30 ? "Optimal (>30% of income)" : "Moderate (<30% of income)"}
              </p>
            </FloatingPanel>
          </div>

          {/* Income Input Bar */}
          <FloatingPanel className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Your Monthly Inflow / Take-Home Income (₹)
              </label>
              <p className="text-xs text-slate-400">
                Update this value to instantly recalculate your savings rate and investment capacity.
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-cyan-400">₹</span>
              <input
                type="number"
                min="0"
                step="1000"
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2 pl-8 pr-3 text-sm font-bold text-white outline-none focus:border-cyan-400"
              />
            </div>
          </FloatingPanel>

          {/* Spending Allocation & Budget Variance Breakdown */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Category Budget Editor Table (7 cols) */}
            <FloatingPanel className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-cyan-400" />
                  Monthly Spending Categories & Budget Variance
                </h3>
                <span className={`text-xs font-bold ${budgetVariance >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {budgetVariance >= 0 ? `Under Budget (+₹${budgetVariance.toLocaleString("en-IN")})` : `Over Budget (-₹${Math.abs(budgetVariance).toLocaleString("en-IN")})`}
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="border-b border-slate-800 bg-slate-800/40 font-bold uppercase text-slate-400">
                    <tr>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">Budget (₹)</th>
                      <th className="py-2.5 px-3 text-right">Actual Spent (₹)</th>
                      <th className="py-2.5 px-3 text-right">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {categories.map((c, i) => {
                      const diff = c.budgeted - c.actual;
                      return (
                        <tr key={c.category} className="hover:bg-slate-800/20 transition">
                          <td className="py-2.5 px-3 font-semibold text-white">{c.category}</td>
                          <td className="py-2.5 px-3 text-right">
                            <input
                              type="number"
                              value={c.budgeted}
                              onChange={(e) => handleCategoryChange(i, "budgeted", Number(e.target.value))}
                              className="w-24 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-right text-xs font-mono text-white outline-none focus:border-cyan-400"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <input
                              type="number"
                              value={c.actual}
                              onChange={(e) => handleCategoryChange(i, "actual", Number(e.target.value))}
                              className="w-24 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-right text-xs font-mono text-cyan-300 outline-none focus:border-cyan-400"
                            />
                          </td>
                          <td className={`py-2.5 px-3 text-right font-mono font-bold ${diff >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {diff >= 0 ? "+" : ""}₹{diff.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </FloatingPanel>

            {/* Visual Expense Breakdown Chart (5 cols) */}
            <FloatingPanel className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <PieIcon className="h-4 w-4 text-cyan-400" />
                  Expense Distribution
                </h3>
              </div>

              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [`₹${Number(val).toLocaleString("en-IN")}`, "Actual Spent"]}
                      contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", fontSize: "11px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                {pieData.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-slate-300 truncate">{d.name}</span>
                  </div>
                ))}
              </div>
            </FloatingPanel>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* BUSINESS / PROPRIETORSHIP MODE (ISOLATED)                           */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeMode === "business" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-xs text-cyan-200 space-y-1">
            <strong>Business Accounting Mode:</strong> This view is designed for proprietorships, consulting practices, or small firms tracking commercial revenue versus operational expenditure.
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FloatingPanel>
              <span className="text-xs text-slate-400 uppercase font-semibold">Monthly Commercial Turnover</span>
              <div className="mt-2">
                <input
                  type="number"
                  value={bizTurnover}
                  onChange={(e) => setBizTurnover(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-lg font-bold text-white outline-none focus:border-cyan-400 font-mono"
                />
              </div>
            </FloatingPanel>

            <FloatingPanel>
              <span className="text-xs text-slate-400 uppercase font-semibold">Monthly Operating Costs (OPEX)</span>
              <div className="mt-2">
                <input
                  type="number"
                  value={bizOperatingCost}
                  onChange={(e) => setBizOperatingCost(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-lg font-bold text-rose-400 outline-none focus:border-cyan-400 font-mono"
                />
              </div>
            </FloatingPanel>

            <FloatingPanel>
              <span className="text-xs text-slate-400 uppercase font-semibold">Operating Margin / Net Profit</span>
              <p className="mt-3 text-2xl font-black font-mono text-emerald-400">
                ₹{(bizTurnover - bizOperatingCost).toLocaleString("en-IN")}
              </p>
              <span className="text-[11px] text-slate-400">
                Margin: {bizTurnover > 0 ? (((bizTurnover - bizOperatingCost) / bizTurnover) * 100).toFixed(1) : 0}%
              </span>
            </FloatingPanel>
          </div>
        </div>
      )}
    </div>
  );
}
