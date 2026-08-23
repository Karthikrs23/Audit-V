import FloatingPanel from "../../components/layout/FloatingPanel";
import {
  ArrowUpRight,
  Bot,
  ChartNoAxesCombined,
  CircleDollarSign,
  FileCheck2,
  ShieldCheck,
  TrendingUp,
  Sparkles,
} from "lucide-react";

const stats = [
  {
    title: "Financial Health",
    value: "89",
    suffix: "/100",
    description: "Excellent rating",
    icon: ShieldCheck,
    trend: "+4.8%",
  },
  {
    title: "Market Overview",
    value: "+2.34%",
    description: "Positive momentum",
    icon: TrendingUp,
    trend: "Today",
  },
  {
    title: "Tax Compliance",
    value: "94%",
    description: "High compliance score",
    icon: FileCheck2,
    trend: "+6.0%",
  },
  {
    title: "Portfolio",
    value: "₹18.4L",
    description: "Current net asset value",
    icon: CircleDollarSign,
    trend: "+8.2%",
  },
];

export default function Dashboard() {
  return (
    <div className="space-y-8 relative">
      {/* =====================================================
          1. FLOATING WELCOME GLASS PANEL
      ====================================================== */}
      <FloatingPanel className="overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-1.5 text-xs font-semibold text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
            <Bot className="h-4 w-4 text-cyan-400 animate-pulse" />
            <span>Audit V Intelligence</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.12]">
            Your financial world,{" "}
            <span className="block bg-gradient-to-r from-cyan-300 via-cyan-400 to-violet-400 bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(6,182,212,0.35)]">
              intelligently connected.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal max-w-2xl">
            Monitor your financial health, understand markets, optimize taxes and get AI-powered insights from your persistent global intelligence workspace.
          </p>

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="button"
              className="group inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-cyan-500 px-7 py-3.5 text-sm font-bold text-slate-950 shadow-[0_0_30px_rgba(6,182,212,0.35)] transition-all duration-300 hover:scale-105 hover:from-cyan-300 hover:to-cyan-400 hover:shadow-[0_0_40px_rgba(6,182,212,0.5)]"
            >
              <span>Ask Audit V</span>
              <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          </div>
        </div>
      </FloatingPanel>

      {/* =====================================================
          2. FLOATING FINANCIAL STAT CARDS GRID
      ====================================================== */}
      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4 relative z-10">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <FloatingPanel
              key={stat.title}
              className="group !p-6 hover:-translate-y-1 hover:border-cyan-400/30 hover:shadow-[0_10px_30px_rgba(6,182,212,0.12)]"
            >
              <div className="flex items-center justify-between">
                <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-300">
                  <Icon className="h-5 w-5" />
                </div>

                <span className="inline-flex items-center rounded-full bg-emerald-400/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-400/20">
                  {stat.trend}
                </span>
              </div>

              <p className="mt-5 text-xs font-medium uppercase tracking-wider text-slate-400">
                {stat.title}
              </p>

              <div className="mt-1 flex items-baseline gap-1 text-3xl font-extrabold text-white">
                {stat.value}
                {stat.suffix && (
                  <span className="text-sm font-normal text-slate-400">
                    {stat.suffix}
                  </span>
                )}
              </div>

              <p className="mt-1 text-xs text-slate-400">
                {stat.description}
              </p>
            </FloatingPanel>
          );
        })}
      </section>

      {/* =====================================================
          3. LOWER DASHBOARD (MARKET INTELLIGENCE & AI INSIGHT)
      ====================================================== */}
      <section className="grid gap-6 lg:grid-cols-3 relative z-10">
        {/* Market Intelligence Panel */}
        <FloatingPanel className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                Market Intelligence
              </p>
              <h2 className="mt-1 text-xl font-bold text-white">
                Live Market Overview
              </h2>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-cyan-400">
              <ChartNoAxesCombined className="h-5 w-5" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["NIFTY 50", "24,850", "+1.24%"],
              ["SENSEX", "81,920", "+0.92%"],
              ["GOLD", "₹7,180", "+0.48%"],
              ["BTC", "$64,820", "+2.16%"],
            ].map(([name, value, change]) => (
              <div
                key={name}
                className="rounded-xl border border-white/5 bg-black/40 p-4 transition hover:border-cyan-400/20 hover:bg-black/60"
              >
                <p className="text-xs font-medium text-slate-400">{name}</p>
                <p className="mt-2 text-lg font-bold text-white">{value}</p>
                <p className="mt-1 text-xs font-medium text-emerald-400">{change}</p>
              </div>
            ))}
          </div>
        </FloatingPanel>

        {/* AI Insight Floating Panel */}
        <FloatingPanel className="border-cyan-400/20 bg-gradient-to-br from-cyan-500/[0.08] via-violet-600/[0.08] to-transparent flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-3 text-cyan-300">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                  AI Insight
                </p>
                <p className="text-xs text-slate-400">
                  Audit V Engine
                </p>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-slate-200 pt-2">
              Your overall tax compliance and financial health are trending positively. Consider reviewing your tax-saving deductions under Section 80C before the quarter end.
            </p>
          </div>

          <button
            type="button"
            className="mt-6 w-full rounded-xl border border-cyan-400/30 bg-cyan-400/10 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/20 hover:text-white"
          >
            Ask AI for details
          </button>
        </FloatingPanel>
      </section>
    </div>
  );
}