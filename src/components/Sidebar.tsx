import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  TrendingUp,
  FileText,
  ShieldCheck,
  Search,
  Sparkles,
  ChevronsLeft,
  ChevronsRight,
  Inbox,
  GitBranch,
  KeyRound,
  ClipboardCheck,
  Lock,
  Bell,
} from "lucide-react";
import type { BackendRole } from "@/lib/api/types";
import { getAccessToken } from "@/lib/auth-store";
import { useCurrentUser, useLogout } from "@/hooks/use-auth";
import { initialsFor, roleLabel } from "@/lib/role-access";
import { IconTooltip } from "@/components/IconTooltip";
import {
  sidebarStore,
  useSidebarCollapsed,
  SIDEBAR_WIDTH,
  SIDEBAR_COLLAPSED_WIDTH,
} from "@/lib/sidebar-store";

const nav = [
  {
    to: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["finance_analyst", "finance_manager", "cfo", "admin"],
  },
  { to: "/inbox", label: "Inbox", icon: Inbox, roles: ["finance_analyst"] },
  {
    to: "/registry",
    label: "Model Registry",
    icon: GitBranch,
    roles: ["finance_analyst", "finance_manager", "cfo", "admin"],
  },
  { to: "/forecast", label: "Forecast", icon: TrendingUp, roles: ["finance_analyst"] },
  { to: "/assumptions", label: "Assumptions", icon: FileText, roles: ["finance_analyst"] },
  { to: "/review", label: "Manager Review", icon: ClipboardCheck, roles: ["finance_manager"] },
  { to: "/sign-off", label: "CFO Sign-Off", icon: Lock, roles: ["cfo"] },
  { to: "/protection", label: "Protection", icon: ShieldCheck, roles: ["admin"] },
  {
    to: "/notifications",
    label: "Notifications",
    icon: Bell,
    roles: ["finance_analyst", "finance_manager", "cfo", "admin"],
  },
  {
    to: "/audit",
    label: "Audit Trail",
    icon: ShieldCheck,
    roles: ["finance_analyst", "finance_manager", "cfo", "admin"],
  },
  { to: "/sources", label: "Sources Admin", icon: KeyRound, roles: ["admin"] },
] as const;

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const collapsed = useSidebarCollapsed();
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const width = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;
  const currentRole: BackendRole = user?.role ?? "finance_analyst";
  const visibleNav = getAccessToken()
    ? nav.filter((item) => (item.roles as readonly BackendRole[]).includes(currentRole))
    : [];
  const initials = user ? initialsFor(user.name, user.email) : "SS";

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
        {visibleNav.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          if (collapsed) {
            return (
              <IconTooltip key={to} label={label} side="right">
                <Link
                  to={to}
                  aria-label={label}
                  className="my-1 flex h-12 w-full items-center justify-center rounded-lg transition-colors"
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
              </IconTooltip>
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

      <IconTooltip label={collapsed ? "Expand sidebar" : "Collapse sidebar"} side="right">
        <button
          onClick={() => sidebarStore.toggle()}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`mx-2 mb-2 flex h-9 items-center rounded-lg transition-colors hover:bg-white/5 ${
            collapsed ? "justify-center" : "gap-2 px-3"
          }`}
          style={{ color: "var(--color-sidebar-text)" }}
        >
          {collapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-4 w-4" />}
          {!collapsed && <span className="text-[12px] font-medium">Collapse</span>}
        </button>
      </IconTooltip>

      <div
        className={`flex items-center border-t py-3 ${collapsed ? "justify-center px-0" : "gap-2.5 px-4"}`}
        style={{ borderColor: "var(--color-sidebar-border)" }}
      >
        <div
          className={`flex items-center justify-center rounded-full font-semibold text-white ${
            collapsed ? "h-10 w-10 text-[13px]" : "h-8 w-8 text-[12px]"
          }`}
          style={{ background: "var(--color-brand)" }}
          title={user?.name ?? "Sheet Sherlock"}
        >
          {initials}
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="text-[12px] font-semibold text-white">
              {user?.name ?? "Not signed in"}
            </span>
            <span className="text-[10px]" style={{ color: "var(--color-sidebar-text)" }}>
              {user ? roleLabel(user.role) : "Guest"}
            </span>
          </div>
        )}
        {!collapsed && user && (
          <button
            onClick={logout}
            className="ml-auto rounded px-2 py-1 text-[10px] font-semibold hover:bg-white/5"
            style={{ color: "var(--color-sidebar-text)" }}
          >
            Sign out
          </button>
        )}
      </div>
    </aside>
  );
}
