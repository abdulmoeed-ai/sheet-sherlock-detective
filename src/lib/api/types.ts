export type BackendRole = "finance_analyst" | "finance_manager" | "cfo" | "admin";
export type FrontendRole = "analyst" | "manager" | "cfo" | "admin";

export interface UserRead {
  id: string;
  email: string;
  name: string;
  role: BackendRole;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
}

export interface ReviewProgress {
  total: number;
  reviewed: number;
}

export interface TeamMember {
  name: string;
  email: string;
  initials?: string | null;
  role: string;
  canRemove: boolean;
}

export interface DocumentResponse {
  id: string;
  filename: string;
  pages: number;
  sizeMB: number;
  status: string;
  cells: ReviewProgress;
  uploadedAt?: string | null;
}

export interface ProjectResponse {
  id: string;
  companyName: string;
  projectLabel: string | null;
  sector: string | null;
  fiscalYear: string | null;
  currencyUnit: string | null;
  template: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  teamMembers: TeamMember[];
  pdfs: DocumentResponse[];
  reviewProgress: ReviewProgress;
}

export interface WorkspaceResponse {
  project: ProjectResponse;
  documents: DocumentResponse[];
  review: Record<string, unknown>;
  auditEvents: Array<Record<string, unknown>>;
  exportPreview: Record<string, unknown>;
  diagnosisWorkbook?: Record<string, unknown> | null;
  dashboard: Record<string, unknown>;
  ingestionPreviewSummary?: Record<string, unknown> | null;
  threeStatementCheck?: Record<string, unknown> | null;
  balanceSheetDiagnosis?: Record<string, unknown> | null;
}

export interface AnalysisRequestResponse {
  id: string;
  requesterUserId: string;
  assignedAnalystEmail: string;
  assignedAnalystUserId: string | null;
  companyName: string;
  companySymbol: string | null;
  sector: string | null;
  fiscalYear: string | null;
  template: string;
  priority: "low" | "normal" | "high" | "urgent";
  dueDate: string | null;
  note: string | null;
  status: string;
  projectId: string | null;
  emailStatus: string;
  emailResult: Record<string, unknown>;
  auditEvents: Array<Record<string, unknown>>;
  createdAt: string;
  acknowledgedAt: string | null;
  convertedAt: string | null;
}

export interface ExtractionJobResponse {
  id: string;
  projectId: string;
  status: string;
  percent: number;
  message: string;
  error: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface MappingRulesSummaryResponse {
  rulesHash: string;
  rulesCount: number;
  enabledRulesCount: number;
  disabledRulesCount: number;
  categoryCounts: Record<string, number>;
  criticalCount: number;
  advisoryCount: number;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  rules: Array<Record<string, unknown>>;
}

export interface ReviewHandoffResponse {
  projectId: string;
  status: string;
  locked: boolean;
  message: string;
}

export interface ReviewCommentInput {
  body: string;
  fieldId?: string | null;
  templateCell?: string | null;
  sheetName?: string | null;
}

export interface ReviewCommentResponse {
  id: string;
  projectId: string;
  fieldId: string | null;
  templateCell: string | null;
  sheetName: string | null;
  actor: string;
  body: string;
  mentions: Record<string, unknown>;
  status: string;
  createdAt: string;
  updatedAt: string | null;
  editedAt: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface ExcelExportResponse {
  id: string;
  projectId: string;
  status: string;
  warnings: Array<Record<string, unknown>>;
  exportedAt: string | null;
  downloadUrl: string;
}

export interface BalanceSheetAssistantResponse {
  runId: string | null;
  projectId: string;
  checkRunId: string | null;
  status: string;
  imbalanceAmount: string | null;
  createdAt: string | null;
  candidates: Array<Record<string, unknown>>;
  threeStatementCheck?: Record<string, unknown> | null;
  assistant: {
    summary?: string;
    assumptions?: string[];
    warnings?: string[];
    activity?: Array<Record<string, unknown>>;
    citations?: Array<Record<string, unknown>>;
    retrievalResults?: Array<Record<string, unknown>>;
    candidates?: Array<Record<string, unknown>>;
  };
}

export interface ForecastRunResponse {
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
}

export interface AssumptionsGenerateResponse {
  status: string;
  projectId: string;
  sheetName: string;
  generatedAt: string;
  writePolicy: Record<string, unknown>;
  rows: Array<Record<string, unknown>>;
  summary: Record<string, number>;
}

export interface ExecutiveBriefResponse {
  id: string;
  projectId: string;
  version: number;
  status: string;
  generatedBy: string;
  payload: Record<string, unknown>;
  createdAt: string;
  lockedAt: string | null;
}

export interface ModelArchiveResponse {
  id: string;
  projectId: string;
  version: number;
  status: string;
  checksumSha256: string;
  createdAt: string;
  approvedBy: string;
  auditJsonUrl: string;
  pdfAvailable: boolean;
}
