import { Sparkles, TrendingUp, X } from "lucide-react";
import type { CountryData } from "./types";

interface GlobeInfoCardProps {
  country: CountryData;
  isPinned?: boolean;
  onClose?: () => void;
}

export default function GlobeInfoCard({
  country,
  isPinned = false,
  onClose,
}: GlobeInfoCardProps) {
  return (
    <div className="absolute right-4 top-4 z-30 w-72 sm:w-80 rounded-2xl border border-cyan-400/30 bg-[#030712]/90 p-5 backdrop-blur-2xl shadow-[0_0_40px_rgba(6,182,212,0.15)] transition-all duration-300 animate-in fade-in slide-in-from-top-2">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 font-bold text-xs">
            {country.code}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              {country.country}
            </h3>
            <p className="text-[10px] font-medium text-cyan-400 uppercase tracking-widest">
              {country.currencySymbol} {country.currency}
            </p>
          </div>
        </div>

        {isPinned && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Details Grid */}
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        {/* Population */}
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2.5">
          <p className="text-[10px] font-medium text-slate-400 uppercase">Population</p>
          <p className="mt-1 font-bold text-white">{country.population}</p>
        </div>

        {/* Primary Market */}
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2.5">
          <p className="text-[10px] font-medium text-slate-400 uppercase">Primary Market</p>
          <p className="mt-1 font-bold text-white truncate">{country.primaryMarket}</p>
        </div>

        {/* Market Value */}
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2.5">
          <p className="text-[10px] font-medium text-slate-400 uppercase">Market Index</p>
          <p className="mt-1 font-bold text-white">{country.marketValue}</p>
        </div>

        {/* Market Status */}
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2.5">
          <p className="text-[10px] font-medium text-slate-400 uppercase">Status</p>
          <p className="mt-1 flex items-center gap-1 font-bold text-emerald-400">
            <TrendingUp className="h-3 w-3" />
            <span>{country.marketChange}</span>
          </p>
        </div>
      </div>

      {/* Financial Activity Meter */}
      <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-cyan-400" />
            Financial Activity
          </span>
          <span className="font-bold text-cyan-300">{country.financialActivity}%</span>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 transition-all duration-500"
            style={{ width: `${country.financialActivity}%` }}
          />
        </div>
      </div>
    </div>
  );
}
