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
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  sidebarStore,
  useSidebarCollapsed,
  SIDEBAR_WIDTH,
  SIDEBAR_COLLAPSED_WIDTH,
} from "@/lib/sidebar-store";
import { getRoleLabel, getUserInitials } from "@/lib/sidebar-user";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/requests", label: "Requests", icon: ClipboardList },
  { to: "/ingestion", label: "Ingestion", icon: Download },
  { to: "/diff-review", label: "Diff Review", icon: GitCompare },
  { to: "/diagnosis", label: "Diagnosis", icon: Stethoscope },
  { to: "/forecast", label: "Forecast", icon: TrendingUp },
  { to: "/assumptions", label: "Assumptions", icon: FileText },
  { to: "/audit", label: "Audit Trail", icon: ShieldCheck },
] as const;

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const collapsed = useSidebarCollapsed();
  const { session, signOut } = useAuth();
  const userName = session.user.name;
  const roleLabel = getRoleLabel(session.user.role);
  const initials = getUserInitials(userName);
  const width = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  return (
    <aside
      className="flex h-screen flex-col transition-[width] duration-200 ease-out"
      style={{
        width,
        background: "var(--color-sidebar-bg)",
        borderRight: "1px solid var(--color-sidebar-border)",
      }}
    >
      <div
        className={`flex items-center ${collapsed ? "justify-center px-0" : "gap-2.5 px-5"} pt-5 pb-4`}
      >
        <div
          className={`flex items-center justify-center rounded-md ${collapsed ? "h-10 w-10" : "h-8 w-8"}`}
          style={{ background: "var(--color-brand)" }}
        >
          <Search
            className={collapsed ? "h-[22px] w-[22px] text-white" : "h-[18px] w-[18px] text-white"}
          />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="text-[15px] font-semibold text-white">Sheet Sherlock</span>
            <span
              className="text-[10px] font-medium uppercase tracking-wider"
              style={{ color: "var(--color-sidebar-icon)" }}
            >
              FP&amp;A · v1
            </span>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="px-3 pb-2 pt-1">
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px]"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "var(--color-sidebar-text)",
            }}
          >
            <Search className="h-3.5 w-3.5" style={{ color: "var(--color-sidebar-icon)" }} />
            <span className="text-[12px]">Quick find…</span>
          </div>
        </div>
      )}

      {!collapsed && (
        <div
          className="mt-3 px-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: "#5C6478" }}
        >
          Workspace
        </div>
      )}

      <nav className={`flex-1 py-1 ${collapsed ? "px-2" : "px-1"}`}>
        {nav.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          if (collapsed) {
            return (
              <Link
                key={to}
                to={to}
                title={label}
                className="my-1 flex h-12 items-center justify-center rounded-lg transition-colors"
                style={{
                  background: active ? "var(--color-sidebar-active)" : "transparent",
                }}
              >
                <Icon
                  className="h-[22px] w-[22px]"
                  style={{
                    color: active ? "var(--color-sidebar-icon)" : "var(--color-sidebar-text)",
                  }}
                />
              </Link>
            );
          }
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
                style={{
                  color: active ? "var(--color-sidebar-icon)" : "var(--color-sidebar-text)",
                }}
              />
              <span className="text-[13px] font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div
          className="mx-3 mb-4 rounded-lg p-3"
          style={{
            background: "var(--color-sidebar-active)",
            border: "1px solid rgba(158,149,245,0.2)",
          }}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" style={{ color: "var(--color-sidebar-icon)" }} />
            <span className="text-[12px] font-semibold text-white">Ask AI</span>
          </div>
          <p
            className="mt-1.5 text-[11px] leading-snug"
            style={{ color: "var(--color-sidebar-text)" }}
          >
            Cell-level Q&amp;A with full source citation.
          </p>
        </div>
      )}

      <button
        onClick={() => sidebarStore.toggle()}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={`mx-2 mb-2 flex h-9 items-center rounded-lg transition-colors hover:bg-white/5 ${
          collapsed ? "justify-center" : "gap-2 px-3"
        }`}
        style={{ color: "var(--color-sidebar-text)" }}
      >
        {collapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-4 w-4" />}
        {!collapsed && <span className="text-[12px] font-medium">Collapse</span>}
      </button>

      <div
        className={`flex items-center border-t py-3 ${collapsed ? "justify-center px-0" : "gap-2.5 px-4"}`}
        style={{ borderColor: "var(--color-sidebar-border)" }}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={signOut}
            title={`${userName} · ${roleLabel}. Sign out`}
            aria-label="Sign out"
            className="flex h-10 w-10 items-center justify-center rounded-full font-semibold text-white transition-opacity hover:opacity-85"
            style={{ background: "var(--color-brand)" }}
          >
            {initials}
          </button>
        ) : (
          <>
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white"
              style={{ background: "var(--color-brand)" }}
              title={userName}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1 flex-col leading-tight">
              <span className="block truncate text-[12px] font-semibold text-white">
                {userName}
              </span>
              <span
                className="block truncate text-[10px]"
                style={{ color: "var(--color-sidebar-text)" }}
              >
                {roleLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={signOut}
              title="Sign out"
              aria-label="Sign out"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-white/5"
              style={{ color: "var(--color-sidebar-text)" }}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
