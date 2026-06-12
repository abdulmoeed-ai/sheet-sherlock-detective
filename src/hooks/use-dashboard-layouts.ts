import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  readDashboardLayout,
  resetDashboardLayout,
  saveDashboardLayout,
} from "@/lib/api/dashboard-layouts";
import { queryKeys } from "@/lib/api/query-keys";
import type { WidgetLayoutItem } from "@/lib/api/types";

export function useDashboardLayout(dashboardKey: string) {
  return useQuery({
    queryKey: queryKeys.dashboardLayout(dashboardKey),
    queryFn: () => readDashboardLayout(dashboardKey),
  });
}

export function useSaveDashboardLayout(dashboardKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (layout: WidgetLayoutItem[]) => saveDashboardLayout(dashboardKey, layout),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboardLayout(dashboardKey) });
    },
  });
}

export function useResetDashboardLayout(dashboardKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => resetDashboardLayout(dashboardKey),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboardLayout(dashboardKey) });
    },
  });
}
