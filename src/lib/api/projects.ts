import { loadSession } from "@/lib/auth-session";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

export class ProjectApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ProjectApiError";
    this.status = status;
  }
}

export type MappingRule = {
  code: string;
  title: string;
  category: string;
  severity: "Critical" | "Advisory";
  description: string;
  source: string;
  sourceReference: string;
  ruleOrder: number;
  isEnabled: boolean;
};

export type MappingRulesSummary = {
  rulesHash: string;
  rulesCount: number;
  enabledRulesCount: number;
  disabledRulesCount: number;
  categoryCounts: Record<string, number>;
  criticalCount: number;
  advisoryCount: number;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  rules: MappingRule[];
};

export type ProjectResponse = {
  id: string;
  companyName: string;
  projectLabel: string | null;
  sector: string | null;
  fiscalYear: string | null;
  currencyUnit: string | null;
  template: string;
  status: string;
};

export type ExtractionJobResponse = {
  id: string;
  projectId: string;
  status: string;
  percent: number;
  message: string;
};

export async function createProjectForCycle(input: {
  companyName: string;
  projectLabel: string;
  sector: string;
  fiscalYear: string;
}): Promise<ProjectResponse> {
  return apiRequest<ProjectResponse>("/api/projects", {
    method: "POST",
    json: {
      companyName: input.companyName,
      projectLabel: input.projectLabel,
      sector: input.sector,
      fiscalYear: input.fiscalYear,
      currencyUnit: "Rs in Thousands",
      template: "Millat - Template.xlsx",
      teamMembers: [],
    },
  });
}

export async function uploadProjectDocument(projectId: string, file: File): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  await apiRequest(`/api/projects/${projectId}/documents`, {
    method: "POST",
    body: formData,
  });
}

export async function getMappingRules(projectId: string): Promise<MappingRulesSummary> {
  return apiRequest<MappingRulesSummary>(`/api/projects/${projectId}/mapping-rules`);
}

export async function acknowledgeMappingRules(projectId: string, summary: MappingRulesSummary): Promise<void> {
  await apiRequest(`/api/projects/${projectId}/mapping-rules/acknowledge`, {
    method: "POST",
    json: {
      rulesHash: summary.rulesHash,
      rulesCount: summary.rulesCount,
      acknowledged: true,
    },
  });
}

export async function startProjectExtraction(projectId: string): Promise<ExtractionJobResponse> {
  return apiRequest<ExtractionJobResponse>(`/api/projects/${projectId}/extractions`, {
    method: "POST",
  });
}

export async function submitProjectForManagerReview(projectId: string, note: string | null = null): Promise<{
  projectId: string;
  status: string;
  locked: boolean;
  message: string;
}> {
  return apiRequest(`/api/projects/${projectId}/review/submit`, {
    method: "POST",
    json: { note },
  });
}

export async function askProjectAi(projectId: string, question: string): Promise<{
  answer: string;
  sourcesUsed: Array<Record<string, unknown>>;
  modelCitations: Array<Record<string, unknown>>;
  sourceCitations: Array<Record<string, unknown>>;
  warnings: string[];
  usage: Record<string, unknown>;
}> {
  return apiRequest(`/api/projects/${projectId}/ask-ai`, {
    method: "POST",
    json: {
      question,
      includeExternalSources: false,
    },
  });
}

export async function runBalanceSheetDiagnosis(projectId: string): Promise<{
  runId: string | null;
  projectId: string;
  status: string;
  imbalanceAmount: string | null;
  candidates: Array<Record<string, unknown>>;
}> {
  return apiRequest(`/api/projects/${projectId}/diagnosis/balance-sheet/run`, {
    method: "POST",
  });
}

export async function acceptBalanceSheetDiagnosis(projectId: string, candidateId: string): Promise<{
  id: string;
  action: string;
  reasonCode: string;
  field: Record<string, unknown> | null;
}> {
  return apiRequest(`/api/projects/${projectId}/diagnosis/balance-sheet/${candidateId}/accept`, {
    method: "POST",
  });
}

export async function createReviewComment(projectId: string, input: {
  body: string;
  fieldId?: string;
  templateCell?: string;
  sheetName?: string;
}): Promise<{
  id: string;
  body: string;
  status: string;
  mentions: Record<string, unknown>;
}> {
  return apiRequest(`/api/projects/${projectId}/comments`, {
    method: "POST",
    json: input,
  });
}

export async function generateExecutiveBrief(projectId: string): Promise<{
  id: string;
  projectId: string;
  version: number;
  status: string;
  generatedBy: string;
  payload: Record<string, unknown>;
  createdAt: string;
  lockedAt: string | null;
}> {
  return apiRequest(`/api/projects/${projectId}/briefs/generate`, {
    method: "POST",
  });
}

export async function recordManagerDecision(projectId: string, input: {
  action: "approve" | "send_back";
  note?: string;
}): Promise<{
  projectId: string;
  status: string;
  locked: boolean;
  message: string;
}> {
  return apiRequest(`/api/projects/${projectId}/review/manager-decision`, {
    method: "POST",
    json: input,
  });
}

export async function recordCfoSignoff(projectId: string, input: {
  approved: boolean;
  note?: string;
  briefId?: string;
}): Promise<{
  projectId: string;
  status: string;
  locked: boolean;
  message: string;
}> {
  return apiRequest(`/api/projects/${projectId}/review/cfo-signoff`, {
    method: "POST",
    json: input,
  });
}

export async function runProjectForecast(projectId: string, input: {
  query?: string;
  sourceIds?: string[];
  sourceGroup?: string;
  projectionYears?: number;
} = {}): Promise<{
  status: string;
  projectId: string;
  companyName: string;
  sector: string | null;
  projectionYears: number;
  sourceStatus: string;
  sourceReason: string | null;
  steps: Array<Record<string, unknown>>;
  scenarios: Array<Record<string, unknown>>;
  assumptions: Array<Record<string, unknown>>;
  citations: Array<Record<string, unknown>>;
  warnings: string[];
}> {
  return apiRequest(`/api/projects/${projectId}/forecast/run`, {
    method: "POST",
    json: {
      sourceGroup: "forecast",
      projectionYears: 5,
      ...input,
    },
  });
}

export async function generateProjectAssumptions(projectId: string, forecast?: Record<string, unknown>): Promise<{
  status: string;
  projectId: string;
  sheetName: string;
  generatedAt: string;
  writePolicy: Record<string, unknown>;
  rows: Array<Record<string, unknown>>;
  summary: Record<string, number>;
}> {
  return apiRequest(`/api/projects/${projectId}/assumptions/generate`, {
    method: "POST",
    json: {
      includeForecastDrivers: true,
      forecast,
    },
  });
}

export async function getLatestModelArchive(projectId: string): Promise<{
  id: string;
  projectId: string;
  version: number;
  status: string;
  checksumSha256: string;
  createdAt: string;
  approvedBy: string;
  auditJsonUrl: string;
  pdfAvailable: boolean;
}> {
  return apiRequest(`/api/projects/${projectId}/archive/latest`);
}

export async function downloadArchiveAuditJson(projectId: string, archiveId: string): Promise<Record<string, unknown>> {
  return apiRequest(`/api/projects/${projectId}/archive/${archiveId}/audit.json`);
}

export type AnalysisRequestResponse = {
  id: string;
  assignedAnalystEmail: string;
  companyName: string;
  companySymbol: string | null;
  sector: string | null;
  fiscalYear: string | null;
  template: string;
  priority: string;
  dueDate: string | null;
  note: string | null;
  status: string;
  projectId: string | null;
  emailStatus: string;
  emailResult: Record<string, unknown>;
  createdAt: string;
  acknowledgedAt: string | null;
  convertedAt: string | null;
};

export async function createAnalysisRequest(input: {
  assignedAnalystEmail: string;
  companyName: string;
  companySymbol?: string;
  sector?: string;
  fiscalYear?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  dueDate?: string;
  note?: string;
}): Promise<AnalysisRequestResponse> {
  return apiRequest("/api/analysis-requests", {
    method: "POST",
    json: {
      ...input,
      template: "Millat - Template.xlsx",
    },
  });
}

export async function listAnalysisRequests(): Promise<AnalysisRequestResponse[]> {
  return apiRequest("/api/analysis-requests");
}

export async function getAnalysisRequest(requestId: string): Promise<AnalysisRequestResponse> {
  return apiRequest(`/api/analysis-requests/${requestId}`);
}

export async function acknowledgeAnalysisRequest(requestId: string): Promise<AnalysisRequestResponse> {
  return apiRequest(`/api/analysis-requests/${requestId}/acknowledge`, {
    method: "POST",
  });
}

export async function convertAnalysisRequestToProject(requestId: string): Promise<AnalysisRequestResponse> {
  return apiRequest(`/api/analysis-requests/${requestId}/convert-to-project`, {
    method: "POST",
  });
}

export async function toggleProjectMappingRule(projectId: string, ruleCode: string, enabled: boolean): Promise<MappingRulesSummary> {
  return apiRequest(`/api/projects/${projectId}/mapping-rules/${ruleCode}`, {
    method: "PATCH",
    json: { enabled },
  });
}

async function apiRequest<T>(
  path: string,
  init: { method?: string; json?: unknown; body?: BodyInit } = {},
): Promise<T> {
  const session = loadSession();
  if (!session) {
    throw new ProjectApiError("Sign in before starting ingestion.", 401);
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
  };
  let body = init.body;
  if (init.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: init.method ?? "GET",
    headers,
    body,
  });

  if (!response.ok) {
    throw new ProjectApiError(await readErrorMessage(response), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") {
      return body.detail;
    }
    if (body.detail && typeof body.detail === "object" && "message" in body.detail) {
      return String((body.detail as { message: unknown }).message);
    }
    if (Array.isArray(body.detail) && body.detail[0]?.msg) {
      return String(body.detail[0].msg);
    }
  } catch {
    // Fall through to status text.
  }
  return response.statusText || "Request failed.";
}
