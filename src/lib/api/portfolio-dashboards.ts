import { apiFetch } from "./client";
import type {
  PortfolioDashboardInput,
  PortfolioDashboardResponse,
  PortfolioDashboardScope,
  PortfolioDashboardUpdateInput,
} from "./types";

export function listPortfolioDashboards(scope: PortfolioDashboardScope = "all") {
  return apiFetch<PortfolioDashboardResponse[]>(
    `/api/portfolio-dashboards?scope=${encodeURIComponent(scope)}`,
  );
}

export function createPortfolioDashboard(input: PortfolioDashboardInput) {
  return apiFetch<PortfolioDashboardResponse>("/api/portfolio-dashboards", {
    method: "POST",
    body: input,
  });
}

export function readPortfolioDashboard(dashboardId: string) {
  return apiFetch<PortfolioDashboardResponse>(
    `/api/portfolio-dashboards/${encodeURIComponent(dashboardId)}`,
  );
}

export function updatePortfolioDashboard(
  dashboardId: string,
  input: PortfolioDashboardUpdateInput,
) {
  return apiFetch<PortfolioDashboardResponse>(
    `/api/portfolio-dashboards/${encodeURIComponent(dashboardId)}`,
    {
      method: "PATCH",
      body: input,
    },
  );
}

export function deletePortfolioDashboard(dashboardId: string) {
  return apiFetch<void>(`/api/portfolio-dashboards/${encodeURIComponent(dashboardId)}`, {
    method: "DELETE",
  });
}
