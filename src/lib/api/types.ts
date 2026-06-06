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

export type PortfolioDashboardVisibility = "private" | "public";
export type PortfolioDashboardScope = "my" | "public" | "all";

export interface PortfolioCompanySelection {
  symbol: string;
  name: string;
  sector: string;
}

export interface PortfolioDashboardResponse {
  id: string;
  name: string;
  description: string | null;
  visibility: PortfolioDashboardVisibility;
  createdByUserId: string;
  createdByName: string;
  createdByRole: BackendRole | string;
  companySelections: PortfolioCompanySelection[];
  createdAt: string;
  updatedAt: string;
  lastExportedAt: string | null;
}

export interface PortfolioDashboardInput {
  name: string;
  description?: string | null;
  visibility?: PortfolioDashboardVisibility;
  companySelections: PortfolioCompanySelection[];
}

export interface PortfolioDashboardUpdateInput {
  name?: string;
  description?: string | null;
  visibility?: PortfolioDashboardVisibility;
  companySelections?: PortfolioCompanySelection[];
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

export interface AskAiChatMessageResponse {
  id: string;
  role: "user" | "assistant" | string;
  content: string;
  routePath: string | null;
  screenName: string | null;
  citations: Array<Record<string, unknown>>;
  warnings: string[];
  usage: Record<string, unknown>;
  retrievalSnapshot: Record<string, unknown>;
  createdAt: string;
}

export interface AskAiChatSessionSummary {
  id: string;
  projectId: string;
  projectLabel: string | null;
  companyName: string | null;
  title: string | null;
  routePath: string | null;
  screenName: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AskAiChatSessionResponse extends AskAiChatSessionSummary {
  messages: AskAiChatMessageResponse[];
}

export interface AskAiModelCandidate {
  id: string;
  companyName: string;
  projectLabel: string | null;
  fiscalYear: string | null;
  sector: string | null;
  status: string;
  score: number;
  matchReason: string;
  accessSource: "owned" | "assigned_inbox" | string;
}

export interface AskAiModelSearchResponse {
  query: string;
  candidates: AskAiModelCandidate[];
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
  documentIds: string[];
  error: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ExtractionProgressEventResponse {
  eventId: string;
  projectId: string;
  jobId: string;
  documentId: string | null;
  documentFilename: string | null;
  stage: string;
  status: string;
  percent: number;
  title: string;
  message: string;
  ruleCodes: string[];
  cellRef: string | null;
  sheetName: string | null;
  confidenceLevel: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface RagIndexStatusResponse {
  projectId: string;
  status: "not_indexed" | "queued" | "running" | "ready" | "stale" | "failed" | string;
  readyForAskAi: boolean;
  stale: boolean;
  stage?: string | null;
  percent: number;
  message?: string | null;
  latestJobId?: string | null;
  embeddingModel?: string | null;
  embeddingDim?: number | null;
  indexVersion?: string | null;
  errorCode?: string | null;
  errorDetail?: string | null;
  updatedAt?: string | null;
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
  parentCommentId?: string | null;
}

export interface WorkbookSaveInput {
  workbook: Record<string, unknown>;
  action?: string;
  sheetId?: string | null;
  sheetName?: string | null;
  cellAddress?: string | null;
  fieldId?: string | null;
  oldCell?: Record<string, unknown> | null;
  newCell?: Record<string, unknown> | null;
}

export interface ProjectVersionCreateInput {
  workbook?: Record<string, unknown> | null;
}

export interface WorkbookRevisionResponse {
  id: string;
  projectId: string;
  actor: string;
  actorName?: string | null;
  action: string;
  sheetId?: string | null;
  sheetName?: string | null;
  cellAddress?: string | null;
  fieldId?: string | null;
  oldPayload?: Record<string, unknown> | null;
  newPayload?: Record<string, unknown> | null;
  createdAt: string;
}

export interface WorkbookSaveResponse {
  projectId: string;
  workbook: Record<string, unknown>;
  revision: WorkbookRevisionResponse;
}

export interface ReviewCommentResponse {
  id: string;
  projectId: string;
  fieldId: string | null;
  templateCell: string | null;
  sheetName: string | null;
  parentCommentId?: string | null;
  actor: string;
  actorName?: string | null;
  body: string;
  mentions: Record<string, unknown>;
  status: string;
  replyCount?: number;
  replies?: ReviewCommentResponse[];
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

export interface SourceSearchResultResponse {
  title: string;
  url: string;
  excerpt: string;
  score?: number | null;
  sourceId: string;
  sourceName: string;
  publicationDate?: string | null;
}

export interface SourceSearchResponse {
  status: string;
  query: string;
  results: SourceSearchResultResponse[];
  rejectedResults: number;
  allowedDomains: string[];
  reason?: string | null;
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
