import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPortfolioDashboard,
  deletePortfolioDashboard,
  listPortfolioDashboards,
  markPortfolioDashboardExported,
  readPortfolioDashboard,
  updatePortfolioDashboard,
} from "@/lib/api/portfolio-dashboards";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  PortfolioDashboardInput,
  PortfolioDashboardScope,
  PortfolioDashboardUpdateInput,
} from "@/lib/api/types";

export function usePortfolioDashboards(scope: PortfolioDashboardScope = "all") {
  return useQuery({
    queryKey: queryKeys.portfolioDashboards(scope),
    queryFn: () => listPortfolioDashboards(scope),
  });
}

export function usePortfolioDashboard(dashboardId: string | null) {
  return useQuery({
    queryKey: dashboardId
      ? queryKeys.portfolioDashboard(dashboardId)
      : ["portfolio-dashboards", "none"],
    queryFn: () => readPortfolioDashboard(dashboardId as string),
    enabled: !!dashboardId,
  });
}

export function useCreatePortfolioDashboard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PortfolioDashboardInput) => createPortfolioDashboard(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["portfolio-dashboards"] });
    },
  });
}

export function useUpdatePortfolioDashboard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { dashboardId: string; payload: PortfolioDashboardUpdateInput }) =>
      updatePortfolioDashboard(input.dashboardId, input.payload),
    onSuccess: async (_dashboard, input) => {
      await queryClient.invalidateQueries({ queryKey: ["portfolio-dashboards"] });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.portfolioDashboard(input.dashboardId),
      });
    },
  });
}

export function useDeletePortfolioDashboard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePortfolioDashboard,
    onSuccess: async (_result, dashboardId) => {
      await queryClient.invalidateQueries({ queryKey: ["portfolio-dashboards"] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.portfolioDashboard(dashboardId) });
    },
  });
}

export function useMarkPortfolioDashboardExported() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markPortfolioDashboardExported,
    onSuccess: async (dashboard) => {
      await queryClient.invalidateQueries({ queryKey: ["portfolio-dashboards"] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.portfolioDashboard(dashboard.id) });
    },
  });
}
