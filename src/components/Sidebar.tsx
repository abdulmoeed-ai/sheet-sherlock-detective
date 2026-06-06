import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  TrendingUp,
  ShieldCheck,
  ChevronsLeft,
  ChevronsRight,
  Inbox,
  GitBranch,
  KeyRound,
  ClipboardCheck,
  Lock,
  ChevronDown,
  LogOut,
} from "lucide-react";
import type { BackendRole } from "@/lib/api/types";
import { getAccessToken } from "@/lib/auth-store";
import { useCurrentUser, useLogout } from "@/hooks/use-auth";
import { initialsFor, roleLabel } from "@/lib/role-access";
import { IconTooltip } from "@/components/IconTooltip";
import { ProductLogo } from "@/components/ProductLogo";
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
    label: "Excel Workbooks",
    icon: GitBranch,
    roles: ["finance_analyst", "finance_manager", "cfo", "admin"],
  },
  { to: "/forecast", label: "Forecast", icon: TrendingUp, roles: ["finance_analyst"] },
  { to: "/review", label: "Manager Review", icon: ClipboardCheck, roles: ["finance_manager"] },
  { to: "/sign-off", label: "CFO Sign-Off", icon: Lock, roles: ["cfo"] },
  { to: "/protection", label: "Protection", icon: ShieldCheck, roles: ["admin"] },
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
  const [profileOpen, setProfileOpen] = useState(false);
  const width = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;
  const currentRole: BackendRole = user?.role ?? "finance_analyst";
  const visibleNav = getAccessToken()
    ? nav.filter((item) => (item.roles as readonly BackendRole[]).includes(currentRole))
    : [];
  const initials = user ? initialsFor(user.name, user.email) : "SS";

  return (
    <aside
      className="relative flex h-screen flex-col transition-[width] duration-200 ease-out"
      style={{
        width,
        background: "var(--color-sidebar-bg)",
        borderRight: "1px solid var(--color-sidebar-border)",
      }}
    >
      <div className={collapsed ? "flex justify-center px-0 pt-5 pb-4" : "px-3 pt-4 pb-3"}>
        <ProductLogo className={collapsed ? "h-10 w-10" : "h-11 w-11"} />
      </div>

      {!collapsed && (
        <div
          className="mt-3 px-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: "#5C6478" }}
        >
          Workspace
        </div>
      )}

      <nav
        className={`flex-1 py-1 ${collapsed ? "flex flex-col items-center gap-1 px-0" : "px-1"}`}
      >
        {visibleNav.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          if (collapsed) {
            return (
              <IconTooltip key={to} label={label} side="right" className="block">
                <Link
                  to={to}
                  aria-label={label}
                  className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors"
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

      <IconTooltip
        label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        side="right"
        className={collapsed ? "mx-auto mb-2 block h-10 w-10" : "inline-flex"}
      >
        <button
          onClick={() => sidebarStore.toggle()}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`flex items-center rounded-lg transition-colors hover:bg-white/5 ${
            collapsed ? "h-10 w-10 justify-center" : "mx-2 mb-2 h-9 gap-2 px-3"
          }`}
          style={{ color: "var(--color-sidebar-text)" }}
        >
          {collapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-4 w-4" />}
          {!collapsed && <span className="text-[12px] font-medium">Collapse</span>}
        </button>
      </IconTooltip>

      <div
        className={`relative border-t py-3 ${collapsed ? "px-0" : "px-4"}`}
        style={{ borderColor: "var(--color-sidebar-border)" }}
      >
        {profileOpen && user && (
          <div
            className={`absolute z-20 rounded-lg border p-1 shadow-xl ${
              collapsed ? "bottom-[64px] left-2 w-40" : "right-3 bottom-[64px] left-3"
            }`}
            style={{
              background: "var(--color-card)",
              borderColor: "var(--color-border-default)",
              boxShadow: "0 18px 42px rgba(15, 23, 42, 0.22)",
            }}
          >
            <button
              onClick={() => {
                setProfileOpen(false);
                logout();
              }}
              className="flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-[12px] font-semibold transition-colors hover:bg-[var(--color-tag-bg)]"
              style={{ color: "var(--color-text-primary)" }}
            >
              <LogOut className="h-4 w-4" style={{ color: "var(--color-brand)" }} />
              Sign out
            </button>
          </div>
        )}

        <div
          className={`flex w-full items-center rounded-lg ${
            collapsed ? "justify-center px-0 py-0" : "gap-2.5 px-0 py-1"
          }`}
        >
          <div
            className={`flex items-center justify-center rounded-full font-semibold text-white ${
              collapsed ? "h-10 w-10 text-[13px]" : "h-8 w-8 text-[12px]"
            }`}
            style={{ background: "var(--color-brand)" }}
            title={user?.name ?? "finance"}
          >
            {initials}
          </div>
          {!collapsed && (
            <div className="flex min-w-0 flex-1 flex-col text-left leading-tight">
              <span className="truncate text-[12px] font-semibold text-white">
                {user?.name ?? "Not signed in"}
              </span>
              <span className="text-[10px]" style={{ color: "var(--color-sidebar-text)" }}>
                {user ? roleLabel(user.role) : "Guest"}
              </span>
            </div>
          )}
          {!collapsed && user && (
            <button
              type="button"
              onClick={() => setProfileOpen((open) => !open)}
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/5"
              aria-expanded={profileOpen}
              aria-label="Open profile menu"
              style={{ color: "var(--color-sidebar-text)" }}
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${profileOpen ? "rotate-180" : ""}`}
              />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
