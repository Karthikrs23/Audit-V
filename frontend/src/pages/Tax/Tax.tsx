import { useState, useEffect, useId } from "react";
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
  AlertTriangle,
  Info,
  Building2,
  Layers,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import {
  fetchGSTRules,
  calculateGST,
  calculateIncomeTax,
  computeLocalGST,
  DEFAULT_CBIC_RULES,
  DEFAULT_INDIAN_STATES,
} from "../../services/taxApi";
import type {
  GSTRuleItem,
  GSTCalculationResult,
  IncomeTaxCalculationResult,
} from "../../services/taxApi";

interface TaxSection {
  code: string;
  title: string;
  limit: string;
  category: "Old Regime" | "New Regime" | "TDS / TCS" | "GST Statutory";
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
    description: "Additional tax deduction exclusively for contributions to NPS Tier-I accounts under Section 80CCD(1B).",
  },
  {
    code: "Section 115BAC / Sec 202",
    title: "New Tax Regime Concessional Rate Slabs (FY 2026-27)",
    limit: "Standard ₹75,000",
    category: "New Regime",
    description: "Default tax regime with streamlined slab rates and ₹12,00,000 Section 87A / Sec 157 full rebate threshold for Tax Year 2026-27.",
  },
  {
    code: "Section 194C",
    title: "TDS on Payments to Contractors & Sub-Contractors",
    limit: "1% (Ind/HUF) / 2% (Co)",
    category: "TDS / TCS",
    description: "Tax deducted at source for contractual payments exceeding ₹30,000 single or ₹1,00,000 cumulative annual threshold.",
  },
  {
    code: "Section 194J",
    title: "TDS on Fees for Professional or Technical Services",
    limit: "2% (Tech) / 10% (Prof)",
    category: "TDS / TCS",
    description: "TDS on fees for professional services, technical consultancy, royalty, or non-compete agreements.",
  },
  {
    code: "CGST Act Sec 7 & 8",
    title: "Scope of Supply & Composite / Mixed Supplies",
    limit: "Statutory Rule",
    category: "GST Statutory",
    description: "Governs taxable supply definitions, bundled natural services (composite supply taxed at principal rate), and mixed supply (highest rate).",
  },
  {
    code: "IGST Act Sec 7 & 10",
    title: "Inter-State Supply & Place of Supply of Goods",
    limit: "Location Dependent",
    category: "GST Statutory",
    description: "Determines whether supply is intra-state (CGST + SGST) or inter-state (IGST) based on location of supplier and place of delivery.",
  },
];

const DEMO_GST_FILINGS = [
  { form: "GSTR-1", period: "July 2026", status: "Sample Filed", dueDate: "11 Aug 2026", note: "Outward supplies summary" },
  { form: "GSTR-3B", period: "July 2026", status: "Sample Pending", dueDate: "20 Aug 2026", note: "Monthly summary return & tax payment" },
  { form: "GSTR-9", period: "FY 2025-26", status: "Sample Upcoming", dueDate: "31 Dec 2026", note: "Annual consolidated return" },
];

export default function Tax() {
  const [activeTab, setActiveTab] = useState<"gst" | "income_tax" | "statutory">("gst");
  const amountInputId = useId();

  // ──────────────────────────────────────────────────────────────────────────
  // GST Calculator State
  // ──────────────────────────────────────────────────────────────────────────
  const [gstAmountInput, setGstAmountInput] = useState<string>("100000");
  const [calcMode, setCalcMode] = useState<"exclusive" | "inclusive">("exclusive");
  const [goodsOrServices, setGoodsOrServices] = useState<"goods" | "services">("services");
  const [availableRules, setAvailableRules] = useState<GSTRuleItem[]>(DEFAULT_CBIC_RULES);
  const [indianStates, setIndianStates] = useState<string[]>(DEFAULT_INDIAN_STATES);
  const [selectedRuleHsn, setSelectedRuleHsn] = useState<string>("998314");
  const [customRate, setCustomRate] = useState<string>("18");
  const [sourceState, setSourceState] = useState<string>("Maharashtra");
  const [destState, setDestState] = useState<string>("Maharashtra");
  const [transactionType, setTransactionType] = useState<"b2b" | "b2c" | "sez" | "export">("b2b");
  
  const [gstResult, setGstResult] = useState<GSTCalculationResult | null>(() =>
    computeLocalGST({
      amount: 100000,
      calculation_mode: "exclusive",
      goods_or_services: "services",
      hsn_sac_code: "998314",
      source_state: "Maharashtra",
      destination_state: "Maharashtra",
      transaction_type: "b2b",
      rate_percentage: 18,
    })
  );
  const [gstLoading, setGstLoading] = useState<boolean>(false);
  const [gstError, setGstError] = useState<string | null>(null);

  // Demo Mode for GST Compliance Records
  const [demoMode, setDemoMode] = useState<boolean>(false);

  // ──────────────────────────────────────────────────────────────────────────
  // Income Tax Calculator State (FY 2026-27)
  // ──────────────────────────────────────────────────────────────────────────
  const [incomeInput, setIncomeInput] = useState<string>("1500000");
  const [taxpayerAge, setTaxpayerAge] = useState<number>(32);
  const [isSalaried, setIsSalaried] = useState<boolean>(true);
  const [sec80c, setSec80c] = useState<string>("150000");
  const [sec80d, setSec80d] = useState<string>("25000");
  const [sec80ccd, setSec80ccd] = useState<string>("50000");
  const [hraExempt, setHraExempt] = useState<string>("0");
  const [otherDeductions, setOtherDeductions] = useState<string>("0");

  const [itResult, setItResult] = useState<IncomeTaxCalculationResult | null>(null);
  const [itLoading, setItLoading] = useState<boolean>(false);
  const [itError, setItError] = useState<string | null>(null);

  // Statutory Guide Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  // Load GST rules on mount
  useEffect(() => {
    let mounted = true;
    fetchGSTRules()
      .then((res) => {
        if (mounted) {
          setAvailableRules(res.rules);
          setIndianStates(res.states);
        }
      })
      .catch((err) => {
        console.warn("Could not fetch GST rules from backend:", err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Update GST Calculation whenever inputs change
  useEffect(() => {
    const rawAmount = parseFloat(gstAmountInput);
    if (isNaN(rawAmount) || rawAmount <= 0) {
      setGstResult(null);
      if (gstAmountInput.trim() !== "" && rawAmount <= 0) {
        setGstError("Amount must be greater than zero.");
      } else {
        setGstError(null);
      }
      return;
    }

    if (rawAmount > 10000000000) {
      setGstError("Amount exceeds maximum supported calculation limit of ₹1,000 Crore.");
      setGstResult(null);
      return;
    }

    setGstError(null);
    setGstLoading(true);

    const timer = setTimeout(() => {
      const selectedRule = availableRules.find((r) => r.hsn_sac === selectedRuleHsn);
      const rateVal = selectedRuleHsn === "CUSTOM" ? parseFloat(customRate) || 18 : selectedRule?.standard_rate ?? 18;

      calculateGST({
        amount: rawAmount,
        calculation_mode: calcMode,
        goods_or_services: goodsOrServices,
        hsn_sac_code: selectedRuleHsn !== "CUSTOM" ? selectedRuleHsn : undefined,
        category: selectedRule?.category,
        source_state: sourceState,
        destination_state: destState,
        transaction_type: transactionType,
        rate_percentage: rateVal,
      })
        .then((res) => {
          setGstResult(res);
          setGstError(null);
        })
        .catch((err) => {
          setGstError(err.message || "Failed to calculate GST");
          setGstResult(null);
        })
        .finally(() => {
          setGstLoading(false);
        });
    }, 200);

    return () => clearTimeout(timer);
  }, [
    gstAmountInput,
    calcMode,
    goodsOrServices,
    selectedRuleHsn,
    customRate,
    sourceState,
    destState,
    transactionType,
    availableRules,
  ]);

  // Handle Income Tax Calculation
  const handleCalculateIncomeTax = () => {
    const inc = parseFloat(incomeInput);
    if (isNaN(inc) || inc <= 0) {
      setItError("Please enter a valid gross annual income greater than zero.");
      return;
    }
    setItError(null);
    setItLoading(true);

    calculateIncomeTax({
      annual_income: inc,
      age: taxpayerAge,
      regime: "compare",
      is_salaried: isSalaried,
      deductions: {
        section_80c: parseFloat(sec80c) || 0,
        section_80d: parseFloat(sec80d) || 0,
        section_80ccd_1b: parseFloat(sec80ccd) || 0,
        hra_exemption: parseFloat(hraExempt) || 0,
        other_deductions: parseFloat(otherDeductions) || 0,
      },
    })
      .then((res) => {
        setItResult(res);
      })
      .catch((err) => {
        setItError(err.message || "Income tax calculation error");
      })
      .finally(() => {
        setItLoading(false);
      });
  };

  // Run initial income tax calculation once
  useEffect(() => {
    handleCalculateIncomeTax();
  }, []);

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
              Audit V Tax Engine
            </span>
            <span className="flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Verified Deterministic Backend
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black text-white md:text-3xl">
            Tax & Compliance Engineering
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Authoritative GST tariff calculators, personal income-tax regime evaluations, and statutory section compliance.
          </p>
        </div>

        {/* Tab Selectors */}
        <div className="flex rounded-xl border border-slate-700/80 bg-slate-900/90 p-1 shadow-inner">
          <button
            onClick={() => setActiveTab("gst")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              activeTab === "gst"
                ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/25"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Calculator className="h-4 w-4" />
            GST Calculator
          </button>
          <button
            onClick={() => setActiveTab("income_tax")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              activeTab === "income_tax"
                ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/25"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <ReceiptIndianRupee className="h-4 w-4" />
            Income Tax (FY 26-27)
          </button>
          <button
            onClick={() => setActiveTab("statutory")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              activeTab === "statutory"
                ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/25"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Layers className="h-4 w-4" />
            Statutory Guide
          </button>
        </div>
      </FloatingPanel>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: GST CALCULATOR & COMPLIANCE                                  */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "gst" && (
        <div className="space-y-6">
          {/* Main GST Calculator Interface */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Input Controls (Left Column, 7 cols) */}
            <FloatingPanel className="lg:col-span-7 space-y-5">
              <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-cyan-400" />
                    Input-Driven GST Calculator
                  </h2>
                  <p className="text-xs text-slate-400">
                    Decimal-safe arithmetic with CBIC tariff schedule verification.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2 py-1 text-[11px] text-slate-300">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  CBIC Rules v2026.1
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <label htmlFor={amountInputId} className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Transaction Amount (₹) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-cyan-400">
                    ₹
                  </span>
                  <input
                    id={amountInputId}
                    type="number"
                    min="0"
                    step="any"
                    value={gstAmountInput}
                    onChange={(e) => setGstAmountInput(e.target.value)}
                    placeholder="Enter transaction amount (e.g. 100000)"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/90 py-3 pl-9 pr-4 text-xl font-bold text-white placeholder-slate-500 shadow-inner outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                  />
                </div>

                {/* Preset Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-400">Quick Presets:</span>
                  {[10000, 50000, 100000, 500000, 2500000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setGstAmountInput(preset.toString())}
                      className="rounded-md border border-slate-700/80 bg-slate-800/60 px-2 py-0.5 text-[11px] font-semibold text-slate-300 transition hover:border-cyan-400/50 hover:text-cyan-300"
                    >
                      ₹{preset.toLocaleString("en-IN")}
                    </button>
                  ))}
                </div>

                {gstError && (
                  <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-300">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                    <span>{gstError}</span>
                  </div>
                )}
              </div>

              {/* Calculation Mode Toggle */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCalcMode("exclusive")}
                  className={`rounded-xl border p-3 text-left transition ${
                    calcMode === "exclusive"
                      ? "border-cyan-400 bg-cyan-500/10 text-white shadow-lg shadow-cyan-500/10"
                      : "border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">GST Exclusive</span>
                    {calcMode === "exclusive" && <CheckCircle2 className="h-4 w-4 text-cyan-400" />}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400 leading-snug">
                    Amount is base value; tax is added on top.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setCalcMode("inclusive")}
                  className={`rounded-xl border p-3 text-left transition ${
                    calcMode === "inclusive"
                      ? "border-cyan-400 bg-cyan-500/10 text-white shadow-lg shadow-cyan-500/10"
                      : "border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">GST Inclusive</span>
                    {calcMode === "inclusive" && <CheckCircle2 className="h-4 w-4 text-cyan-400" />}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400 leading-snug">
                    Amount includes tax; tax is reverse-computed.
                  </p>
                </button>
              </div>

              {/* Goods vs Services and Classification */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Supply Nature
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setGoodsOrServices("services");
                        setSelectedRuleHsn("998314");
                      }}
                      className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
                        goodsOrServices === "services"
                          ? "border-cyan-400 bg-cyan-400/10 text-cyan-300"
                          : "border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Services (SAC)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGoodsOrServices("goods");
                        setSelectedRuleHsn("8471");
                      }}
                      className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
                        goodsOrServices === "goods"
                          ? "border-cyan-400 bg-cyan-400/10 text-cyan-300"
                          : "border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Goods (HSN)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Transaction Type
                  </label>
                  <select
                    value={transactionType}
                    onChange={(e) => setTransactionType(e.target.value as any)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                  >
                    <option value="b2b">B2B (Regular Business with GSTIN)</option>
                    <option value="b2c">B2C (Consumer Retail)</option>
                    <option value="sez">SEZ Unit (Zero-Rated with LUT)</option>
                    <option value="export">Export of Goods/Services (Zero-Rated)</option>
                  </select>
                </div>
              </div>

              {/* HSN/SAC Category Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  HSN / SAC Category (Verified CBIC Tariff Schedule)
                </label>
                <select
                  value={selectedRuleHsn}
                  onChange={(e) => {
                    setSelectedRuleHsn(e.target.value);
                    const matched = availableRules.find((r) => r.hsn_sac === e.target.value);
                    if (matched) {
                      setGoodsOrServices(matched.type);
                    }
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400 font-mono"
                >
                  <optgroup label="Authoritative Services (SAC)">
                    {availableRules
                      .filter((r) => r.type === "services")
                      .map((r) => (
                        <option key={r.hsn_sac} value={r.hsn_sac}>
                          SAC {r.hsn_sac} - {r.category} ({r.standard_rate}%)
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Authoritative Goods (HSN)">
                    {availableRules
                      .filter((r) => r.type === "goods")
                      .map((r) => (
                        <option key={r.hsn_sac} value={r.hsn_sac}>
                          HSN {r.hsn_sac} - {r.category} ({r.standard_rate}%)
                        </option>
                      ))}
                  </optgroup>
                  <option value="CUSTOM">-- Custom / Unverified GST Rate --</option>
                </select>
              </div>

              {/* Custom Rate Input if Selected */}
              {selectedRuleHsn === "CUSTOM" && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                    <AlertTriangle className="h-4 w-4" />
                    Unverified Custom Rate Mode
                  </div>
                  <p className="text-[11px] text-amber-200/90 leading-relaxed">
                    Custom rates are not matched against the verified CBIC tariff schedule. Confirm applicability with relevant GST Council notifications.
                  </p>
                  <div className="flex items-center gap-3 pt-1">
                    <label className="text-xs text-slate-300 font-semibold">Custom Rate (%):</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={customRate}
                      onChange={(e) => setCustomRate(e.target.value)}
                      className="w-24 rounded-lg border border-amber-500/50 bg-slate-900 px-3 py-1.5 text-xs text-white font-bold outline-none focus:border-amber-400"
                    />
                    <div className="flex gap-1.5">
                      {[0, 5, 12, 18, 28].map((slab) => (
                        <button
                          key={slab}
                          type="button"
                          onClick={() => setCustomRate(slab.toString())}
                          className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] text-slate-300 hover:text-white"
                        >
                          {slab}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Place of Supply (Source & Destination State) */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Supplier State (Place of Origin)
                  </label>
                  <select
                    value={sourceState}
                    onChange={(e) => setSourceState(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                  >
                    {indianStates.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Recipient State (Place of Supply)
                  </label>
                  <select
                    value={destState}
                    onChange={(e) => setDestState(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                  >
                    {indianStates.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Supply Jurisdiction Indicator */}
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <Building2 className="h-4 w-4 text-cyan-400" />
                  <span>
                    Supply Classification:{" "}
                    <strong className="text-white">
                      {transactionType === "sez" || transactionType === "export"
                        ? "Zero-Rated Supply"
                        : sourceState.toLowerCase().trim() === destState.toLowerCase().trim()
                        ? "Intra-State Supply (Same State)"
                        : "Inter-State Supply (Cross-Border)"}
                    </strong>
                  </span>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    transactionType === "sez" || transactionType === "export"
                      ? "border border-purple-500/30 bg-purple-500/10 text-purple-300"
                      : sourceState.toLowerCase().trim() === destState.toLowerCase().trim()
                      ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                  }`}
                >
                  {transactionType === "sez" || transactionType === "export"
                    ? "0% Tax"
                    : sourceState.toLowerCase().trim() === destState.toLowerCase().trim()
                    ? "CGST + SGST Split"
                    : "IGST Full"}
                </span>
              </div>
            </FloatingPanel>

            {/* Live Calculation Output Card (Right Column, 5 cols) */}
            <FloatingPanel className="lg:col-span-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <ReceiptIndianRupee className="h-4 w-4 text-cyan-400" />
                    Statutory GST Breakdown
                  </h3>
                  {gstLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-cyan-400" />
                  ) : gstResult?.is_verified_rate ? (
                    <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" />
                      CBIC Verified
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                      <AlertTriangle className="h-3 w-3" />
                      Unverified Rate
                    </span>
                  )}
                </div>

                {gstResult ? (
                  <div className="mt-4 space-y-3">
                    {/* Primary Payable Hero Banner */}
                    <div className="rounded-xl border border-cyan-400/30 bg-gradient-to-br from-cyan-950/40 via-slate-900 to-slate-900 p-4">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                        Total Invoice Payable
                      </span>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-white">
                          ₹{Number(gstResult.total_payable).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {gstResult.calculation_mode === "exclusive"
                          ? `Base Value: ₹${Number(gstResult.base_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })} + GST`
                          : `Gross Inclusive Amount: Tax extracted from ₹${Number(gstResult.total_payable).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
                      </p>
                    </div>

                    {/* Itemized Table */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-2.5 text-xs">
                      <div className="flex justify-between items-center text-slate-300">
                        <span>Taxable Base Value:</span>
                        <strong className="font-mono text-white">
                          ₹{Number(gstResult.base_amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </strong>
                      </div>

                      <div className="flex justify-between items-center text-slate-300">
                        <span>Applicable GST Rate:</span>
                        <span className="font-bold text-cyan-300">{gstResult.gst_rate}%</span>
                      </div>

                      <div className="border-t border-slate-800/80 my-1" />

                      {gstResult.is_inter_state ? (
                        <div className="flex justify-between items-center text-slate-300">
                          <span className="flex items-center gap-1">
                            IGST ({gstResult.igst_rate}%):
                            <span className="text-[10px] text-slate-500">(Inter-State)</span>
                          </span>
                          <strong className="font-mono text-cyan-300">
                            ₹{Number(gstResult.igst_amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </strong>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-center text-slate-300">
                            <span className="flex items-center gap-1">
                              Central GST (CGST {gstResult.cgst_rate}%):
                            </span>
                            <strong className="font-mono text-white">
                              ₹{Number(gstResult.cgst_amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </strong>
                          </div>
                          <div className="flex justify-between items-center text-slate-300">
                            <span className="flex items-center gap-1">
                              State GST (SGST {gstResult.sgst_rate}%):
                            </span>
                            <strong className="font-mono text-white">
                              ₹{Number(gstResult.sgst_amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </strong>
                          </div>
                        </>
                      )}

                      <div className="border-t border-slate-800/80 my-1" />

                      <div className="flex justify-between items-center text-xs font-bold text-slate-200">
                        <span>Total GST Liability:</span>
                        <span className="font-mono text-emerald-400">
                          ₹{Number(gstResult.total_tax).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Formula & Rule Source */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 space-y-1.5 text-[11px] text-slate-400">
                      <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                        <Info className="h-3.5 w-3.5 text-cyan-400" />
                        Rule Verification & Formula
                      </div>
                      <p className="font-mono text-[10px] text-slate-300">
                        {typeof gstResult.calculation_breakdown === "object" && gstResult.calculation_breakdown !== null
                          ? (gstResult.calculation_breakdown as Record<string, any>).formula || JSON.stringify(gstResult.calculation_breakdown)
                          : String(gstResult.calculation_breakdown || "")}
                      </p>
                      <p className="text-slate-400">
                        <strong className="text-slate-300">Authority:</strong> {gstResult.rule_source}
                      </p>
                      {gstResult.assumptions && gstResult.assumptions.length > 0 && (
                        <div className="pt-1">
                          <span className="text-slate-300 font-semibold">Statutory Assumptions:</span>
                          <ul className="list-disc pl-4 space-y-0.5 mt-0.5 text-slate-400 text-[10px]">
                            {gstResult.assumptions.map((asm, idx) => (
                              <li key={idx}>{asm}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-400">
                    <Calculator className="h-8 w-8 mx-auto text-slate-600 mb-2" />
                    <p className="text-xs">Enter a valid amount to calculate live GST liability.</p>
                  </div>
                )}
              </div>
            </FloatingPanel>
          </div>

          {/* GST Return Filing Tracker (Clean Honest State with Optional Demo Toggle) */}
          <FloatingPanel className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-cyan-400" />
                  Statutory GST Return Filing Status
                  {demoMode && (
                    <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold">
                      Demo data
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400">
                  Government portal integration status and scheduled filing deadlines.
                </p>
              </div>

              {/* Demo Mode Toggle */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">Demo Mode:</span>
                <button
                  type="button"
                  onClick={() => setDemoMode(!demoMode)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    demoMode ? "bg-cyan-500" : "bg-slate-700"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                      demoMode ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {demoMode ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                  <span>
                    <strong>DEMO MODE ENABLED:</strong> Below returns, dates, and statuses are sample demonstration records only. Audit V is not connected to any government GSTIN portal.
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-900/40">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="border-b border-slate-700/60 bg-slate-800/50 uppercase text-slate-400 font-bold">
                      <tr>
                        <th className="py-3 px-4">Return Form</th>
                        <th className="py-3 px-4">Period</th>
                        <th className="py-3 px-4">Statutory Due Date</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {DEMO_GST_FILINGS.map((row) => (
                        <tr key={row.form} className="hover:bg-slate-800/30 transition">
                          <td className="py-3 px-4 font-bold text-cyan-300 font-mono">{row.form}</td>
                          <td className="py-3 px-4 text-white">{row.period}</td>
                          <td className="py-3 px-4 text-slate-400">{row.dueDate}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border border-slate-700 bg-slate-800 text-slate-300">
                              <Clock className="h-3 w-3 text-amber-400" />
                              {row.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px]">{row.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Verified Honest Empty State */
              <div className="rounded-xl border border-dashed border-slate-700/80 bg-slate-900/30 p-8 text-center space-y-3">
                <FileCheck2 className="h-10 w-10 mx-auto text-slate-600" />
                <h4 className="text-sm font-bold text-white">No Live GSTIN Linked</h4>
                <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
                  To view live return filing statuses and portal ARNs, connect your GST Suvidha Provider (GSP) API credentials or use the GST Calculator above to compute invoice-level liabilities.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setDemoMode(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:border-cyan-400/40 hover:text-white transition"
                  >
                    View Sample Calendar in Demo Mode
                  </button>
                </div>
              </div>
            )}
          </FloatingPanel>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: INCOME TAX CALCULATOR (FY 2026-27 / AY 2027-28)              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "income_tax" && (
        <div className="space-y-6">
          <FloatingPanel className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-0.5 text-[10px] font-bold text-cyan-300 uppercase">
                    Tax Year 2026-27 (AY 2027-28)
                  </span>
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 uppercase">
                    Income Tax Act 2025 Slabs
                  </span>
                </div>
                <h2 className="mt-1 text-lg font-bold text-white flex items-center gap-2">
                  <ReceiptIndianRupee className="h-5 w-5 text-cyan-400" />
                  Personal Income Tax & Dual-Regime Optimizer
                </h2>
                <p className="text-xs text-slate-400">
                  Deterministic comparison between New Tax Regime (Section 115BAC / Section 202) and Old Tax Regime with Chapter VI-A deductions.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCalculateIncomeTax}
                disabled={itLoading}
                className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/25 hover:bg-cyan-400 transition"
              >
                {itLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Re-calculate
              </button>
            </div>

            {/* Income Tax Inputs */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Gross Annual Income (₹) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={incomeInput}
                  onChange={(e) => setIncomeInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-bold text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Taxpayer Age (Years)
                </label>
                <input
                  type="number"
                  min="18"
                  max="120"
                  value={taxpayerAge}
                  onChange={(e) => setTaxpayerAge(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Employment Type
                </label>
                <select
                  value={isSalaried ? "salaried" : "business"}
                  onChange={(e) => setIsSalaried(e.target.value === "salaried")}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                >
                  <option value="salaried">Salaried (Eligible for Standard Deduction)</option>
                  <option value="business">Non-Salaried / Professional / Business</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Sec 80C Deductions (Max ₹1.5L)
                </label>
                <input
                  type="number"
                  min="0"
                  max="150000"
                  value={sec80c}
                  onChange={(e) => setSec80c(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {/* Additional Deductions Foldout */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Sec 80D (Health Insurance)
                </label>
                <input
                  type="number"
                  min="0"
                  value={sec80d}
                  onChange={(e) => setSec80d(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Sec 80CCD(1B) (NPS Tier 1)
                </label>
                <input
                  type="number"
                  min="0"
                  max="50000"
                  value={sec80ccd}
                  onChange={(e) => setSec80ccd(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  HRA Exemption (Sec 10(13A))
                </label>
                <input
                  type="number"
                  min="0"
                  value={hraExempt}
                  onChange={(e) => setHraExempt(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Other Deductions (80E, 80G, etc.)
                </label>
                <input
                  type="number"
                  min="0"
                  value={otherDeductions}
                  onChange={(e) => setOtherDeductions(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {itError && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{itError}</span>
              </div>
            )}

            {/* Income Tax Side-by-Side Comparison Output */}
            {itResult && (() => {
              const isNewRecommended = Boolean(
                itResult.recommended_regime?.toLowerCase().includes("new") ||
                itResult.recommended_regime?.toLowerCase().includes("115bac")
              );
              return (
                <div className="space-y-4 pt-2">
                  {/* Recommendation Banner */}
                  <div className="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-emerald-300">
                          Recommended: {isNewRecommended ? "New Tax Regime (Section 115BAC)" : "Old Tax Regime"}
                        </h4>
                        <p className="text-xs text-emerald-200/80">
                          {Number(itResult.tax_savings) > 0
                            ? `Switching regimes saves you ₹${Number(itResult.tax_savings).toLocaleString("en-IN", { maximumFractionDigits: 0 })} in tax payable this year.`
                            : "Both regimes result in equal or zero tax liability."}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/20 px-3 py-1 font-mono text-xs font-bold text-emerald-300">
                      Saves ₹{Number(itResult.tax_savings).toLocaleString("en-IN")}
                    </span>
                  </div>

                  {/* Slabs Grid */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {/* New Regime Card */}
                    <div
                      className={`rounded-xl border p-4 space-y-3 ${
                        isNewRecommended
                          ? "border-cyan-400/50 bg-cyan-950/20 shadow-md shadow-cyan-500/10"
                          : "border-slate-800 bg-slate-900/60"
                      }`}
                    >
                      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                        <div>
                          <h4 className="text-sm font-bold text-white">New Tax Regime</h4>
                          <span className="text-[10px] text-slate-400">Section 115BAC / Sec 202 IT Act 2025</span>
                        </div>
                        <span className="rounded-full bg-cyan-500/20 border border-cyan-500/30 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                          Default
                        </span>
                      </div>

                      {itResult.new_regime && (
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between text-slate-300">
                            <span>Gross Income:</span>
                            <span className="font-mono text-white">₹{Number(itResult.new_regime.gross_income).toLocaleString("en-IN")}</span>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>Standard Deduction:</span>
                            <span className="font-mono text-emerald-400">-₹{Number(itResult.new_regime.standard_deduction).toLocaleString("en-IN")}</span>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>Net Taxable Income:</span>
                            <span className="font-mono text-white">₹{Number(itResult.new_regime.taxable_income).toLocaleString("en-IN")}</span>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>Slab Tax Calculated:</span>
                            <span className="font-mono text-white">₹{Number(itResult.new_regime.slab_tax).toLocaleString("en-IN")}</span>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>Sec 87A Rebate:</span>
                            <span className="font-mono text-emerald-400">-₹{Number(itResult.new_regime.section_87a_rebate).toLocaleString("en-IN")}</span>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>Health & Education Cess (4%):</span>
                            <span className="font-mono text-white">₹{Number(itResult.new_regime.cess).toLocaleString("en-IN")}</span>
                          </div>
                          <div className="border-t border-slate-800 pt-2 flex justify-between items-center text-sm font-bold text-white">
                            <span>Total Tax Payable:</span>
                            <span className="font-mono text-cyan-300 text-base">
                              ₹{Number(itResult.new_regime.total_tax_payable).toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Old Regime Card */}
                    <div
                      className={`rounded-xl border p-4 space-y-3 ${
                        !isNewRecommended
                          ? "border-cyan-400/50 bg-cyan-950/20 shadow-md shadow-cyan-500/10"
                          : "border-slate-800 bg-slate-900/60"
                      }`}
                    >
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <div>
                        <h4 className="text-sm font-bold text-white">Old Tax Regime</h4>
                        <span className="text-[10px] text-slate-400">Chapter VI-A Deductions Allowed</span>
                      </div>
                      <span className="rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                        Optional
                      </span>
                    </div>

                    {itResult.old_regime && (
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between text-slate-300">
                          <span>Gross Income:</span>
                          <span className="font-mono text-white">₹{Number(itResult.old_regime.gross_income).toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>Standard Deduction:</span>
                          <span className="font-mono text-emerald-400">-₹{Number(itResult.old_regime.standard_deduction).toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>Total Chapter VI-A Deductions:</span>
                          <span className="font-mono text-emerald-400">-₹{Number(itResult.old_regime.total_deductions).toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>Net Taxable Income:</span>
                          <span className="font-mono text-white">₹{Number(itResult.old_regime.taxable_income).toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>Sec 87A Rebate:</span>
                          <span className="font-mono text-emerald-400">-₹{Number(itResult.old_regime.section_87a_rebate).toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>Health & Education Cess (4%):</span>
                          <span className="font-mono text-white">₹{Number(itResult.old_regime.cess).toLocaleString("en-IN")}</span>
                        </div>
                        <div className="border-t border-slate-800 pt-2 flex justify-between items-center text-sm font-bold text-white">
                          <span>Total Tax Payable:</span>
                          <span className="font-mono text-amber-300 text-base">
                            ₹{Number(itResult.old_regime.total_tax_payable).toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {(itResult as any).breakdown_notes && (itResult as any).breakdown_notes.length > 0 && (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 space-y-1 text-xs text-slate-400">
                    <span className="font-semibold text-slate-300">Statutory Notes:</span>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-400">
                      {(itResult as any).breakdown_notes.map((n: string, i: number) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ); })()}
          </FloatingPanel>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: STATUTORY SECTION GUIDE                                      */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "statutory" && (
        <FloatingPanel className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ReceiptIndianRupee className="h-4 w-4 text-cyan-400" />
                Statutory Section & Regulatory Index
              </h3>
              <p className="text-xs text-slate-400">
                Authoritative reference lookup for Income Tax Act 1961/2025 and CGST/IGST Act provisions.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                {["ALL", "Old Regime", "New Regime", "TDS / TCS", "GST Statutory"].map((cat) => (
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
                  placeholder="Search 80C, 194C, 115BAC..."
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
                  <span className="text-slate-400">Statutory Cap / Rate:</span>
                  <strong className="text-emerald-400">{sec.limit}</strong>
                </div>
              </div>
            ))}
          </div>
        </FloatingPanel>
      )}
    </div>
  );
}
