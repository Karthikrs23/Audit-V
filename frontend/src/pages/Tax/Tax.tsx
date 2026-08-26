import { useState } from "react";
import FloatingPanel from "../../components/layout/FloatingPanel";
import {
  ReceiptIndianRupee,
  CheckCircle2,
  Clock,
  Calculator,
  Search,
  FileCheck2,
  Calendar,
  Sparkles,
} from "lucide-react";

interface TaxSection {
  code: string;
  title: string;
  limit: string;
  category: "Old Regime" | "New Regime" | "TDS / TCS" | "GST";
  description: string;
}

const TAX_SECTIONS: TaxSection[] = [
  {
    code: "Section 80C / Sec 123",
    title: "Tax-Saving Deductions (EPF, PPF, ELSS, Housing Loan)",
    limit: "₹1,50,000",
    category: "Old Regime",
    description: "Eligible investments under Sec 80C (recodified as Sec 123 under IT Act 2025) include EPF, PPF, ELSS, FDs, tuition fees, and home loan principal.",
  },
  {
    code: "Section 80D / Sec 126",
    title: "Health Insurance Premium Deduction",
    limit: "Up to ₹1,00,000",
    category: "Old Regime",
    description: "Medical insurance premiums for self, family (₹25k) and senior citizen parents (₹50k) under Sec 80D (recodified as Sec 126).",
  },
  {
    code: "Section 80CCD(1B)",
    title: "National Pension System (NPS) Additional Contribution",
    limit: "₹50,000",
    category: "Old Regime",
    description: "Additional tax deduction exclusively for contributions to NPS Tier-I accounts.",
  },
  {
    code: "Section 115BAC / Sec 202",
    title: "New Tax Regime Concessional Rate Slabs",
    limit: "Standard ₹75,000",
    category: "New Regime",
    description: "Default tax regime with lower slab rates and ₹12,00,000 Section 87A / Sec 157 full rebate limit (Tax Year 2026-27).",
  },
  {
    code: "Section 194C",
    title: "TDS on Payments to Contractors & Sub-Contractors",
    limit: "1% / 2% TDS",
    category: "TDS / TCS",
    description: "Tax deducted at source for contractual payments exceeding ₹30,000 single or ₹1,00,000 annual.",
  },
  {
    code: "Section 194J",
    title: "TDS on Fees for Professional or Technical Services",
    limit: "2% / 10% TDS",
    category: "TDS / TCS",
    description: "TDS deduction on professional fees, technical consultancy, or managerial services.",
  },
];

const GST_FILINGS = [
  { form: "GSTR-1", period: "July 2026", status: "Filed", dueDate: "11 Aug 2026", ARN: "AA2708260194821" },
  { form: "GSTR-3B", period: "July 2026", status: "Pending", dueDate: "20 Aug 2026", ARN: "--" },
  { form: "GSTR-9", period: "FY 2025-26", status: "Upcoming", dueDate: "31 Dec 2026", ARN: "--" },
];

export default function Tax() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  // Calculator State
  const [calcAmount, setCalcAmount] = useState<number>(100000);
  const [calcRate, setCalcRate] = useState<number>(18);
  const [calcType, setCalcType] = useState<"exclusive" | "inclusive">("exclusive");

  const gstAmount =
    calcType === "exclusive"
      ? (calcAmount * calcRate) / 100
      : calcAmount - calcAmount / (1 + calcRate / 100);

  const totalWithGst = calcType === "exclusive" ? calcAmount + gstAmount : calcAmount;

  const filteredSections = TAX_SECTIONS.filter((s) => {
    if (selectedCategory !== "ALL" && s.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        s.code.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
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
              Audit V Compliance Hub
            </span>
            <span className="flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Tax Engine Active
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black text-white md:text-3xl">
            Tax & Compliance Management
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            GST filing status, Income Tax Act section reference guides, and interactive tax liability calculators.
          </p>
        </div>
      </FloatingPanel>

      {/* Grid Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FloatingPanel>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Compliance Health Score</p>
              <h3 className="mt-1 text-2xl font-bold text-emerald-400">98 / 100</h3>
              <p className="mt-1 text-xs text-emerald-300">All statutory filings up to date</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
              <FileCheck2 className="h-6 w-6" />
            </div>
          </div>
        </FloatingPanel>

        <FloatingPanel>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Next Filing Due</p>
              <h3 className="mt-1 text-2xl font-bold text-amber-400">GSTR-3B</h3>
              <p className="mt-1 text-xs text-amber-300">Due 20 Aug 2026 (4 days left)</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-300">
              <Clock className="h-6 w-6" />
            </div>
          </div>
        </FloatingPanel>

        <FloatingPanel>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Active GSTIN</p>
              <h3 className="mt-1 text-xl font-bold text-cyan-300 font-mono">27AAAAA0000A1Z5</h3>
              <p className="mt-1 text-xs text-slate-400">Maharashtra State Jurisdiction</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
              <ReceiptIndianRupee className="h-6 w-6" />
            </div>
          </div>
        </FloatingPanel>

        <FloatingPanel>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Tax Regime Choice</p>
              <h3 className="mt-1 text-xl font-bold text-white">Section 115BAC</h3>
              <p className="mt-1 text-xs text-cyan-300">New Tax Regime Recommended</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
              <Sparkles className="h-6 w-6" />
            </div>
          </div>
        </FloatingPanel>
      </div>

      {/* Main Content Grid: GST Filings & Interactive GST Calculator */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* GST Filings Tracker Table */}
        <FloatingPanel className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Calendar className="h-4 w-4 text-cyan-400" />
              GST Return Filing Status (FY 2026-27)
            </h3>
            <span className="text-xs text-slate-400 font-mono">GSTN Portal Synced</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-900/40">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="border-b border-slate-700/60 bg-slate-800/50 uppercase text-slate-400 font-bold">
                <tr>
                  <th className="py-3 px-4">Return Form</th>
                  <th className="py-3 px-4">Return Period</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">ARN Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {GST_FILINGS.map((row) => (
                  <tr key={row.form} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-bold text-cyan-300 font-mono">{row.form}</td>
                    <td className="py-3 px-4 text-white">{row.period}</td>
                    <td className="py-3 px-4 text-slate-400">{row.dueDate}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          row.status === "Filed"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : row.status === "Pending"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}
                      >
                        {row.status === "Filed" && <CheckCircle2 className="h-3 w-3" />}
                        {row.status === "Pending" && <Clock className="h-3 w-3" />}
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{row.ARN}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FloatingPanel>

        {/* Interactive GST Calculator */}
        <FloatingPanel className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Calculator className="h-4 w-4 text-cyan-400" />
              GST Liability Calculator
            </h3>
            <span className="text-xs text-cyan-300 font-bold">Instant</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Base Amount (₹)</label>
              <input
                type="number"
                value={calcAmount}
                onChange={(e) => setCalcAmount(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">GST Rate (%)</label>
                <select
                  value={calcRate}
                  onChange={(e) => setCalcRate(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-400"
                >
                  <option value={5}>5% (Essential)</option>
                  <option value={12}>12% (Standard)</option>
                  <option value={18}>18% (Services/General)</option>
                  <option value={28}>28% (Luxury)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Calculation Type</label>
                <select
                  value={calcType}
                  onChange={(e) => setCalcType(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-400"
                >
                  <option value="exclusive">GST Exclusive</option>
                  <option value="inclusive">GST Inclusive</option>
                </select>
              </div>
            </div>

            {/* Result Box */}
            <div className="p-3.5 rounded-xl border border-cyan-400/30 bg-cyan-400/10 space-y-2 mt-2">
              <div className="flex justify-between items-center text-slate-300">
                <span>CGST ({calcRate / 2}%):</span>
                <strong className="text-white">₹{(gstAmount / 2).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>SGST ({calcRate / 2}%):</span>
                <strong className="text-white">₹{(gstAmount / 2).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong>
              </div>
              <div className="flex justify-between items-center border-t border-cyan-400/20 pt-2 text-cyan-300 font-bold text-sm">
                <span>Total Amount:</span>
                <span>₹{totalWithGst.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </FloatingPanel>
      </div>

      {/* Income Tax Act Sections Lookup */}
      <FloatingPanel className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ReceiptIndianRupee className="h-4 w-4 text-cyan-400" />
              Income Tax Act & Statutory Section Guide
            </h3>
            <p className="text-xs text-slate-400">Authoritative reference lookup for deductions & statutory TDS rates.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              {["ALL", "Old Regime", "New Regime", "TDS / TCS"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                    selectedCategory === cat
                      ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/30"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Section 80C, 194C, 115BAC..."
                className="w-full rounded-lg border border-slate-700 bg-slate-900 py-1.5 pl-9 pr-3 text-xs text-white placeholder-slate-400 focus:border-cyan-400 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section Cards Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSections.map((sec) => (
            <div
              key={sec.code}
              className="p-4 rounded-xl border border-slate-700/60 bg-slate-900/60 space-y-2 hover:border-cyan-400/40 transition"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-cyan-300 text-sm">{sec.code}</span>
                <span className="rounded-full bg-cyan-400/10 border border-cyan-400/30 px-2 py-0.5 text-[10px] font-bold text-cyan-200 uppercase">
                  {sec.category}
                </span>
              </div>
              <h4 className="text-xs font-bold text-white leading-snug">{sec.title}</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">{sec.description}</p>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">Max Limit:</span>
                <strong className="text-emerald-400">{sec.limit}</strong>
              </div>
            </div>
          ))}
        </div>
      </FloatingPanel>
    </div>
  );
}
