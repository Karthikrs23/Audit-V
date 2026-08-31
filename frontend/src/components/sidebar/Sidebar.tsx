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
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

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
                <span className="truncate tracking-wide">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

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