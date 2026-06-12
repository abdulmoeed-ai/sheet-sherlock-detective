import { apiFetch } from "./client";
import type { DashboardLayoutResponse, WidgetLayoutItem } from "./types";

export function readDashboardLayout(dashboardKey: string) {
  return apiFetch<DashboardLayoutResponse>(
    `/api/dashboard-layouts/${encodeURIComponent(dashboardKey)}`,
  );
}

export function saveDashboardLayout(dashboardKey: string, layout: WidgetLayoutItem[]) {
  return apiFetch<DashboardLayoutResponse>(
    `/api/dashboard-layouts/${encodeURIComponent(dashboardKey)}`,
    {
      method: "PUT",
      body: { layout },
    },
  );
}

export function resetDashboardLayout(dashboardKey: string) {
  return apiFetch<DashboardLayoutResponse>(
    `/api/dashboard-layouts/${encodeURIComponent(dashboardKey)}`,
    { method: "DELETE" },
  );
}
