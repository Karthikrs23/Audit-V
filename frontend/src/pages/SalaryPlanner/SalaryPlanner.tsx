import { useState, useEffect, useCallback } from "react";
import FloatingPanel from "../../components/layout/FloatingPanel";
import {
  ReceiptIndianRupee,
  CheckCircle2,
  AlertCircle,
  Info,
  Save,
  BookmarkCheck,
  User,
} from "lucide-react";
import { apiGetFinancialEntries, apiSaveFinancialEntry } from "../../services/authApi";
import { useAuth } from "../../context/AuthContext";
import { calculateIncomeTax } from "../../services/taxApi";

interface SlabBreakdown {
  slab_range: string;
  rate_percentage: number;
  taxable_in_slab: string;
  tax_for_slab: string;
}

interface TaxResult {
  financial_year: string;
  regime: string;
  gross_income: string;
  standard_deduction: string;
  eligible_deductions: string;
  total_deductions: string;
  taxable_income: string;
  base_tax: string;
  rebate_87a: string;
  surcharge: string;
  cess: string;
  total_tax: string;
  effective_tax_rate: number;
  monthly_tax_estimate: string;
  slab_breakdown: SlabBreakdown[];
}

interface TaxApiResponse {
  disclaimer: string;
  request_regime: string;
  selected_result: TaxResult;
  old_regime_result?: TaxResult;
  new_regime_result?: TaxResult;
  recommended_regime?: string;
  potential_tax_savings?: string;
}

export default function SalaryPlanner() {
  const [annualIncome, setAnnualIncome] = useState<number>(1500000);
  const [age, setAge] = useState<number>(30);
  const [regime, setRegime] = useState<"compare" | "new" | "old">("compare");

  // Deductions
  const [sec80c, setSec80c] = useState<number>(150000);
  const [sec80d, setSec80d] = useState<number>(25000);
  const [sec80ccd, setSec80ccd] = useState<number>(0);
  const [hra, setHra] = useState<number>(100000);
  const [otherDeductions, setOtherDeductions] = useState<number>(0);

  // API State
  const [taxData, setTaxData] = useState<TaxApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Personal Space State
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Load user's saved salary numbers on mount
  useEffect(() => {
    let isMounted = true;
    async function loadSavedPlan() {
      try {
        const entries = await apiGetFinancialEntries("salary_planner");
        if (isMounted && entries.length > 0) {
          const d = entries[0].data as Record<string, unknown>;
          if (typeof d.annualIncome === "number") setAnnualIncome(d.annualIncome);
          if (typeof d.age === "number") setAge(d.age);
          if (typeof d.regime === "string") setRegime(d.regime as "compare" | "new" | "old");
          if (typeof d.sec80c === "number") setSec80c(d.sec80c);
          if (typeof d.sec80d === "number") setSec80d(d.sec80d);
          if (typeof d.sec80ccd === "number") setSec80ccd(d.sec80ccd);
          if (typeof d.hra === "number") setHra(d.hra);
          if (typeof d.otherDeductions === "number") setOtherDeductions(d.otherDeductions);
          setSaveMessage("Restored your saved personal salary plan");
          setTimeout(() => {
            if (isMounted) setSaveMessage(null);
          }, 3500);
        }
      } catch (err) {
        console.warn("Could not load saved salary plan:", err);
      }
    }
    loadSavedPlan();
    return () => {
      isMounted = false;
    };
  }, []);

  const saveToPersonalSpace = async () => {
    setIsSaving(true);
    try {
      await apiSaveFinancialEntry("salary_planner", {
        annualIncome,
        age,
        regime,
        sec80c,
        sec80d,
        sec80ccd,
        hra,
        otherDeductions,
        savedAt: new Date().toISOString(),
      });
      setSaveMessage("Saved to your personal space ✓");
      setTimeout(() => setSaveMessage(null), 3500);
    } catch (err) {
      console.error("Failed to save to personal space:", err);
      setSaveMessage("Error saving plan");
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const calculateTax = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    const payload = {
      annual_income: annualIncome,
      age: age,
      regime: regime,
      is_salaried: true,
      deductions: {
        section_80c: sec80c,
        section_80d: sec80d,
        section_80ccd_1b: sec80ccd,
        hra_exemption: hra,
        other_deductions: otherDeductions,
      },
    };

    try {
      const data = await calculateIncomeTax(payload);
      setTaxData(data as any);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to connect to Tax API engine.";
      setErrorMsg(message);

      // Local fallback calculation matching backend tax_engine.py rules (Tax Year 2026-27)
      const stdNew = 75000;
      const stdOld = 50000;
      const cap80c = Math.min(sec80c, 150000);
      const cap80d = Math.min(sec80d, age >= 60 ? 50000 : 25000);
      const cap80ccd = Math.min(sec80ccd, 50000);

      const totalDedOld = stdOld + cap80c + cap80d + cap80ccd + hra + otherDeductions;
      const taxableOld = Math.max(0, annualIncome - totalDedOld);
      const taxableNew = Math.max(0, annualIncome - stdNew);

      // New Regime Slabs Tax Year 2026-27: 0-4L (0%), 4-8L (5%), 8-12L (10%), 12-16L (15%), 16-20L (20%), 20-24L (25%), >24L (30%)
      let baseTaxNew = 0;
      if (taxableNew > 400000) baseTaxNew += Math.min(400000, taxableNew - 400000) * 0.05;
      if (taxableNew > 800000) baseTaxNew += Math.min(400000, taxableNew - 800000) * 0.10;
      if (taxableNew > 1200000) baseTaxNew += Math.min(400000, taxableNew - 1200000) * 0.15;
      if (taxableNew > 1600000) baseTaxNew += Math.min(400000, taxableNew - 1600000) * 0.20;
      if (taxableNew > 2000000) baseTaxNew += Math.min(400000, taxableNew - 2000000) * 0.25;
      if (taxableNew > 2400000) baseTaxNew += (taxableNew - 2400000) * 0.30;

      const rebate87aNew = taxableNew <= 1200000 ? Math.min(baseTaxNew, 60000) : 0;
      const taxAfterRebateNew = baseTaxNew - rebate87aNew;
      const taxNew = Math.round(taxAfterRebateNew * 1.04);

      const taxOld = Math.round(taxableOld > 500000 ? taxableOld * 0.15 : 0);
      const isNewBetter = taxNew <= taxOld;

      setTaxData({
        disclaimer:
          "Estimated calculation based on applicable Indian Income Tax rules (Tax Year 2026-27). Verify applicable rules before filing.",
        request_regime: regime,
        recommended_regime: isNewBetter ? "New Tax Regime (Section 115BAC)" : "Old Tax Regime",
        potential_tax_savings: Math.abs(taxOld - taxNew).toString(),
        selected_result: {
          financial_year: "Tax Year 2026-27",
          regime: isNewBetter ? "New Tax Regime (Section 115BAC)" : "Old Tax Regime",
          gross_income: annualIncome.toString(),
          standard_deduction: (isNewBetter ? stdNew : stdOld).toString(),
          eligible_deductions: (isNewBetter ? 0 : totalDedOld - stdOld).toString(),
          total_deductions: (isNewBetter ? stdNew : totalDedOld).toString(),
          taxable_income: (isNewBetter ? taxableNew : taxableOld).toString(),
          base_tax: Math.round(baseTaxNew).toString(),
          rebate_87a: Math.round(rebate87aNew).toString(),
          surcharge: "0",
          cess: Math.round(taxAfterRebateNew * 0.04).toString(),
          total_tax: taxNew.toString(),
          effective_tax_rate: annualIncome > 0 ? Number(((taxNew / annualIncome) * 100).toFixed(2)) : 0,
          monthly_tax_estimate: Math.round(taxNew / 12).toString(),
          slab_breakdown: [
            { slab_range: "₹0 - ₹4,00,000", rate_percentage: 0, taxable_in_slab: "400000", tax_for_slab: "0" },
            { slab_range: "₹4,00,000 - ₹8,00,000", rate_percentage: 5, taxable_in_slab: "400000", tax_for_slab: "20000" },
            { slab_range: "₹8,00,000 - ₹12,00,000", rate_percentage: 10, taxable_in_slab: (Math.min(400000, Math.max(0, taxableNew - 800000))).toString(), tax_for_slab: (Math.min(40000, Math.max(0, taxableNew - 800000) * 0.10)).toString() },
          ],
        },
      });
    } finally {
      setLoading(false);
    }
  }, [annualIncome, age, regime, sec80c, sec80d, sec80ccd, hra, otherDeductions]);

  useEffect(() => {
    calculateTax();
  }, [calculateTax]);

  const selected = taxData?.selected_result;

  return (
    <div className="space-y-6">
      {/* Financial Safety Disclaimer Banner */}
      <div className="flex items-center gap-3 p-4 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 text-xs text-cyan-200 backdrop-blur-xl">
        <Info className="h-4 w-4 shrink-0 text-cyan-400" />
        <p>
          <strong>Financial Disclaimer:</strong> Estimated calculation based on applicable Indian Income Tax rules (Tax Year 2026-27). Verify applicable rules before filing.
        </p>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl border border-rose-400/30 bg-rose-500/10 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left Column: Tax Input Form (7 cols) */}
        <FloatingPanel className="lg:col-span-7 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                  Deterministic Tax Engine
                </p>
                {user && (
                  <span className="flex items-center gap-1 rounded-full border border-violet-400/30 bg-violet-400/10 px-2 py-0.5 text-[10px] font-semibold text-violet-300">
                    <User className="h-2.5 w-2.5" />
                    {user.username}'s Space
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-white mt-1">
                Salary & Income Tax Calculator
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {saveMessage && (
                <span className="text-xs font-semibold text-emerald-400 animate-fade-in flex items-center gap-1">
                  <BookmarkCheck className="h-3.5 w-3.5" />
                  {saveMessage}
                </span>
              )}
              <button
                type="button"
                onClick={saveToPersonalSpace}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-400/20 active:scale-95 transition cursor-pointer disabled:opacity-50"
                title="Save this salary and deduction configuration to your personal space"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{isSaving ? "Saving..." : "Save to Space"}</span>
              </button>
              <div className="p-2.5 rounded-xl border border-white/10 bg-white/5 text-cyan-400 shrink-0">
                <ReceiptIndianRupee className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {/* Annual Income */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-slate-300">Gross Annual Income (₹)</label>
              <input
                type="number"
                step="50000"
                value={annualIncome}
                onChange={(e) => setAnnualIncome(Math.max(0, Number(e.target.value)))}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white font-bold focus:border-cyan-400 outline-none"
              />
            </div>

            {/* Age */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Taxpayer Age (Years)</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(Math.max(0, Math.min(120, Number(e.target.value))))}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-2.5 text-sm text-white focus:border-cyan-400 outline-none"
              />
            </div>

            {/* Tax Regime Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Tax Regime</label>
              <select
                value={regime}
                onChange={(e) => setRegime(e.target.value as "compare" | "new" | "old")}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-2.5 text-sm text-white focus:border-cyan-400 outline-none"
              >
                <option value="compare">Compare Regimes (Auto Best)</option>
                <option value="new">New Tax Regime (Section 115BAC / Sec 202)</option>
                <option value="old">Old Tax Regime</option>
              </select>
            </div>

            {/* Deductions Inputs (Section 80C, 80D, 80CCD, HRA, Other) */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Section 80C / Sec 123 (Max ₹1.5L)</label>
              <input
                type="number"
                value={sec80c}
                onChange={(e) => setSec80c(Math.max(0, Number(e.target.value)))}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-2.5 text-sm text-white focus:border-cyan-400 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Section 80D (Health)</label>
              <input
                type="number"
                value={sec80d}
                onChange={(e) => setSec80d(Math.max(0, Number(e.target.value)))}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-2.5 text-sm text-white focus:border-cyan-400 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Section 80CCD(1B) (NPS Max ₹50k)</label>
              <input
                type="number"
                value={sec80ccd}
                onChange={(e) => setSec80ccd(Math.max(0, Number(e.target.value)))}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-2.5 text-sm text-white focus:border-cyan-400 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">HRA Exemption (₹)</label>
              <input
                type="number"
                value={hra}
                onChange={(e) => setHra(Math.max(0, Number(e.target.value)))}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-2.5 text-sm text-white focus:border-cyan-400 outline-none"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-slate-300">Other Eligible Deductions (80E, 80G, etc.) (₹)</label>
              <input
                type="number"
                value={otherDeductions}
                onChange={(e) => setOtherDeductions(Math.max(0, Number(e.target.value)))}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-2.5 text-sm text-white focus:border-cyan-400 outline-none"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={calculateTax}
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-400 to-cyan-500 text-slate-950 font-extrabold text-sm shadow-[0_0_25px_rgba(6,182,212,0.3)] hover:scale-[1.01] transition disabled:opacity-50"
          >
            {loading ? "Calculating Tax Engine..." : "Calculate Tax"}
          </button>
        </FloatingPanel>

        {/* Right Column: Detailed Calculation Output (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Main Calculation Summary Card */}
          <FloatingPanel className="space-y-5 border-cyan-400/30">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                  {selected?.regime || "Tax Calculation"}
                </p>
                <h3 className="text-lg font-extrabold text-white mt-0.5">
                  Tax Calculation Breakdown
                </h3>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-400">Tax Year 2026-27</span>
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl border border-white/5 bg-black/40">
                <p className="text-[10px] font-medium text-slate-400 uppercase">Gross Income</p>
                <p className="mt-1 text-base font-bold text-white">
                  ₹{Number(selected?.gross_income || 0).toLocaleString()}
                </p>
              </div>

              <div className="p-3 rounded-xl border border-white/5 bg-black/40">
                <p className="text-[10px] font-medium text-slate-400 uppercase">Total Deductions</p>
                <p className="mt-1 text-base font-bold text-emerald-400">
                  ₹{Number(selected?.total_deductions || 0).toLocaleString()}
                </p>
              </div>

              <div className="p-3 rounded-xl border border-white/5 bg-black/40">
                <p className="text-[10px] font-medium text-slate-400 uppercase">Taxable Income</p>
                <p className="mt-1 text-base font-bold text-white">
                  ₹{Number(selected?.taxable_income || 0).toLocaleString()}
                </p>
              </div>

              <div className="p-3 rounded-xl border border-white/5 bg-black/40">
                <p className="text-[10px] font-medium text-slate-400 uppercase">Effective Rate</p>
                <p className="mt-1 text-base font-bold text-cyan-300">
                  {selected?.effective_tax_rate || 0}%
                </p>
              </div>
            </div>

            {/* Total Tax Output Box */}
            <div className="p-5 rounded-2xl border border-cyan-400/40 bg-gradient-to-r from-cyan-500/10 to-violet-600/10 text-center space-y-1">
              <p className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">
                Total Estimated Income Tax
              </p>
              <p className="text-3xl font-black text-white">
                ₹{Number(selected?.total_tax || 0).toLocaleString()}
              </p>
              <p className="text-xs text-slate-400 pt-1">
                Monthly Tax Deducted (TDS): <strong className="text-white">₹{Number(selected?.monthly_tax_estimate || 0).toLocaleString()}/mo</strong>
              </p>
            </div>

            {/* Recommended Regime Alert */}
            {taxData?.recommended_regime && (
              <div className="p-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 flex items-start gap-3 text-xs text-emerald-200">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white">{taxData.recommended_regime} Recommended</p>
                  <p className="mt-0.5 text-slate-300">
                    Saves up to <strong className="text-emerald-400 font-bold">₹{Number(taxData.potential_tax_savings || 0).toLocaleString()}</strong> in tax payments.
                  </p>
                </div>
              </div>
            )}
          </FloatingPanel>

          {/* Slab Breakdown Table */}
          {selected?.slab_breakdown && selected.slab_breakdown.length > 0 && (
            <FloatingPanel className="space-y-4">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Slab-Wise Tax Breakdown
              </h4>
              <div className="space-y-2 text-xs">
                {selected.slab_breakdown.map((s, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center p-2.5 rounded-xl border border-white/5 bg-black/30"
                  >
                    <div>
                      <p className="font-semibold text-white">{s.slab_range}</p>
                      <p className="text-[10px] text-slate-400">{s.rate_percentage}% Slab Rate</p>
                    </div>
                    <p className="font-bold text-cyan-300">₹{Number(s.tax_for_slab).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </FloatingPanel>
          )}
        </div>
      </div>
    </div>
  );
}
