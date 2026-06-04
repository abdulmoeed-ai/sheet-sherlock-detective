import { apiBlob, apiFetch, apiStream } from "./client";
import type {
  AssumptionsGenerateResponse,
  BalanceSheetAssistantResponse,
  ExcelExportResponse,
  ExecutiveBriefResponse,
  ExtractionJobResponse,
  ForecastRunResponse,
  MappingRulesSummaryResponse,
  ModelArchiveResponse,
  ProjectResponse,
  ReviewCommentInput,
  ReviewCommentResponse,
  ReviewHandoffResponse,
  WorkbookRevisionResponse,
  WorkbookSaveInput,
  WorkbookSaveResponse,
  WorkspaceResponse,
} from "./types";

export function listProjects() {
  return apiFetch<ProjectResponse[]>("/api/projects");
}

export function createProject(input: {
  companyName: string;
  projectLabel?: string | null;
  sector?: string | null;
  fiscalYear?: string | null;
  currencyUnit?: string | null;
  template: "Millat - Template.xlsx";
  teamMembers: Array<{
    name: string;
    email: string;
    initials?: string | null;
    role: string;
    canRemove: boolean;
  }>;
}) {
  return apiFetch<ProjectResponse>("/api/projects", { method: "POST", body: input });
}

export function readProject(projectId: string) {
  return apiFetch<ProjectResponse>(`/api/projects/${projectId}`);
}

export function readWorkspace(projectId: string) {
  return apiFetch<WorkspaceResponse>(`/api/projects/${projectId}/workspace`);
}

export function saveWorkbook(projectId: string, input: WorkbookSaveInput) {
  return apiFetch<WorkbookSaveResponse>(`/api/projects/${projectId}/workbook`, {
    method: "PATCH",
    body: input,
  });
}

export function readWorkbookCellHistory(projectId: string, sheetId: string, cellAddress: string) {
  return apiFetch<WorkbookRevisionResponse[]>(
    `/api/projects/${projectId}/workbook/cells/${encodeURIComponent(sheetId)}/${encodeURIComponent(cellAddress)}/history`,
  );
}

export function uploadDocument(projectId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiFetch(`/api/projects/${projectId}/documents`, { method: "POST", rawBody: form });
}

export function readDocumentPageImage(projectId: string, documentId: string, pdfPageIndex: number) {
  return apiBlob(`/api/projects/${projectId}/documents/${documentId}/pages/${pdfPageIndex}/image`);
}

export function startExtraction(projectId: string, force = false) {
  return apiFetch<ExtractionJobResponse>(
    `/api/projects/${projectId}/extractions?force=${force ? "true" : "false"}`,
    { method: "POST" },
  );
}

export function readExtractionJob(projectId: string, jobId: string) {
  return apiFetch<ExtractionJobResponse>(`/api/projects/${projectId}/extractions/${jobId}`);
}

export function readMappingRules(projectId: string) {
  return apiFetch<MappingRulesSummaryResponse>(`/api/projects/${projectId}/mapping-rules`);
}

export function acknowledgeMappingRules(
  projectId: string,
  input: { rulesHash: string; rulesCount: number; acknowledged: boolean },
) {
  return apiFetch(`/api/projects/${projectId}/mapping-rules/acknowledge`, {
    method: "POST",
    body: input,
  });
}

export function readAdminMappingRules(projectId: string) {
  return apiFetch<MappingRulesSummaryResponse>(`/api/projects/${projectId}/mapping-rules/admin`);
}

export function toggleMappingRule(projectId: string, ruleCode: string, enabled: boolean) {
  return apiFetch<MappingRulesSummaryResponse>(
    `/api/projects/${projectId}/mapping-rules/${ruleCode}`,
    {
      method: "PATCH",
      body: { enabled },
    },
  );
}

export function listComments(projectId: string) {
  return apiFetch<ReviewCommentResponse[]>(`/api/projects/${projectId}/comments`);
}

export function createComment(projectId: string, input: ReviewCommentInput) {
  return apiFetch<ReviewCommentResponse>(`/api/projects/${projectId}/comments`, {
    method: "POST",
    body: input,
  });
}

export function updateComment(projectId: string, commentId: string, input: ReviewCommentInput) {
  return apiFetch<ReviewCommentResponse>(`/api/projects/${projectId}/comments/${commentId}`, {
    method: "PATCH",
    body: input,
  });
}

export function resolveComment(projectId: string, commentId: string) {
  return apiFetch<ReviewCommentResponse>(
    `/api/projects/${projectId}/comments/${commentId}/resolve`,
    { method: "POST" },
  );
}

export function reopenComment(projectId: string, commentId: string) {
  return apiFetch<ReviewCommentResponse>(
    `/api/projects/${projectId}/comments/${commentId}/reopen`,
    { method: "POST" },
  );
}

export function deleteComment(projectId: string, commentId: string) {
  return apiFetch<ReviewCommentResponse>(`/api/projects/${projectId}/comments/${commentId}`, {
    method: "DELETE",
  });
}

export function readIngestionPreview(projectId: string, runId?: string | null) {
  const suffix = runId ? `?run_id=${encodeURIComponent(runId)}` : "";
  return apiFetch<Record<string, unknown>>(`/api/projects/${projectId}/ingestion/preview${suffix}`);
}

export function searchSources(
  projectId: string,
  input: { query: string; sourceIds?: string[]; sourceGroup?: string | null },
) {
  return apiFetch<Record<string, unknown>>(`/api/projects/${projectId}/search`, {
    method: "POST",
    body: input,
  });
}

export function askAi(projectId: string, input: Record<string, unknown>, options: { signal?: AbortSignal } = {}) {
  return apiStream(`/api/projects/${projectId}/ask-ai`, {
    method: "POST",
    body: input,
    signal: options.signal,
  });
}

export function runBalanceSheetDiagnosis(projectId: string) {
  return apiFetch<Record<string, unknown>>(
    `/api/projects/${projectId}/diagnosis/balance-sheet/run`,
    { method: "POST" },
  );
}

export function runBalanceSheetAssistant(projectId: string) {
  return apiFetch<BalanceSheetAssistantResponse>(
    `/api/projects/${projectId}/diagnosis/balance-sheet/assistant`,
    { method: "POST" },
  );
}

export function readLatestBalanceSheetDiagnosis(projectId: string) {
  return apiFetch<Record<string, unknown>>(
    `/api/projects/${projectId}/diagnosis/balance-sheet/latest`,
  );
}

export function acceptBalanceSheetDiagnosis(projectId: string, candidateId: string) {
  return apiFetch<Record<string, unknown>>(
    `/api/projects/${projectId}/diagnosis/balance-sheet/${candidateId}/accept`,
    { method: "POST" },
  );
}

export function decideBalanceSheetDiagnosis(
  projectId: string,
  candidateId: string,
  input: Record<string, unknown>,
) {
  return apiFetch<Record<string, unknown>>(
    `/api/projects/${projectId}/diagnosis/balance-sheet/${candidateId}/decision`,
    { method: "POST", body: input },
  );
}

export function runForecast(
  projectId: string,
  input: {
    query?: string | null;
    sourceIds?: string[];
    sourceGroup?: string | null;
    projectionYears?: number;
  },
) {
  return apiFetch<ForecastRunResponse>(`/api/projects/${projectId}/forecast/run`, {
    method: "POST",
    body: input,
  });
}

export function generateAssumptions(
  projectId: string,
  input: { includeForecastDrivers: boolean; forecast?: Record<string, unknown> | null },
) {
  return apiFetch<AssumptionsGenerateResponse>(`/api/projects/${projectId}/assumptions/generate`, {
    method: "POST",
    body: input,
  });
}

export function generateExecutiveBrief(projectId: string) {
  return apiFetch<ExecutiveBriefResponse>(`/api/projects/${projectId}/briefs/generate`, {
    method: "POST",
  });
}

export function readLatestExecutiveBrief(projectId: string) {
  return apiFetch<ExecutiveBriefResponse>(`/api/projects/${projectId}/briefs/latest`);
}

export function readLatestArchive(projectId: string) {
  return apiFetch<ModelArchiveResponse>(`/api/projects/${projectId}/archive/latest`);
}

export function downloadArchiveAuditJson(projectId: string, archiveId: string) {
  return apiBlob(`/api/projects/${projectId}/archive/${archiveId}/audit.json`);
}

export function createExcelExport(projectId: string) {
  return apiFetch<ExcelExportResponse>(`/api/projects/${projectId}/exports/excel`, {
    method: "POST",
  });
}

export function downloadExcelExport(projectId: string, exportId: string) {
  return apiBlob(`/api/projects/${projectId}/exports/${exportId}/download`);
}

export function submitForManagerReview(projectId: string, note: string | null) {
  return apiFetch<ReviewHandoffResponse>(`/api/projects/${projectId}/review/submit`, {
    method: "POST",
    body: { note },
  });
}

export function recordManagerDecision(
  projectId: string,
  input: { action: "approve" | "send_back"; note?: string | null },
) {
  return apiFetch<ReviewHandoffResponse>(`/api/projects/${projectId}/review/manager-decision`, {
    method: "POST",
    body: input,
  });
}

export function recordCfoSignoff(
  projectId: string,
  input: { approved: boolean; note?: string | null; briefId?: string | null },
) {
  return apiFetch<ReviewHandoffResponse>(`/api/projects/${projectId}/review/cfo-signoff`, {
    method: "POST",
    body: input,
  });
}

export function updateReviewCell(
  projectId: string,
  fieldId: string,
  input: { action: string; value?: string | null; note?: string | null },
) {
  return apiFetch<Record<string, unknown>>(`/api/projects/${projectId}/review-cells/${fieldId}`, {
    method: "PATCH",
    body: input,
  });
}

export function revertReviewCell(projectId: string, fieldId: string, revisionId: string) {
  return apiFetch<Record<string, unknown>>(
    `/api/projects/${projectId}/review-cells/${fieldId}/revert`,
    { method: "POST", body: { revisionId } },
  );
}
