import { Bell, Sparkles, Lock, Unlock, ShieldAlert, LogOut, User } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Sidebar from "../components/sidebar/Sidebar";
import GlobalBackground from "../components/layout/GlobalBackground";
import VoiceHeaderAssistant from "../components/voice/VoiceHeaderAssistant";
import { useAuth } from "../context/AuthContext";

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
  const [isLocked, setIsLocked] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Derive user initials for avatar
  const initials = user
    ? (user.full_name ?? user.username)
        .split(" ")
        .map((w) => w[0]?.toUpperCase())
        .slice(0, 2)
        .join("")
    : "?";

  // Close user menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  // Keep digital clock updated for lock screen
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Global single-key shortcuts: 'M' opens AI Assistant, 'L' locks screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If screen is currently locked, allow unlocking with Escape or Enter
      if (isLocked) {
        if (e.key === "Escape" || e.key === "Enter") {
          e.preventDefault();
          setIsLocked(false);
        }
        return;
      }

      // Do NOT trigger single key shortcuts if user is typing inside an input/textarea/editable field
      const target = e.target as HTMLElement | null;
      const isInputActive =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (isInputActive) {
        return;
      }

      // If user holds Ctrl, Alt, or Meta, skip to avoid interfering with system shortcuts
      if (e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      // Single Key 'L' -> Lock Screen
      if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        setIsLocked(true);
        return;
      }

      // Single Key 'M' -> Open AI Assistant & focus chat input
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        navigate("/ai-assistant");
        setTimeout(() => {
          const inputElem = document.getElementById("ai-assistant-chat-input") as HTMLInputElement | null;
          if (inputElem) {
            inputElem.focus();
            inputElem.select();
          }
        }, 60);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate, isLocked]);

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
            {/* Integrated Voice Assistant & Search Bar */}
            <VoiceHeaderAssistant />

            {/* Notifications Button */}
            <button
              type="button"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-300 transition hover:border-cyan-400/30 hover:bg-white/[0.06] hover:text-white"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]" />
            </button>

            {/* Quick Lock Button (Shortcut: L) */}
            <button
              type="button"
              onClick={() => setIsLocked(true)}
              className="flex h-10 items-center gap-2 rounded-xl border border-slate-700/60 bg-white/[0.03] px-3 text-slate-300 transition hover:border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-300"
              title="Lock Screen Workspace (Shortcut: L)"
            >
              <Lock className="h-4 w-4" />
              <span className="text-xs font-semibold hidden xl:inline">Lock</span>
              <kbd className="hidden lg:inline-flex items-center rounded border border-white/15 bg-black/40 px-1.5 py-0.5 text-[10px] font-mono text-slate-300 shadow-sm">
                L
              </kbd>
            </button>

            {/* AI Intelligence Quick Navigation & Status Badge */}
            <button
              type="button"
              onClick={() => navigate("/ai-assistant")}
              className="flex h-10 items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3.5 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.1)] hover:bg-cyan-400/20 hover:border-cyan-400/50 transition cursor-pointer"
              title="Open AI Intelligence Chatbot (Shortcut: M)"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
              </span>
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-semibold tracking-wide hidden md:inline">
                AI Intelligence
              </span>
              <kbd className="hidden lg:inline-flex items-center rounded border border-cyan-400/30 bg-cyan-950/60 px-1.5 py-0.5 text-[10px] font-mono text-cyan-300 shadow-sm">
                M
              </kbd>
            </button>

            {/* User Profile Avatar + Dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                id="user-profile-menu-btn"
                onClick={() => setShowUserMenu((v) => !v)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-cyan-500/20 to-violet-600/30 text-sm font-bold text-cyan-200 shadow-md hover:border-cyan-400/40 hover:scale-105 transition-all duration-150 cursor-pointer"
                title={user?.full_name ?? user?.username ?? "User"}
              >
                {initials}
              </button>

              {/* Dropdown menu */}
              {showUserMenu && (
                <div className="absolute right-0 top-12 w-56 rounded-2xl border border-white/10 bg-slate-900/95 shadow-[0_0_40px_rgba(0,0,0,0.7)] backdrop-blur-xl z-50 overflow-hidden animate-in slide-in-from-top-2 duration-150">
                  {/* User info */}
                  <div className="px-4 py-3.5 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg border border-white/10 bg-gradient-to-br from-cyan-500/20 to-violet-600/30 flex items-center justify-center text-xs font-bold text-cyan-200">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{user?.full_name ?? user?.username}</p>
                        <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-2">
                    <button
                      type="button"
                      onClick={() => { setShowUserMenu(false); navigate("/settings"); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors text-left"
                    >
                      <User className="h-4 w-4 text-slate-400" />
                      My Settings
                    </button>
                    <button
                      id="logout-btn"
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-red-400 hover:bg-red-400/10 hover:text-red-300 transition-colors text-left"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ROUTED PAGE CONTENT */}
        <main className={`flex-1 ${location.pathname === "/ai-assistant" ? "p-3 sm:p-4 lg:p-5 flex flex-col" : "p-6 lg:p-8 space-y-6"}`}>
          {children}
        </main>
      </div>

      {/* 4. HIGH-SECURITY LOCK SCREEN OVERLAY */}
      {isLocked && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#020617]/90 backdrop-blur-2xl px-4 animate-in fade-in duration-200"
        >
          {/* Ambient Glows */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-violet-600/10 rounded-full blur-[100px] pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center text-center max-w-md w-full bg-slate-900/60 border border-white/10 rounded-3xl p-8 shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-xl">
            {/* Pulsing Lock Icon */}
            <div className="relative mb-6">
              <div className="absolute -inset-2 bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full blur-md opacity-40 animate-pulse" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/20 to-slate-900 border border-cyan-400/40 text-cyan-300 shadow-inner">
                <Lock className="h-9 w-9 text-cyan-400" />
              </div>
            </div>

            {/* Real-time Clock */}
            <div className="text-4xl font-extrabold tracking-tight text-white font-mono mb-1">
              {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400 mb-6 font-medium">
              {currentTime.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
            </p>

            {/* Lock Status Text */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-400/30 text-cyan-300 text-xs font-semibold mb-3">
              <ShieldAlert className="h-3.5 w-3.5 text-cyan-400" />
              Audit V Workspace Protected
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Screen Locked</h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Your financial records, tax calculations, and active sessions are safely secured. Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20 text-white font-mono text-[10px]">Enter</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20 text-white font-mono text-[10px]">Esc</kbd> to resume work.
            </p>

            {/* Unlock Button */}
            <button
              type="button"
              onClick={() => setIsLocked(false)}
              className="w-full flex items-center justify-center gap-2.5 py-3 px-5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm shadow-lg shadow-cyan-500/25 hover:from-cyan-400 hover:to-blue-500 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Unlock className="h-4 w-4" />
              <span>Unlock Workspace</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}