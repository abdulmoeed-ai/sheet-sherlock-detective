import type { BackendRole, FrontendRole } from "@/lib/api/types";

export function frontendRole(role: BackendRole): FrontendRole {
  if (role === "finance_manager") return "manager";
  if (role === "finance_analyst") return "analyst";
  return role;
}

export function backendRole(
  role: Exclude<FrontendRole, "admin">,
): "finance_analyst" | "finance_manager" | "cfo" {
  if (role === "manager") return "finance_manager";
  if (role === "analyst") return "finance_analyst";
  return "cfo";
}

export function roleLabel(role: BackendRole): string {
  if (role === "finance_analyst") return "Analyst";
  if (role === "finance_manager") return "Manager";
  if (role === "cfo") return "CFO";
  return "Admin";
}

export function defaultRouteForRole(role: BackendRole): string {
  if (role === "finance_analyst") return "/inbox";
  if (role === "finance_manager") return "/";
  if (role === "cfo") return "/sign-off";
  return "/sources";
}

const routeRoles: Record<string, BackendRole[]> = {
  "/": ["finance_analyst", "finance_manager", "cfo", "admin"],
  "/inbox": ["finance_analyst"],
  "/registry": ["finance_analyst", "finance_manager", "cfo", "admin"],
  "/ingestion": ["finance_analyst"],
  "/diagnosis": ["finance_analyst"],
  "/forecast": ["finance_analyst"],
  "/assumptions": ["finance_analyst"],
  "/review": ["finance_manager"],
  "/sign-off": ["cfo"],
  "/protection": ["admin"],
  "/notifications": ["finance_analyst", "finance_manager", "cfo", "admin"],
  "/audit": ["finance_analyst", "finance_manager", "cfo", "admin"],
  "/sources": ["admin"],
};

export function canSeeRoute(role: BackendRole, pathname: string): boolean {
  if (pathname === "/login") return true;
  return routeRoles[pathname]?.includes(role) ?? false;
}

export function initialsFor(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}
