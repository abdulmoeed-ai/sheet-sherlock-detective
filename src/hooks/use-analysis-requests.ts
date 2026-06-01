import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acknowledgeAnalysisRequest,
  convertAnalysisRequestToProject,
  createAnalysisRequest,
  listAnalysisRequests,
} from "@/lib/api/analysis-requests";
import { queryKeys } from "@/lib/api/query-keys";

export function useAnalysisRequests() {
  return useQuery({ queryKey: queryKeys.analysisRequests, queryFn: listAnalysisRequests });
}

export function useCreateAnalysisRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAnalysisRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.analysisRequests }),
  });
}

export function useAcknowledgeAnalysisRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: acknowledgeAnalysisRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.analysisRequests }),
  });
}

export function useConvertAnalysisRequestToProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: convertAnalysisRequestToProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.analysisRequests });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}
