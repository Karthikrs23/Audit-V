import { Bell, Search, Sparkles } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "../components/sidebar/Sidebar";
import GlobalBackground from "../components/layout/GlobalBackground";

interface MainLayoutProps {
  children: ReactNode;
}

const PAGE_TITLES: Record<string, { category: string; title: string }> = {
  "/dashboard": { category: "Overview", title: "Financial Command Center" },
  "/ai-assistant": { category: "Intelligence", title: "AI Tax & Financial Assistant" },
  "/market": { category: "Analytics", title: "Market Intelligence Hub" },
  "/banking": { category: "Accounts", title: "Banking & Financial Feeds" },
  "/investments": { category: "Portfolio", title: "Investment Tracker" },
  "/salary-tax": { category: "Optimization", title: "Salary & Tax Optimizer" },
  "/tax": { category: "Compliance", title: "Tax & GST Compliance Engine" },
  "/financial-analysis": { category: "Reports", title: "Financial Analysis & Cashflow" },
  "/risk-fraud": { category: "Security", title: "Risk & Fraud Anomaly Detection" },
  "/documents": { category: "Vault", title: "Document & Invoice Storage" },
  "/settings": { category: "System", title: "Application Settings" },
};

export default function MainLayout({ children }: MainLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const currentPage = PAGE_TITLES[location.pathname] || {
    category: "Audit V",
    title: "Financial Intelligence Workspace",
  };

  return (
    <div className="relative min-h-screen text-slate-100 flex flex-col font-sans antialiased overflow-x-hidden">
      {/* 1. PERSISTENT FULL-SCREEN 3D GLOBE VISUAL ENVIRONMENT LAYER */}
      <GlobalBackground />

      {/* 2. FIXED FLOATING GLASS SIDEBAR */}
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
      />

      {/* 3. MAIN FLOATING WORKSPACE CONTAINER */}
      <div
        className={`
          relative z-20 flex-1 flex flex-col min-h-screen
          transition-all duration-300 ease-in-out
          ${collapsed ? "ml-[76px]" : "ml-[260px]"}
        `}
      >
        {/* FLOATING TOP NAVBAR */}
        <header className="sticky top-0 z-30 flex h-[76px] shrink-0 items-center justify-between border-b border-white/10 bg-[#030712]/75 px-6 lg:px-8 backdrop-blur-2xl">
          {/* Left: Page Title & Category */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400">
              {currentPage.category}
            </p>
            <h2 className="text-lg font-bold text-white tracking-tight leading-tight">
              {currentPage.title}
            </h2>
          </div>

          {/* Right: Actions & Tools */}
          <div className="flex items-center gap-3.5">
            {/* Search Bar */}
            <div className="hidden sm:flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 transition focus-within:border-cyan-400/40 focus-within:bg-white/[0.05]">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Ask Audit V..."
                className="w-44 md:w-56 bg-transparent text-xs text-white outline-none placeholder:text-slate-500"
              />
              <kbd className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                ⌘K
              </kbd>
            </div>

            {/* Notifications Button */}
            <button
              type="button"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-300 transition hover:border-cyan-400/30 hover:bg-white/[0.06] hover:text-white"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]" />
            </button>

            {/* AI Status Badge */}
            <div className="flex h-10 items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3.5 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
              </span>
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-semibold tracking-wide hidden md:inline">
                AI Online
              </span>
            </div>

            {/* User Profile Avatar */}
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-cyan-500/20 to-violet-600/30 text-sm font-bold text-cyan-200 shadow-md">
              K
            </div>
          </div>
        </header>

        {/* ROUTED PAGE CONTENT */}
        <main className="flex-1 p-6 lg:p-8 space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}