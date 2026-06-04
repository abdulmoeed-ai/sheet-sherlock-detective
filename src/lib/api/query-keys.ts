export const queryKeys = {
  me: ["auth", "me"] as const,
  analysisRequests: ["analysis-requests"] as const,
  projects: ["projects"] as const,
  workspace: (projectId: string) => ["projects", projectId, "workspace"] as const,
  workbookCellHistory: (projectId: string, sheetId: string, cellAddress: string) =>
    ["projects", projectId, "workbook", "cells", sheetId, cellAddress, "history"] as const,
  sourceRegistry: ["source-registry"] as const,
  extractionJob: (projectId: string, jobId: string) =>
    ["projects", projectId, "extractions", jobId] as const,
  comments: (projectId: string) => ["projects", projectId, "comments"] as const,
  mappingRules: (projectId: string) => ["projects", projectId, "mapping-rules"] as const,
  adminMappingRules: (projectId: string) =>
    ["projects", projectId, "mapping-rules", "admin"] as const,
  ingestionPreview: (projectId: string, runId?: string | null) =>
    ["projects", projectId, "ingestion-preview", runId ?? "latest"] as const,
  latestBrief: (projectId: string) => ["projects", projectId, "briefs", "latest"] as const,
  latestArchive: (projectId: string) => ["projects", projectId, "archive", "latest"] as const,
  analysts: ["users", "analysts"] as const,
  psxCompanies: ["psx", "companies"] as const,
};
