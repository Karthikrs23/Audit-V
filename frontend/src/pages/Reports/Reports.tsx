import { useState } from "react";
import FloatingPanel from "../../components/layout/FloatingPanel";
import {
  FileCheck2,
  Download,
  Sparkles,
  Search,
  CheckCircle2,
  FileSpreadsheet,
} from "lucide-react";

interface AuditReport {
  id: string;
  title: string;
  type: "Tax Audit" | "Anomaly Summary" | "GST Filing" | "Financial Health";
  generatedDate: string;
  format: "PDF" | "CSV" | "JSON";
  size: string;
  status: "Ready" | "Generating";
}

const REPORTS_LIST: AuditReport[] = [
  {
    id: "REP-2026-01",
    title: "FY2025-26 Comprehensive Income Tax Audit Report",
    type: "Tax Audit",
    generatedDate: "2026-08-15",
    format: "PDF",
    size: "2.8 MB",
    status: "Ready",
  },
  {
    id: "REP-2026-02",
    title: "Isolation Forest Anomaly & Fraud Assessment Summary",
    type: "Anomaly Summary",
    generatedDate: "2026-08-14",
    format: "PDF",
    size: "1.9 MB",
    status: "Ready",
  },
  {
    id: "REP-2026-03",
    title: "GSTR-3B & GSTR-1 Reconciliation Ledger",
    type: "GST Filing",
    generatedDate: "2026-08-10",
    format: "CSV",
    size: "640 KB",
    status: "Ready",
  },
  {
    id: "REP-2026-04",
    title: "H1 2026 Cash Flow & Operating Margin Statement",
    type: "Financial Health",
    generatedDate: "2026-08-01",
    format: "PDF",
    size: "3.2 MB",
    status: "Ready",
  },
];

export default function Reports() {
  const [reports, setReports] = useState<AuditReport[]>(REPORTS_LIST);
  const [searchQuery, setSearchQuery] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateReport = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const newRep: AuditReport = {
        id: `REP-2026-0${reports.length + 1}`,
        title: "Instant Audit V Compliance Summary Report",
        type: "Tax Audit",
        generatedDate: new Date().toISOString().split("T")[0],
        format: "PDF",
        size: "2.1 MB",
        status: "Ready",
      };
      setReports([newRep, ...reports]);
      setIsGenerating(false);
    }, 1000);
  };

  const filteredReports = reports.filter((r) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.id.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <FloatingPanel className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan-300">
              Audit V Report Engine
            </span>
            <span className="flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              Automated PDF Generation Active
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black text-white md:text-3xl">
            Audit & Compliance Reports
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Generate, download, and export official tax audit summaries, transaction anomaly findings, and financial statements.
          </p>
        </div>

        <button
          onClick={handleGenerateReport}
          disabled={isGenerating}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 hover:scale-105 active:scale-95 transition disabled:opacity-50"
        >
          <FileCheck2 className="h-4 w-4" />
          {isGenerating ? "Generating Audit Report..." : "Generate New Audit PDF"}
        </button>
      </FloatingPanel>

      {/* Reports Table */}
      <FloatingPanel className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-cyan-400" />
            Generated Compliance & Audit Reports List
          </h3>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reports..."
              className="w-full rounded-lg border border-slate-700 bg-slate-900 py-1.5 pl-9 pr-3 text-xs text-white placeholder-slate-400 focus:border-cyan-400 outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-900/40">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-700/60 bg-slate-800/50 uppercase text-slate-400 font-bold">
              <tr>
                <th className="py-3 px-4">Report ID</th>
                <th className="py-3 px-4">Report Title</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Generated Date</th>
                <th className="py-3 px-4">Format & Size</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredReports.map((r) => (
                <tr key={r.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-3 px-4 font-mono font-bold text-cyan-300">{r.id}</td>
                  <td className="py-3 px-4 text-white font-semibold">{r.title}</td>
                  <td className="py-3 px-4">
                    <span className="rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">
                      {r.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400">{r.generatedDate}</td>
                  <td className="py-3 px-4 text-slate-400">
                    <span className="font-mono font-bold text-cyan-300">{r.format}</span> ({r.size})
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-bold">
                      <CheckCircle2 className="h-3 w-3" />
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-400/20 transition"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FloatingPanel>
    </div>
  );
}
