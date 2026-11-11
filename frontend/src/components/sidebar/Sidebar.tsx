import {
  LayoutDashboard,
  Bot,
  TrendingUp,
  Landmark,
  Coins,
  BriefcaseBusiness,
  ReceiptIndianRupee,
  ChartNoAxesCombined,
  ShieldAlert,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const menuItems = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/dashboard",
  },
  {
    label: "AI Assistant",
    icon: Bot,
    path: "/ai-assistant",
    shortcut: "M",
  },
  {
    label: "Market Intelligence",
    icon: TrendingUp,
    path: "/market",
  },
  {
    label: "Banking & Finance",
    icon: Landmark,
    path: "/banking",
  },
  {
    label: "Investments",
    icon: Coins,
    path: "/investments",
  },
  {
    label: "Salary & Tax Planner",
    icon: BriefcaseBusiness,
    path: "/salary-tax",
  },
  {
    label: "Tax & Compliance",
    icon: ReceiptIndianRupee,
    path: "/tax",
  },
  {
    label: "Financial Analysis",
    icon: ChartNoAxesCombined,
    path: "/financial-analysis",
  },
  {
    label: "Risk & Fraud",
    icon: ShieldAlert,
    path: "/risk-fraud",
  },
  {
    label: "Documents",
    icon: FileText,
    path: "/documents",
  },
  {
    label: "Settings",
    icon: Settings,
    path: "/settings",
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-50
        flex flex-col
        border-r border-white/10
        bg-[#030712]/95
        backdrop-blur-2xl
        transition-all duration-300 ease-in-out
        ${collapsed ? "w-[76px]" : "w-[260px]"}
      `}
    >
      {/* =====================================================
          LOGO / BRAND HEADER
      ====================================================== */}
      <div className="flex h-[76px] shrink-0 items-center border-b border-white/10 px-4">
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-3 overflow-hidden text-left group cursor-pointer w-full"
          title="Audit V Financial Intelligence Dashboard"
        >
          {/* Logo Icon */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.2)] transition group-hover:bg-cyan-400/20 group-hover:scale-105">
            <span className="text-lg font-bold tracking-wider">A</span>
          </div>

          {/* Logo Text */}
          {!collapsed && (
            <div className="truncate transition-opacity duration-200">
              <h1 className="text-base font-bold tracking-[0.18em] text-white leading-tight group-hover:text-cyan-300 transition-colors">
                AUDIT V
              </h1>
              <p className="text-[9px] uppercase tracking-[0.25em] text-cyan-400 font-semibold">
                Financial Intelligence
              </p>
            </div>
          )}
        </button>
      </div>

      {/* =====================================================
          NAVIGATION MENU
      ====================================================== */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 custom-scrollbar">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            location.pathname === item.path ||
            (item.path === "/dashboard" && location.pathname === "/");

          return (
            <button
              key={item.label}
              type="button"
              title={collapsed ? item.label : undefined}
              onClick={() => navigate(item.path)}
              className={`
                group relative flex w-full items-center gap-3.5
                rounded-xl px-3 py-2.5 text-left text-sm
                transition-all duration-200
                ${
                  isActive
                    ? "bg-cyan-400/10 text-cyan-300 font-medium shadow-[inset_0_0_12px_rgba(6,182,212,0.1)] border border-cyan-400/20"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                }
              `}
            >
              {/* Active Indicator Bar */}
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-cyan-400 shadow-[0_0_10px_#06b6d4]" />
              )}

              {/* Icon */}
              <Icon
                className={`
                  h-[19px] w-[19px] shrink-0 transition-transform duration-200
                  group-hover:scale-110
                  ${isActive ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]" : "text-slate-400 group-hover:text-slate-200"}
                `}
              />

              {/* Label */}
              {!collapsed && (
                <span className="truncate tracking-wide flex-1">{item.label}</span>
              )}

              {/* Shortcut badge */}
              {!collapsed && item.shortcut && (
                <kbd className="ml-auto rounded border border-cyan-400/20 bg-cyan-950/40 px-1.5 py-0.5 text-[9px] font-mono text-cyan-300">
                  {item.shortcut}
                </kbd>
              )}
            </button>
          );
        })}
      </nav>

      {/* =====================================================
          USER PROFILE & LOGOUT SECTION
      ====================================================== */}
      {user && (
        <div className="shrink-0 border-t border-white/10 p-2.5">
          {!collapsed ? (
            <div className="flex items-center justify-between gap-2.5 rounded-xl bg-white/[0.03] border border-white/10 p-2 transition hover:border-cyan-400/20">
              <button
                type="button"
                onClick={() => navigate("/settings")}
                className="flex items-center gap-2.5 min-w-0 text-left flex-1 group cursor-pointer"
                title="Go to Settings"
              >
                <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-violet-500 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-[0_0_10px_rgba(6,182,212,0.3)] group-hover:scale-105 transition-transform">
                  {(user.full_name || user.username).slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate group-hover:text-cyan-300 transition-colors">
                    {user.full_name || user.username}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
                title="Sign out"
                className="text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 p-1.5 rounded-lg transition shrink-0 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => navigate("/settings")}
                title={`${user.full_name || user.username} (${user.email})`}
                className="h-8 w-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-violet-500 flex items-center justify-center text-xs font-bold text-white shadow-[0_0_10px_rgba(6,182,212,0.3)] hover:scale-110 transition-transform cursor-pointer"
              >
                {(user.full_name || user.username).slice(0, 2).toUpperCase()}
              </button>
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
                title="Sign out"
                className="text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 p-1.5 rounded-lg transition cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* =====================================================
          COLLAPSE / EXPAND FOOTER BUTTON
      ====================================================== */}
      <div className="shrink-0 border-t border-white/10 p-3">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="
            flex w-full items-center justify-center rounded-xl py-2.5
            text-slate-400 transition hover:bg-white/5 hover:text-white
            border border-transparent hover:border-white/10
          "
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5 text-cyan-400" />
          ) : (
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <ChevronLeft className="h-4 w-4 text-cyan-400" />
              <span>Collapse Menu</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}