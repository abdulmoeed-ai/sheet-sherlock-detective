import { apiFetch } from "./client";
import type { AnalysisRequestResponse } from "./types";

export interface AnalysisRequestCreateInput {
  assignedAnalystEmail: string;
  companyName: string;
  companySymbol?: string | null;
  sector?: string | null;
  fiscalYear?: string | null;
  template: "Millat - Template.xlsx" | "Cement Sector Template Presentation.xlsx" | "E&P Sector Template Presentation.xlsx";
  priority: "low" | "normal" | "high" | "urgent";
  dueDate?: string | null;
  note?: string | null;
}

export function listAnalysisRequests() {
  return apiFetch<AnalysisRequestResponse[]>("/api/analysis-requests");
}

export function createAnalysisRequest(input: AnalysisRequestCreateInput) {
  return apiFetch<AnalysisRequestResponse>("/api/analysis-requests", { method: "POST", body: input });
}

export function acknowledgeAnalysisRequest(requestId: string) {
  return apiFetch<AnalysisRequestResponse>(`/api/analysis-requests/${requestId}/acknowledge`, { method: "POST" });
}

export function convertAnalysisRequestToProject(requestId: string) {
  return apiFetch<AnalysisRequestResponse>(`/api/analysis-requests/${requestId}/convert-to-project`, { method: "POST" });
}
