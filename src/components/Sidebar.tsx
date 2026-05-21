import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Download,
  GitCompare,
  Stethoscope,
  TrendingUp,
  FileText,
  ShieldCheck,
  Search,
  Sparkles,
} from "lucide-react";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/ingestion", label: "Ingestion", icon: Download },
  { to: "/diff-review", label: "Diff Review", icon: GitCompare },
  { to: "/diagnosis", label: "Diagnosis", icon: Stethoscope },
  { to: "/forecast", label: "Forecast", icon: TrendingUp },
  { to: "/assumptions", label: "Assumptions", icon: FileText },
  { to: "/audit", label: "Audit Trail", icon: ShieldCheck },
] as const;

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside
      className="flex h-screen w-[240px] flex-col"
      style={{ background: "var(--color-sidebar-bg)", borderRight: "1px solid var(--color-sidebar-border)" }}
    >
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md" style={{ background: "var(--color-brand)" }}>
          <Search className="h-[18px] w-[18px] text-white" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>Sheet Sherlock</span>
          <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--color-brand)" }}>
            FP&amp;A · v1
          </span>
        </div>
      </div>

      <div className="px-3 pb-2 pt-1">
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px]"
          style={{ background: "#fff", border: "1px solid var(--color-border-default)", color: "var(--color-sidebar-text)" }}
        >
          <Search className="h-3.5 w-3.5" style={{ color: "var(--color-sidebar-icon)" }} />
          <span className="text-[12px]">Quick find…</span>
        </div>
      </div>

      <div className="mt-3 px-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--color-text-muted)" }}>
        Workspace
      </div>
      <nav className="flex-1 px-1 py-1">
        {nav.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className="mx-2 my-0.5 flex h-10 items-center gap-2.5 rounded-lg px-3 transition-colors"
              style={{
                background: active ? "var(--color-sidebar-active)" : "transparent",
                color: active ? "var(--color-sidebar-text-active)" : "var(--color-sidebar-text)",
              }}
            >
              <Icon
                className="h-[18px] w-[18px]"
                style={{ color: active ? "var(--color-brand)" : "var(--color-sidebar-icon)" }}
              />
              <span className="text-[13px] font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 mb-4 rounded-lg p-3" style={{ background: "var(--color-sidebar-active)", border: "1px solid var(--color-border-default)" }}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: "var(--color-brand)" }} />
          <span className="text-[12px] font-semibold" style={{ color: "var(--color-sidebar-text-active)" }}>Ask AI</span>
        </div>
        <p className="mt-1.5 text-[11px] leading-snug" style={{ color: "var(--color-sidebar-text)" }}>
          Cell-level Q&amp;A with full source citation.
        </p>
      </div>

      <div
        className="flex items-center gap-2.5 border-t px-4 py-3"
        style={{ borderColor: "var(--color-sidebar-border)" }}
      >
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold text-white"
          style={{ background: "var(--color-brand)" }}
        >
          AS
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[12px] font-semibold" style={{ color: "var(--color-text-primary)" }}>Ayesha S.</span>
          <span className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>
            Finance Analyst
          </span>
        </div>
      </div>
    </aside>
  );
}
