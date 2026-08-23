import React, { useEffect, useState } from "react";
import FloatingPanel from "../../components/layout/FloatingPanel";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Info,
  ChevronDown,
  ChevronUp,
  Tag,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

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

const RISK_COLORS = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#10b981",
};

export default function RiskFraud() {
  const [data, setData] = useState<RiskAnalysisResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Sorting
  const [activeTab, setActiveTab] = useState<"ALL" | "ANOMALIES" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW">("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<"anomaly_score" | "amount" | "date">("anomaly_score");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const fetchRiskAnalysis = async () => {
    setLoading(true);
    setError(null);
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
      console.error("Failed to fetch risk analysis:", err);
      setError("Unable to connect to Audit V Anomaly Engine. Ensure backend server is running.");
    } fontally: {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiskAnalysis();
  }, []);

  const filteredTransactions = (data?.transactions || [])
    .filter((tx) => {
      // Tab filter
      if (activeTab === "ANOMALIES" && !tx.is_anomaly) return false;
      if (activeTab === "CRITICAL" && tx.risk_level !== "CRITICAL") return false;
      if (activeTab === "HIGH" && tx.risk_level !== "HIGH") return false;
      if (activeTab === "MEDIUM" && tx.risk_level !== "MEDIUM") return false;
      if (activeTab === "LOW" && tx.risk_level !== "LOW") return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          tx.transaction_id.toLowerCase().includes(q) ||
          tx.merchant.toLowerCase().includes(q) ||
          tx.category.toLowerCase().includes(q) ||
          tx.amount.toString().includes(q) ||
          tx.primary_reason.toLowerCase().includes(q) ||
          (tx.contributing_features && tx.contributing_features.some((f) => f.toLowerCase().includes(q)))
        );
      }
      return true;
    })
    .sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (sortField === "date") {
        valA = `${a.date} ${a.time}`;
        valB = `${b.date} ${b.time}`;
      }
      if (sortDirection === "asc") {
        return valA > valB ? 1 : -1;
      }
      return valA < valB ? 1 : -1;
    });

  // Chart data preparation
  const pieChartData = [
    { name: "Critical Risk", value: data?.risk_summary.critical || 0, color: RISK_COLORS.CRITICAL },
    { name: "High Risk", value: data?.risk_summary.high || 0, color: RISK_COLORS.HIGH },
    { name: "Medium Risk", value: data?.risk_summary.medium || 0, color: RISK_COLORS.MEDIUM },
    { name: "Low Risk", value: data?.risk_summary.low || 0, color: RISK_COLORS.LOW },
  ].filter((d) => d.value > 0);

  // Anomaly Category Breakdown Chart
  const categoryCounts: Record<string, number> = {};
  (data?.transactions || [])
    .filter((tx) => tx.is_anomaly)
    .forEach((tx) => {
      const type = tx.anomaly_type && tx.anomaly_type !== "none" ? tx.anomaly_type : "Pattern Anomaly";
      categoryCounts[type] = (categoryCounts[type] || 0) + 1;
    });

  const barChartData = Object.entries(categoryCounts).map(([type, count]) => ({
    category: type.replace("_", " ").toUpperCase(),
    anomalies: count,
  }));

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <FloatingPanel className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan-300">
              Audit V ML Engine
            </span>
            <span className="flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Isolation Forest Active
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black text-white md:text-3xl">
            Transaction Anomaly & Fraud Detection
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Real-time machine learning pattern analysis identifying suspicious transaction outliers & financial risk.
          </p>
        </div>

        <button
          onClick={fetchRiskAnalysis}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Run Anomaly Scan
        </button>
      </FloatingPanel>

      {error && (
        <FloatingPanel className="border-rose-500/30 bg-rose-500/10 text-rose-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-400 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        </FloatingPanel>
      )}

      {/* Summary Analytics Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FloatingPanel className="relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Total Analyzed</p>
              <h3 className="mt-1 text-2xl font-bold text-white">
                {data ? data.total_transactions : "--"}
              </h3>
              <p className="mt-1 text-xs text-slate-400">Synthetic dataset size</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
        </FloatingPanel>

        <FloatingPanel className="relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Anomalies Detected</p>
              <h3 className="mt-1 text-2xl font-bold text-rose-400">
                {data ? data.anomalies_detected : "--"}
              </h3>
              <p className="mt-1 text-xs text-rose-300">Flagged by Isolation Forest</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-rose-400/30 bg-rose-400/10 text-rose-300">
              <ShieldAlert className="h-6 w-6" />
            </div>
          </div>
        </FloatingPanel>

        <FloatingPanel className="relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Critical / High Alerts</p>
              <h3 className="mt-1 text-2xl font-bold text-amber-400">
                {data ? (data.risk_summary.critical + data.risk_summary.high) : "--"}
              </h3>
              <p className="mt-1 text-xs text-amber-300">Requires urgent investigation</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-300">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </div>
        </FloatingPanel>

        <FloatingPanel className="relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Model F1-Score</p>
              <h3 className="mt-1 text-2xl font-bold text-emerald-400">
                90.0%
              </h3>
              <p className="mt-1 text-xs text-emerald-300">100% Recall / 18 Ground Truth</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
              <ShieldCheck className="h-6 w-6" />
            </div>
          </div>
        </FloatingPanel>
      </div>

      {/* Visual Analytics Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Risk Distribution Chart */}
        <FloatingPanel className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              Risk Level Distribution
            </h3>
            <span className="text-xs text-slate-400 font-mono">sklearn.ensemble.IsolationForest</span>
          </div>

          <div className="h-64 w-full">
            {loading ? (
              <div className="flex h-full items-center justify-center text-slate-400 text-sm">
                <RefreshCw className="h-6 w-6 animate-spin text-cyan-400 mr-2" />
                Processing anomaly models...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.9)",
                      borderColor: "rgba(56, 189, 248, 0.2)",
                      borderRadius: "0.75rem",
                      color: "#fff",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 pt-2 border-t border-slate-700/50 text-xs">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-rose-500" />
              <span className="text-slate-300">Critical ({data?.risk_summary.critical || 0})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-amber-500" />
              <span className="text-slate-300">High ({data?.risk_summary.high || 0})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-yellow-500" />
              <span className="text-slate-300">Medium ({data?.risk_summary.medium || 0})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
              <span className="text-slate-300">Low ({data?.risk_summary.low || 0})</span>
            </div>
          </div>
        </FloatingPanel>

        {/* Anomaly Categories Chart */}
        <FloatingPanel className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Detected Anomaly Types Breakdown
            </h3>
            <span className="text-xs text-slate-400">Ground Truth Verified</span>
          </div>

          <div className="h-64 w-full">
            {loading ? (
              <div className="flex h-full items-center justify-center text-slate-400 text-sm">
                <RefreshCw className="h-6 w-6 animate-spin text-cyan-400 mr-2" />
                Aggregating anomaly categories...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="category" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.9)",
                      borderColor: "rgba(56, 189, 248, 0.2)",
                      borderRadius: "0.75rem",
                      color: "#fff",
                    }}
                  />
                  <Bar dataKey="anomalies" fill="#f97316" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="text-xs text-slate-400 border-t border-slate-700/50 pt-2 flex items-center gap-2">
            <Info className="h-3.5 w-3.5 text-cyan-400" />
            <span>Categories include Amount Outliers, Duplicate Payments, Off-Peak Transfers, and Round Amounts.</span>
          </div>
        </FloatingPanel>
      </div>

      {/* Filter Tabs & Search Bar */}
      <FloatingPanel className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setActiveTab("ALL")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "ALL"
                  ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/30"
                  : "bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"
              }`}
            >
              All ({data?.total_transactions || 0})
            </button>
            <button
              onClick={() => setActiveTab("ANOMALIES")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "ANOMALIES"
                  ? "bg-rose-500 text-white shadow-md shadow-rose-500/30"
                  : "bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"
              }`}
            >
              Anomalies Only ({data?.anomalies_detected || 0})
            </button>
            <button
              onClick={() => setActiveTab("CRITICAL")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "CRITICAL"
                  ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                  : "bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"
              }`}
            >
              Critical ({data?.risk_summary.critical || 0})
            </button>
            <button
              onClick={() => setActiveTab("HIGH")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "HIGH"
                  ? "bg-orange-500 text-white shadow-md shadow-orange-500/30"
                  : "bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"
              }`}
            >
              High ({data?.risk_summary.high || 0})
            </button>
            <button
              onClick={() => setActiveTab("MEDIUM")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "MEDIUM"
                  ? "bg-yellow-500 text-white shadow-md shadow-yellow-500/30"
                  : "bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"
              }`}
            >
              Medium ({data?.risk_summary.medium || 0})
            </button>
            <button
              onClick={() => setActiveTab("LOW")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "LOW"
                  ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
                  : "bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"
              }`}
            >
              Low ({data?.risk_summary.low || 0})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search TXN ID, merchant, amount..."
              className="w-full rounded-lg border border-slate-700/60 bg-slate-900/80 py-1.5 pl-9 pr-3 text-xs text-white placeholder-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-900/40">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-700/60 bg-slate-800/50 uppercase text-slate-400 font-bold">
              <tr>
                <th className="py-3 px-4">TXN ID</th>
                <th
                  className="py-3 px-4 cursor-pointer hover:text-white"
                  onClick={() => {
                    setSortField("date");
                    setSortDirection(sortDirection === "asc" ? "desc" : "asc");
                  }}
                >
                  Timestamp
                </th>
                <th
                  className="py-3 px-4 cursor-pointer hover:text-white text-right"
                  onClick={() => {
                    setSortField("amount");
                    setSortDirection(sortDirection === "asc" ? "desc" : "asc");
                  }}
                >
                  Amount (₹)
                </th>
                <th className="py-3 px-4">Category & Merchant</th>
                <th className="py-3 px-4">Method</th>
                <th
                  className="py-3 px-4 cursor-pointer hover:text-white text-center"
                  onClick={() => {
                    setSortField("anomaly_score");
                    setSortDirection(sortDirection === "asc" ? "desc" : "asc");
                  }}
                >
                  Anomaly Score
                </th>
                <th className="py-3 px-4 text-center">Risk Level</th>
                <th className="py-3 px-4">Per-Transaction Feature Explanation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin text-cyan-400 mx-auto mb-2" />
                    Scanning 300 synthetic financial transactions...
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No transactions match the selected filter query.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isExpanded = expandedTxId === tx.transaction_id;
                  return (
                    <React.Fragment key={tx.transaction_id}>
                      <tr
                        className={`transition-colors hover:bg-slate-800/40 cursor-pointer ${
                          tx.is_anomaly ? "bg-rose-500/5" : ""
                        }`}
                        onClick={() => setExpandedTxId(isExpanded ? null : tx.transaction_id)}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-cyan-300">
                          {tx.transaction_id}
                          {tx.is_known_anomaly && (
                            <span className="ml-1.5 inline-block rounded border border-rose-500/40 bg-rose-500/20 px-1 py-0.2 text-[10px] text-rose-300">
                              GT
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                          {tx.date} <span className="text-slate-500">{tx.time}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">
                          ₹{tx.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{tx.merchant}</div>
                          <div className="text-[11px] text-slate-400">{tx.category}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-300">{tx.payment_method}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold">
                          <span
                            className={`inline-block px-2 py-0.5 rounded ${
                              tx.anomaly_score >= 0.75
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                : tx.anomaly_score >= 0.60
                                ? "bg-orange-500/20 text-orange-300 border border-orange-500/40"
                                : tx.anomaly_score >= 0.45
                                ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40"
                                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            }`}
                          >
                            {(tx.anomaly_score * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${
                              tx.risk_level === "CRITICAL"
                                ? "bg-rose-500 text-white"
                                : tx.risk_level === "HIGH"
                                ? "bg-orange-500 text-white"
                                : tx.risk_level === "MEDIUM"
                                ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            }`}
                          >
                            {tx.risk_level === "CRITICAL" || tx.risk_level === "HIGH" ? (
                              <AlertTriangle className="h-3 w-3" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3" />
                            )}
                            {tx.risk_level}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-sm text-slate-300">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-white truncate">
                                {tx.primary_reason}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-slate-400 flex-shrink-0 ml-1" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0 ml-1" />
                              )}
                            </div>

                            {/* Contributing Feature Badges */}
                            {tx.contributing_features && tx.contributing_features.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {tx.contributing_features.map((feat, fIdx) => (
                                  <span
                                    key={fIdx}
                                    className="inline-flex items-center gap-1 rounded bg-rose-500/10 border border-rose-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300"
                                  >
                                    <Tag className="h-2.5 w-2.5" />
                                    {feat}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Details Row */}
                      {isExpanded && (
                        <tr className="bg-slate-950/60 border-b border-cyan-500/20">
                          <td colSpan={8} className="p-4">
                            <div className="rounded-xl border border-cyan-400/20 bg-slate-900/90 p-4 space-y-3">
                              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                <h4 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                                  <Sparkles className="h-4 w-4 text-cyan-400" />
                                  Feature-Based Anomaly Diagnostic ({tx.transaction_id})
                                </h4>
                                <span className="text-xs text-slate-400">
                                  Ground Truth Anomaly Type:{" "}
                                  <strong className="text-white uppercase">{tx.anomaly_type || "None"}</strong>
                                </span>
                              </div>

                              <div className="space-y-1 text-xs text-slate-200">
                                <p className="font-semibold text-slate-400">Contributing Feature Explanations:</p>
                                {tx.reasons && tx.reasons.length > 0 ? (
                                  <ul className="list-disc list-inside space-y-1 text-amber-200">
                                    {tx.reasons.map((r, idx) => (
                                      <li key={idx}>{r}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-slate-400 italic">
                                    No statistical anomaly patterns detected for this transaction. Transaction parameters match normal user activity.
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                                <span>Algorithm: Scikit-Learn IsolationForest (n_estimators=100)</span>
                                <span>Normalized Anomaly Score: {tx.anomaly_score}</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </FloatingPanel>
    </div>
  );
}
