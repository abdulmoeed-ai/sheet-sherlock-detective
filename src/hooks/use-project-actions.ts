import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  acceptBalanceSheetDiagnosis,
  acknowledgeMappingRules,
  createComment,
  decideBalanceSheetDiagnosis,
  generateAssumptions,
  generateExecutiveBrief,
  recordCfoSignoff,
  recordManagerDecision,
  resolveComment,
  revertReviewCell,
  runBalanceSheetDiagnosis,
  runForecast,
  startExtraction,
  submitForManagerReview,
  toggleMappingRule,
  updateReviewCell,
  uploadDocument,
} from "@/lib/api/projects";
import { queryKeys } from "@/lib/api/query-keys";
import type { ExtractionJobResponse } from "@/lib/api/types";

function invalidateProject(queryClient: QueryClient, projectId: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.workspace(projectId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.projects });
}

export function useUploadDocument(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadDocument(projectId, file),
    onSuccess: () => invalidateProject(queryClient, projectId),
  });
}

export function useStartExtraction(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<ExtractionJobResponse, Error, boolean | undefined>({
    mutationFn: (force) => startExtraction(projectId, force ?? false),
    onSuccess: () => invalidateProject(queryClient, projectId),
  });
}

export function useAcknowledgeMappingRules(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { rulesHash: string; rulesCount: number; acknowledged: boolean }) =>
      acknowledgeMappingRules(projectId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.mappingRules(projectId) }),
  });
}

export function useToggleMappingRule(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleCode, enabled }: { ruleCode: string; enabled: boolean }) =>
      toggleMappingRule(projectId, ruleCode, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.mappingRules(projectId) }),
  });
}

export function useCreateComment(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      body: string;
      fieldId?: string | null;
      templateCell?: string | null;
      sheetName?: string | null;
    }) => createComment(projectId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.comments(projectId) }),
  });
}

export function useResolveComment(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => resolveComment(projectId, commentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.comments(projectId) }),
  });
}

export function useReviewCell(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      fieldId,
      input,
    }: {
      fieldId: string;
      input: { action: string; value?: string | null; note?: string | null };
    }) => updateReviewCell(projectId, fieldId, input),
    onSuccess: () => invalidateProject(queryClient, projectId),
  });
}

export function useRevertReviewCell(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fieldId, revisionId }: { fieldId: string; revisionId: string }) =>
      revertReviewCell(projectId, fieldId, revisionId),
    onSuccess: () => invalidateProject(queryClient, projectId),
  });
}

export function useRunDiagnosis(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => runBalanceSheetDiagnosis(projectId),
    onSuccess: () => invalidateProject(queryClient, projectId),
  });
}

export function useAcceptDiagnosis(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (candidateId: string) => acceptBalanceSheetDiagnosis(projectId, candidateId),
    onSuccess: () => invalidateProject(queryClient, projectId),
  });
}

export function useDecideDiagnosis(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ candidateId, input }: { candidateId: string; input: Record<string, unknown> }) =>
      decideBalanceSheetDiagnosis(projectId, candidateId, input),
    onSuccess: () => invalidateProject(queryClient, projectId),
  });
}

export function useRunForecast(projectId: string) {
  return useMutation({
    mutationFn: (input: {
      query?: string | null;
      sourceIds?: string[];
      sourceGroup?: string | null;
      projectionYears?: number;
    }) => runForecast(projectId, input),
  });
}

export function useGenerateAssumptions(projectId: string) {
  return useMutation({
    mutationFn: (input: {
      includeForecastDrivers: boolean;
      forecast?: Record<string, unknown> | null;
    }) => generateAssumptions(projectId, input),
  });
}

export function useSubmitForManagerReview(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (note: string | null) => submitForManagerReview(projectId, note),
    onSuccess: () => invalidateProject(queryClient, projectId),
  });
}

export function useManagerDecision(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { action: "approve" | "send_back"; note?: string | null }) =>
      recordManagerDecision(projectId, input),
    onSuccess: () => invalidateProject(queryClient, projectId),
  });
}

export function useGenerateExecutiveBrief(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => generateExecutiveBrief(projectId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.latestBrief(projectId) }),
  });
}

export function useCfoSignoff(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { approved: boolean; note?: string | null; briefId?: string | null }) =>
      recordCfoSignoff(projectId, input),
    onSuccess: () => invalidateProject(queryClient, projectId),
  });
}
