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
    if (Array.isArray(body.detail) && body.detail[0]?.msg) {
      return String(body.detail[0].msg);
    }
  } catch {
    // Fall through to status text.
  }
  return response.statusText || "Request failed.";
}
