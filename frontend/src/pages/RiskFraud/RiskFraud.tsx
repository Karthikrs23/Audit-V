import React, { useEffect, useState } from "react";
import FloatingPanel from "../../components/layout/FloatingPanel";
import {
  AlertTriangle,
  CheckCircle2,
  Search,
  ShieldCheck,
  Info,
  Sliders,
  Building2,
} from "lucide-react";

interface AnalyzedTransaction {
  transaction_id: string;
  date: string;
  time: string;
  amount: number;
  category: string;
  merchant: string;
  payment_method: string;
  anomaly_score: number;
  is_anomaly: boolean;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reasons: string[];
  primary_reason: string;
  contributing_features?: string[];
  is_known_anomaly?: boolean;
  anomaly_type?: string;
}

interface RiskSummary {
  low: number;
  medium: number;
  high: number;
  critical: number;
}

interface RiskAnalysisResponse {
  total_transactions: number;
  anomalies_detected: number;
  risk_summary: RiskSummary;
  summary_explanation: string;
  transactions: AnalyzedTransaction[];
  model_metadata: {
    algorithm: string;
    contamination: number;
    n_estimators: number;
    dataset_size: number;
  };
  disclaimer: string;
}

interface TaxpayerRiskResult {
  taxpayer_id: string;
  predicted_risk_level: string;
  risk_probabilities: Record<string, number>;
  risk_flags: string[];
  taxpayer_summary: string;
}

const RISK_COLORS = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#10b981",
};

export default function RiskFraud() {
  const [activeView, setActiveView] = useState<"isolation_forest" | "taxpayer_classifier">("isolation_forest");

  // Isolation Forest State
  const [data, setData] = useState<RiskAnalysisResponse | null>(null);

  // Filters & Search
  const [activeTab, setActiveTab] = useState<"ALL" | "ANOMALIES" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW">("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Custom Transaction Anomaly Tester Form
  const [testAmount, setTestAmount] = useState<string>("85000");
  const [testMerchant, setTestMerchant] = useState<string>("Crypto Exchange Global");
  const [testCategory, setTestCategory] = useState<string>("Investment");
  const [testMethod, setTestMethod] = useState<string>("Wire Transfer");
  const [testTime, setTestTime] = useState<string>("03:45");
  const [customTestResult, setCustomTestResult] = useState<AnalyzedTransaction | null>(null);
  const [testingCustom, setTestingCustom] = useState<boolean>(false);

  // Supervised Taxpayer Risk State
  const [tpRevenue, setTpRevenue] = useState<number>(4500000);
  const [tpExpenses, setTpExpenses] = useState<number>(3800000);
  const [tpLiability, setTpLiability] = useState<number>(210000);
  const [tpPaid, setTpPaid] = useState<number>(180000);
  const [tpLateFilings, setTpLateFilings] = useState<number>(2);
  const [tpViolations, setTpViolations] = useState<number>(1);
  const [tpAuditFindings, setTpAuditFindings] = useState<number>(1);
  const [tpIndustry, setTpIndustry] = useState<string>("Tech");
  const [tpResult, setTpResult] = useState<TaxpayerRiskResult | null>(null);
  const [tpLoading, setTpLoading] = useState<boolean>(false);
  const [tpError, setTpError] = useState<string | null>(null);

  const fetchRiskAnalysis = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/v1/risk/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const resData: RiskAnalysisResponse = await response.json();
      setData(resData);
    } catch (err: any) {
      console.warn("Failed to fetch risk analysis:", err);
    }
  };

  useEffect(() => {
    fetchRiskAnalysis();
  }, []);

  const handleRunCustomTest = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(testAmount);
    if (isNaN(amt) || amt <= 0) return;
    setTestingCustom(true);

    try {
      const singleTx = {
        transaction_id: `LIVE-TEST-${Date.now().toString().slice(-4)}`,
        date: new Date().toISOString().split("T")[0],
        time: testTime,
        amount: amt,
        transaction_type: "debit",
        category: testCategory,
        merchant: testMerchant,
        account_type: "checking",
        location: "India",
        payment_method: testMethod,
      };

      const res = await fetch("http://localhost:8000/api/v1/risk/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: [singleTx] }),
      });

      if (!res.ok) throw new Error("Custom test failed");
      const respData: RiskAnalysisResponse = await res.json();
      if (respData.transactions && respData.transactions.length > 0) {
        setCustomTestResult(respData.transactions[0]);
      }
    } catch {
      alert("Failed to score custom transaction. Check backend connection.");
    } finally {
      setTestingCustom(false);
    }
  };

  const handlePredictTaxpayer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTpLoading(true);
    setTpError(null);
    try {
      const res = await fetch("http://localhost:8000/api/v1/risk/taxpayer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taxpayer_id: "TAX-LIVE",
          revenue: tpRevenue,
          expenses: tpExpenses,
          tax_liability: tpLiability,
          tax_paid: tpPaid,
          late_filings: tpLateFilings,
          compliance_violations: tpViolations,
          industry: tpIndustry,
          audit_findings: tpAuditFindings,
        }),
      });

      if (!res.ok) throw new Error("Failed to evaluate taxpayer risk");
      const data: TaxpayerRiskResult = await res.json();
      setTpResult(data);
    } catch (err: any) {
      setTpError(err.message || "Taxpayer evaluation error");
    } finally {
      setTpLoading(false);
    }
  };

  const filteredTransactions = (data?.transactions || [])
    .filter((tx) => {
      if (activeTab === "ANOMALIES" && !tx.is_anomaly) return false;
      if (activeTab === "CRITICAL" && tx.risk_level !== "CRITICAL") return false;
      if (activeTab === "HIGH" && tx.risk_level !== "HIGH") return false;
      if (activeTab === "MEDIUM" && tx.risk_level !== "MEDIUM") return false;
      if (activeTab === "LOW" && tx.risk_level !== "LOW") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          tx.transaction_id.toLowerCase().includes(q) ||
          tx.merchant.toLowerCase().includes(q) ||
          tx.category.toLowerCase().includes(q) ||
          tx.amount.toString().includes(q) ||
          tx.primary_reason.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => b.anomaly_score - a.anomaly_score);

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <FloatingPanel className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan-300">
              Audit V Risk & Anomaly Intelligence
            </span>
            <span className="flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Models Active (Isolation Forest & Random Forest)
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black text-white md:text-3xl">
            Financial Anomaly Detection & Compliance Risk
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Unsupervised pattern outlier detection and supervised taxpayer compliance risk classification.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex rounded-xl border border-slate-700 bg-slate-900 p-1">
          <button
            onClick={() => setActiveView("isolation_forest")}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
              activeView === "isolation_forest" ? "bg-cyan-500 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Isolation Forest Anomalies
          </button>
          <button
            onClick={() => setActiveView("taxpayer_classifier")}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
              activeView === "taxpayer_classifier" ? "bg-cyan-500 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Taxpayer Risk (Random Forest)
          </button>
        </div>
      </FloatingPanel>

      {/* Model Transparency & Limitations Banner */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200 flex items-start gap-3">
        <Info className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
        <div className="leading-relaxed">
          <strong>Statistical Methodology & Legal Disclaimer:</strong> Anomaly detection (Isolation Forest) identifies multidimensional statistical outliers (e.g. unusual transaction time, velocity, or deviation from category mean). <em>An anomaly flag does not equate to confirmed fraud or guilt.</em> Taxpayer Risk Classification uses a trained Random Forest model. Evaluated on verified synthetic baseline benchmarks.
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* VIEW 1: ISOLATION FOREST TRANSACTION ANOMALIES                      */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeView === "isolation_forest" && (
        <div className="space-y-6">
          {/* Live Transaction Anomaly Tester Form */}
          <FloatingPanel className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-cyan-400" />
                  Interactive Single-Transaction Anomaly Tester
                </h3>
                <p className="text-xs text-slate-400">
                  Submit a custom transaction to evaluate its anomaly score against the Isolation Forest model in real time.
                </p>
              </div>
            </div>

            <form onSubmit={handleRunCustomTest} className="grid grid-cols-1 gap-3 sm:grid-cols-6 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  value={testAmount}
                  onChange={(e) => setTestAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Merchant / Payee</label>
                <input
                  type="text"
                  value={testMerchant}
                  onChange={(e) => setTestMerchant(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Category</label>
                <select
                  value={testCategory}
                  onChange={(e) => setTestCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-400"
                >
                  <option value="Groceries">Groceries</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Investment">Investment / Crypto</option>
                  <option value="Travel">Travel & Hotel</option>
                  <option value="Dining">Dining</option>
                  <option value="Utilities">Utilities</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Time of Transaction</label>
                <input
                  type="time"
                  value={testTime}
                  onChange={(e) => setTestTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Payment Channel</label>
                <select
                  value={testMethod}
                  onChange={(e) => setTestMethod(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-400"
                >
                  <option value="UPI">UPI</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Debit Card">Debit Card</option>
                  <option value="Wire Transfer">Wire Transfer / RTGS</option>
                  <option value="Cash">Cash Deposit</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={testingCustom}
                  className="w-full rounded-lg bg-cyan-500 py-2 font-bold text-white shadow-md shadow-cyan-500/20 hover:bg-cyan-400 transition"
                >
                  {testingCustom ? "Scoring..." : "Score Outlier"}
                </button>
              </div>
            </form>

            {customTestResult && (
              <div className={`mt-3 rounded-xl border p-4 text-xs space-y-1.5 ${
                customTestResult.is_anomaly
                  ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
                  : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5 text-sm">
                    {customTestResult.is_anomaly ? <AlertTriangle className="h-4 w-4 text-rose-400" /> : <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                    {customTestResult.is_anomaly ? "Statistical Anomaly Detected" : "Standard Transaction Pattern"}
                  </span>
                  <span className="rounded-full px-2 py-0.5 font-bold uppercase text-[10px] bg-slate-900">
                    Risk Level: {customTestResult.risk_level}
                  </span>
                </div>
                <p>
                  <strong>Anomaly Score:</strong> {customTestResult.anomaly_score.toFixed(4)} (Threshold: ~0.5000)
                </p>
                <p>
                  <strong>Primary Reason:</strong> {customTestResult.primary_reason}
                </p>
              </div>
            )}
          </FloatingPanel>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <FloatingPanel>
              <p className="text-xs font-semibold uppercase text-slate-400">Total Evaluated</p>
              <h3 className="mt-1 text-2xl font-bold text-white font-mono">{data?.total_transactions || 0}</h3>
              <p className="mt-1 text-[11px] text-slate-400">Baseline reference pool</p>
            </FloatingPanel>

            <FloatingPanel>
              <p className="text-xs font-semibold uppercase text-slate-400">Outliers Flagged</p>
              <h3 className="mt-1 text-2xl font-bold text-rose-400 font-mono">{data?.anomalies_detected || 0}</h3>
              <p className="mt-1 text-[11px] text-rose-300">Statistical anomalies (6% contamination)</p>
            </FloatingPanel>

            <FloatingPanel>
              <p className="text-xs font-semibold uppercase text-slate-400">Critical Outliers (Derived Tier)</p>
              <h3 className="mt-1 text-2xl font-bold text-red-500 font-mono">{data?.risk_summary.critical || 0}</h3>
              <p className="mt-1 text-[11px] text-slate-400">Derived tier: anomaly score ≥ 0.85</p>
            </FloatingPanel>

            <FloatingPanel>
              <p className="text-xs font-semibold uppercase text-slate-400">Algorithm Metadata</p>
              <h3 className="mt-1 text-lg font-bold text-cyan-300 truncate">Isolation Forest</h3>
              <p className="mt-1 text-[11px] text-slate-400">n_estimators=100, random_state=42</p>
            </FloatingPanel>
          </div>

          {/* Transactions Table */}
          <FloatingPanel className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {(["ALL", "ANOMALIES", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                      activeTab === tab ? "bg-cyan-500 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter transactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 py-1 pl-8 pr-2.5 text-xs text-white outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-slate-800 bg-slate-800/40 font-bold uppercase text-slate-400">
                  <tr>
                    <th className="py-2.5 px-3">Transaction ID</th>
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3">Merchant</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                    <th className="py-2.5 px-3 text-center">Anomaly Score</th>
                    <th className="py-2.5 px-3 text-center">Risk Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredTransactions.slice(0, 50).map((tx) => (
                    <tr key={tx.transaction_id} className="hover:bg-slate-800/20 transition">
                      <td className="py-2.5 px-3 font-mono text-cyan-300">{tx.transaction_id}</td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono">{tx.date} {tx.time}</td>
                      <td className="py-2.5 px-3 text-white font-semibold">{tx.merchant}</td>
                      <td className="py-2.5 px-3">{tx.category}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                        ₹{tx.amount.toLocaleString("en-IN")}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold">
                        {tx.anomaly_score.toFixed(3)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{
                            backgroundColor: `${RISK_COLORS[tx.risk_level]}20`,
                            color: RISK_COLORS[tx.risk_level],
                            border: `1px solid ${RISK_COLORS[tx.risk_level]}40`,
                          }}
                        >
                          {tx.risk_level}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredTransactions.length > 50 && (
              <p className="text-[11px] text-slate-500 text-center">
                Showing top 50 matches out of {filteredTransactions.length} evaluated transactions.
              </p>
            )}
          </FloatingPanel>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* VIEW 2: SUPERVISED TAXPAYER RISK (RANDOM FOREST)                    */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeView === "taxpayer_classifier" && (
        <div className="space-y-6">
          <FloatingPanel className="space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="h-4 w-4 text-cyan-400" />
                Taxpayer Compliance Risk Classifier (Random Forest)
              </h3>
              <p className="text-xs text-slate-400">
                Supervised classification model evaluating taxpayer profiles. Model classes: High, Low, Medium (Critical is a derived tier from rule/anomaly threshold ≥ 0.85, not a model class).
              </p>
            </div>

            <form onSubmit={handlePredictTaxpayer} className="grid grid-cols-1 gap-3 sm:grid-cols-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Annual Revenue (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={tpRevenue}
                  onChange={(e) => setTpRevenue(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Annual Expenses (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={tpExpenses}
                  onChange={(e) => setTpExpenses(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Calculated Tax Liability (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={tpLiability}
                  onChange={(e) => setTpLiability(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Actual Tax Paid (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={tpPaid}
                  onChange={(e) => setTpPaid(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Late Filings Count</label>
                <input
                  type="number"
                  min="0"
                  value={tpLateFilings}
                  onChange={(e) => setTpLateFilings(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Compliance Violations</label>
                <input
                  type="number"
                  min="0"
                  value={tpViolations}
                  onChange={(e) => setTpViolations(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Audit Findings Count</label>
                <input
                  type="number"
                  min="0"
                  value={tpAuditFindings}
                  onChange={(e) => setTpAuditFindings(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Industry Sector</label>
                <select
                  value={tpIndustry}
                  onChange={(e) => setTpIndustry(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-400"
                >
                  <option value="Tech">Technology / IT Services</option>
                  <option value="Finance">Financial Services</option>
                  <option value="Retail">Retail & E-commerce</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Healthcare">Healthcare</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={tpLoading}
                  className="w-full rounded-lg bg-cyan-500 py-2.5 font-bold text-white shadow-md shadow-cyan-500/20 hover:bg-cyan-400 transition"
                >
                  {tpLoading ? "Evaluating..." : "Run Random Forest Model"}
                </button>
              </div>
            </form>

            {tpError && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                {tpError}
              </div>
            )}

            {tpResult && (
              <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[11px] text-slate-400 uppercase font-semibold">Predicted Compliance Risk</span>
                    <h4 className={`text-xl font-black ${
                      tpResult.predicted_risk_level === "High" ? "text-rose-400" : tpResult.predicted_risk_level === "Medium" ? "text-amber-400" : "text-emerald-400"
                    }`}>
                      {tpResult.predicted_risk_level} Risk Taxpayer
                    </h4>
                  </div>
                  <span className="rounded-lg bg-slate-800 px-3 py-1 font-mono text-xs text-slate-300">
                    ID: {tpResult.taxpayer_id}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(tpResult.risk_probabilities).map(([level, prob]) => (
                    <div key={level} className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs">
                      <span className="text-slate-400">{level} Probability</span>
                      <p className="mt-1 font-mono font-bold text-white text-base">{(prob * 100).toFixed(1)}%</p>
                    </div>
                  ))}
                </div>

                {tpResult.risk_flags.length > 0 && (
                  <div className="pt-2">
                    <span className="text-xs font-semibold text-slate-300">Statutory Risk Flags:</span>
                    <ul className="list-disc pl-4 space-y-0.5 text-xs text-amber-300 mt-1">
                      {tpResult.risk_flags.map((flag, idx) => (
                        <li key={idx}>{flag}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-xs text-slate-300 pt-1 leading-relaxed">
                  <strong>Assessment Summary:</strong> {tpResult.taxpayer_summary}
                </p>
              </div>
            )}
          </FloatingPanel>
        </div>
      )}
    </div>
  );
}
