# Frontend API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the new Sheet Sherlock frontend's static/local state with the existing backend APIs while preserving the current UI screens and adding Analyst, Manager, CFO, and Admin role experiences.

**Architecture:** Add a typed frontend API layer, auth/session state, selected-project state, role guards, and React Query hooks. Screens keep their current visual layout but read from backend DTOs and mutate through backend endpoints. Backend code is not changed in this plan; any backend access mismatch discovered during verification is recorded as a backend follow-up.

**Tech Stack:** React 19, TanStack Router, TanStack Query, TypeScript, Vite/Bun frontend, FastAPI backend, JWT bearer auth, Server-Sent Events for Ask AI, WebSocket progress stream.

---

## Implementation Scope

In scope:

- Add frontend API client, DTOs, auth store, query keys, and hooks.
- Add Login/Register role selection for Analyst, Manager, and CFO; Admin login is supported for seeded/admin-created users because backend self-service registration does not currently accept `admin`.
- Add a Manager Request form for creating analyst work requests.
- Treat `/inbox` as the renamed Requests tab where analysts see manager-generated requests.
- Replace static data on all workflow screens with backend API reads and mutations.
- Remove the Diff Review frontend surface; analysts move from ingestion into diagnosis/review-cell resolution without a separate `/diff-review` route.
- Route Analyst, Manager, CFO, and Admin users to different default experiences.
- Filter `src/components/Sidebar.tsx` menus to show only the items relevant to the logged-in user role.
- Surface backend error details in UI.
- Preserve the current screen design and navigation shape where possible.
- Record any unclear implementation detail in `docs/implementation/api-integration/03-open-questions.md` and ask the user instead of assuming.

Out of scope:

- Backend schema or permission changes.
- Replacing backend archive PDF support; backend currently reports `pdfAvailable`.
- Self-service Admin registration unless the backend `UserCreate` contract changes.
- Credential rotation UI for sources unless a backend endpoint exists; Admin source screens should start with backend-supported read/admin mapping-rule actions.

## File Structure

Create:

- `src/lib/api/config.ts`: API and WebSocket URL helpers.
- `src/lib/api/errors.ts`: typed error class and backend detail parsing.
- `src/lib/api/types.ts`: TypeScript DTOs matching `backend/app/schemas/auth.py` and `backend/app/schemas/projects.py`.
- `src/lib/api/client.ts`: JSON, multipart, binary, and SSE fetch helpers with auth retry.
- `src/lib/api/auth.ts`: auth endpoints.
- `src/lib/api/analysis-requests.ts`: manager/analyst request endpoints.
- `src/lib/api/projects.ts`: project, upload, extraction, workspace, review, diagnosis, forecast, assumptions, brief, archive endpoints.
- `src/lib/api/source-registry.ts`: source registry endpoint.
- `src/lib/api/query-keys.ts`: stable React Query keys.
- `src/lib/auth-store.ts`: local token persistence and current-user helpers.
- `src/lib/project-store.ts`: selected project persistence and migration away from `cycle-store`.
- `src/lib/role-access.ts`: role label mapping, route access, and default route.
- `src/lib/mappers/workspace.ts`: conversion from backend workspace payload to current UI view models.
- `src/hooks/use-auth.ts`: auth queries and mutations.
- `src/hooks/use-analysis-requests.ts`: request list/create/acknowledge/convert hooks.
- `src/hooks/use-projects.ts`: project list/create/workspace hooks.
- `src/hooks/use-project-actions.ts`: upload, extraction, review, diagnosis, forecast, assumptions, handoff hooks.
- `src/hooks/use-progress-stream.ts`: websocket progress subscription.
- `src/hooks/use-ask-ai-stream.ts`: Ask AI SSE client hook.
- `src/routes/login.tsx`: login/register screen with Analyst/Manager/CFO selector and support for Admin login.

Modify:

- `src/router.tsx`: QueryClient defaults.
- `src/routes/__root.tsx`: auth hydration, route protection shell, Ask AI project context.
- `src/components/Sidebar.tsx`: user identity, role label, and role-filtered nav for Analyst, Manager, CFO, and Admin.
- `src/components/AskAiTrigger.tsx` and `src/components/AskAiPanel.tsx`: call backend stream.
- `src/components/SourcePreviewPanel.tsx`: render backend PDF page images.
- `src/lib/cycle-store.ts`: keep only as compatibility shim or replace usages with `project-store`.
- `src/routes/index.tsx`: role-aware dashboard, including the Manager Request form.
- `src/routes/inbox.tsx`: analyst Inbox for manager-generated analysis requests.
- `src/routes/registry.tsx`: project registry from backend projects.
- `src/routes/ingestion.tsx`: source registry, mapping rules, upload, extraction, progress.
- `src/routes/diagnosis.tsx`: workbook preview, diagnosis, comments, review-cell edits.
- `src/routes/forecast.tsx`: backend forecast response.
- `src/routes/assumptions.tsx`: backend assumptions generation and submit-to-manager handoff.
- `src/routes/review.tsx`: manager review pack, comments, approve/send-back.
- `src/routes/sign-off.tsx`: CFO sign-off workflow.
- `src/routes/audit.tsx`: workspace audit events and archive JSON download.
- `src/routes/sources.tsx`: Admin source registry and admin mapping-rule entry points where project context exists.

Test:

- Add `src/lib/api/client.test.ts`.
- Add `src/lib/role-access.test.ts`.
- Add `src/lib/mappers/workspace.test.ts`.
- Add focused route tests only for auth guards and role nav if the test stack is added.

## Task 1: API Foundation

**Files:**

- Create: `src/lib/api/config.ts`
- Create: `src/lib/api/errors.ts`
- Create: `src/lib/auth-store.ts`
- Create: `src/lib/api/client.ts`
- Create: `src/lib/api/query-keys.ts`
- Modify: `src/router.tsx`
- Test: `src/lib/api/client.test.ts`

- [ ] **Step 1: Add test runner**

Run:

```bash
bun add -d vitest jsdom @testing-library/react @testing-library/user-event
```

Modify `package.json` scripts:

```json
{
  "test": "vitest run",
  "test:watch": "vitest"
}
```

Expected: `bun.lock` and `package.json` update.

- [ ] **Step 2: Write API client tests**

Create `src/lib/api/client.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./client";
import { clearAuthTokens, setAuthTokens } from "@/lib/auth-store";

describe("apiFetch", () => {
  beforeEach(() => {
    clearAuthTokens();
    vi.restoreAllMocks();
  });

  it("adds a bearer token when one is stored", async () => {
    setAuthTokens({ accessToken: "access-1", refreshToken: "refresh-1" });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch<{ ok: boolean }>("/api/projects");

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer access-1");
  });

  it("throws the backend detail string when the backend returns an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ detail: "Only PDF files are supported." }), {
            status: 400,
          }),
        ),
    );

    await expect(apiFetch("/api/projects/p1/documents")).rejects.toMatchObject({
      status: 400,
      message: "Only PDF files are supported.",
    });
  });
});
```

- [ ] **Step 3: Run the failing tests**

Run:

```bash
bun test src/lib/api/client.test.ts
```

Expected: fails because `src/lib/api/client.ts` and `src/lib/auth-store.ts` do not exist.

- [ ] **Step 4: Implement config**

Create `src/lib/api/config.ts`:

```ts
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function wsUrl(path: string): string {
  const base = new URL(API_BASE_URL);
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  base.pathname = path.startsWith("/") ? path : `/${path}`;
  base.search = "";
  return base.toString();
}
```

- [ ] **Step 5: Implement token storage**

Create `src/lib/auth-store.ts`:

```ts
const ACCESS_KEY = "sheet_sherlock_access_token";
const REFRESH_KEY = "sheet_sherlock_refresh_token";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function setAuthTokens(tokens: AuthTokens): void {
  window.localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  window.localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
}

export function clearAuthTokens(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}
```

- [ ] **Step 6: Implement error parsing and client**

Create `src/lib/api/errors.ts`:

```ts
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly payload: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
```

Create `src/lib/api/client.ts`:

```ts
import { getAccessToken } from "@/lib/auth-store";
import { apiUrl } from "./config";
import { ApiError } from "./errors";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  rawBody?: BodyInit;
};

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    ...(options.rawBody instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string> | undefined),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const response = await fetch(apiUrl(path), {
    ...options,
    headers,
    body:
      options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
  });
  if (!response.ok) {
    const payload = await safeJson(response);
    throw new ApiError(response.status, backendMessage(payload, response.status), payload);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function apiBlob(path: string): Promise<Blob> {
  const token = getAccessToken();
  const response = await fetch(apiUrl(path), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const payload = await safeJson(response);
    throw new ApiError(response.status, backendMessage(payload, response.status), payload);
  }
  return response.blob();
}

async function safeJson(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function backendMessage(payload: any, status: number): string {
  if (typeof payload?.detail === "string") return payload.detail;
  if (payload?.detail?.message && typeof payload.detail.message === "string")
    return payload.detail.message;
  return `Request failed with ${status}`;
}
```

- [ ] **Step 7: Configure QueryClient defaults**

Modify `src/router.tsx`:

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
```

- [ ] **Step 8: Run tests**

Run:

```bash
bun test src/lib/api/client.test.ts
```

Expected: tests pass.

## Task 2: Typed API Modules

**Files:**

- Create: `src/lib/api/types.ts`
- Create: `src/lib/api/auth.ts`
- Create: `src/lib/api/analysis-requests.ts`
- Create: `src/lib/api/projects.ts`
- Create: `src/lib/api/source-registry.ts`
- Create: `src/lib/api/query-keys.ts`

- [ ] **Step 1: Add core DTO types**

Create `src/lib/api/types.ts` with these exported types:

```ts
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

export interface ReviewHandoffResponse {
  projectId: string;
  status: string;
  locked: boolean;
  message: string;
}
```

- [ ] **Step 2: Add auth module**

Create `src/lib/api/auth.ts`:

```ts
import { apiFetch } from "./client";
import type { BackendRole, TokenResponse, UserRead } from "./types";

export function registerUser(input: {
  email: string;
  name: string;
  password: string;
  role: Extract<BackendRole, "finance_analyst" | "finance_manager" | "cfo">;
}) {
  return apiFetch<UserRead>("/api/auth/register", { method: "POST", body: input });
}

export function loginUser(input: { email: string; password: string }) {
  return apiFetch<TokenResponse>("/api/auth/login", { method: "POST", body: input });
}

export function refreshToken(refreshToken: string) {
  return apiFetch<TokenResponse>("/api/auth/refresh", {
    method: "POST",
    body: { refresh_token: refreshToken },
  });
}

export function readCurrentUser() {
  return apiFetch<UserRead>("/api/auth/me");
}
```

- [ ] **Step 3: Add analysis request module**

Create `src/lib/api/analysis-requests.ts`:

```ts
import { apiFetch } from "./client";
import type { AnalysisRequestResponse } from "./types";

export interface AnalysisRequestCreateInput {
  assignedAnalystEmail: string;
  companyName: string;
  companySymbol?: string | null;
  sector?: string | null;
  fiscalYear?: string | null;
  template: "Millat - Template.xlsx";
  priority: "low" | "normal" | "high" | "urgent";
  dueDate?: string | null;
  note?: string | null;
}

export function listAnalysisRequests() {
  return apiFetch<AnalysisRequestResponse[]>("/api/analysis-requests");
}

export function createAnalysisRequest(input: AnalysisRequestCreateInput) {
  return apiFetch<AnalysisRequestResponse>("/api/analysis-requests", {
    method: "POST",
    body: input,
  });
}

export function acknowledgeAnalysisRequest(requestId: string) {
  return apiFetch<AnalysisRequestResponse>(`/api/analysis-requests/${requestId}/acknowledge`, {
    method: "POST",
  });
}

export function convertAnalysisRequestToProject(requestId: string) {
  return apiFetch<AnalysisRequestResponse>(
    `/api/analysis-requests/${requestId}/convert-to-project`,
    { method: "POST" },
  );
}
```

- [ ] **Step 4: Add project module**

Create `src/lib/api/projects.ts` with endpoint wrappers for every project API listed in `docs/implementation/api-integration/00-backend-api-inventory.md`. Include at minimum:

```ts
import { apiBlob, apiFetch } from "./client";
import type {
  ExtractionJobResponse,
  ProjectResponse,
  ReviewHandoffResponse,
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

export function readWorkspace(projectId: string) {
  return apiFetch<WorkspaceResponse>(`/api/projects/${projectId}/workspace`);
}

export function uploadDocument(projectId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiFetch(`/api/projects/${projectId}/documents`, { method: "POST", rawBody: form });
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

export function readDocumentPageImage(projectId: string, documentId: string, pdfPageIndex: number) {
  return apiBlob(`/api/projects/${projectId}/documents/${documentId}/pages/${pdfPageIndex}/image`);
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
```

- [ ] **Step 5: Add source registry and query keys**

Create `src/lib/api/source-registry.ts`:

```ts
import { apiFetch } from "./client";

export interface SourceRegistryResponse {
  sources: Array<Record<string, unknown>>;
}

export function readSourceRegistry() {
  return apiFetch<SourceRegistryResponse>("/api/source-registry");
}
```

Create `src/lib/api/query-keys.ts`:

```ts
export const queryKeys = {
  me: ["auth", "me"] as const,
  analysisRequests: ["analysis-requests"] as const,
  projects: ["projects"] as const,
  workspace: (projectId: string) => ["projects", projectId, "workspace"] as const,
  sourceRegistry: ["source-registry"] as const,
  extractionJob: (projectId: string, jobId: string) =>
    ["projects", projectId, "extractions", jobId] as const,
};
```

## Task 3: Auth, Roles, And Navigation

**Files:**

- Create: `src/lib/role-access.ts`
- Create: `src/hooks/use-auth.ts`
- Create: `src/routes/login.tsx`
- Modify: `src/routes/__root.tsx`
- Modify: `src/components/Sidebar.tsx`
- Test: `src/lib/role-access.test.ts`

- [ ] **Step 1: Define four-role mapping and route access**

Create `src/lib/role-access.ts`:

```ts
import type { BackendRole, FrontendRole } from "@/lib/api/types";

export function frontendRole(role: BackendRole): FrontendRole {
  if (role === "finance_manager") return "manager";
  if (role === "finance_analyst") return "analyst";
  return role;
}

export function backendRole(
  role: Exclude<FrontendRole, "admin">,
): "finance_analyst" | "finance_manager" | "cfo" {
  if (role === "manager") return "finance_manager";
  if (role === "analyst") return "finance_analyst";
  return "cfo";
}

export function roleLabel(role: BackendRole): string {
  if (role === "finance_analyst") return "Analyst";
  if (role === "finance_manager") return "Manager";
  if (role === "cfo") return "CFO";
  return "Admin";
}

export function defaultRouteForRole(role: BackendRole): string {
  if (role === "finance_analyst") return "/inbox";
  if (role === "finance_manager") return "/";
  if (role === "cfo") return "/sign-off";
  return "/sources";
}

const routeRoles: Record<string, BackendRole[]> = {
  "/": ["finance_analyst", "finance_manager", "cfo", "admin"],
  "/inbox": ["finance_analyst"],
  "/registry": ["finance_analyst", "finance_manager", "cfo", "admin"],
  "/ingestion": ["finance_analyst"],
  "/diagnosis": ["finance_analyst"],
  "/forecast": ["finance_analyst"],
  "/assumptions": ["finance_analyst"],
  "/review": ["finance_manager"],
  "/sign-off": ["cfo"],
  "/protection": ["admin"],
  "/notifications": ["finance_analyst", "finance_manager", "cfo", "admin"],
  "/audit": ["finance_analyst", "finance_manager", "cfo", "admin"],
  "/sources": ["admin"],
};

export function canSeeRoute(role: BackendRole, pathname: string): boolean {
  if (pathname === "/login") return true;
  return routeRoles[pathname]?.includes(role) ?? false;
}
```

- [ ] **Step 2: Test role access**

Create `src/lib/role-access.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { backendRole, canSeeRoute, defaultRouteForRole, frontendRole } from "./role-access";

describe("role access", () => {
  it("maps frontend roles to backend role values", () => {
    expect(backendRole("manager")).toBe("finance_manager");
    expect(backendRole("analyst")).toBe("finance_analyst");
    expect(backendRole("cfo")).toBe("cfo");
    expect(frontendRole("finance_manager")).toBe("manager");
    expect(frontendRole("finance_analyst")).toBe("analyst");
    expect(frontendRole("cfo")).toBe("cfo");
    expect(frontendRole("admin")).toBe("admin");
  });

  it("routes each role to its default workflow", () => {
    expect(defaultRouteForRole("finance_manager")).toBe("/");
    expect(defaultRouteForRole("finance_analyst")).toBe("/inbox");
    expect(defaultRouteForRole("cfo")).toBe("/sign-off");
    expect(defaultRouteForRole("admin")).toBe("/sources");
  });

  it("filters role-specific routes", () => {
    expect(canSeeRoute("finance_analyst", "/review")).toBe(false);
    expect(canSeeRoute("finance_manager", "/ingestion")).toBe(false);
    expect(canSeeRoute("finance_manager", "/review")).toBe(true);
    expect(canSeeRoute("finance_analyst", "/diagnosis")).toBe(true);
    expect(canSeeRoute("cfo", "/sign-off")).toBe(true);
    expect(canSeeRoute("cfo", "/ingestion")).toBe(false);
    expect(canSeeRoute("admin", "/sources")).toBe(true);
    expect(canSeeRoute("admin", "/assumptions")).toBe(false);
  });
});
```

- [ ] **Step 3: Implement auth hook**

Create `src/hooks/use-auth.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loginUser, readCurrentUser, registerUser } from "@/lib/api/auth";
import { queryKeys } from "@/lib/api/query-keys";
import { clearAuthTokens, getAccessToken, setAuthTokens } from "@/lib/auth-store";

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: readCurrentUser,
    enabled: !!getAccessToken(),
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: loginUser,
    onSuccess: (tokens) => {
      setAuthTokens({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
}

export function useRegister() {
  return useMutation({ mutationFn: registerUser });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return () => {
    clearAuthTokens();
    queryClient.clear();
  };
}
```

- [ ] **Step 4: Add `/login` route**

Create `src/routes/login.tsx`:

- Tabs or segmented control for registration: `Analyst`, `Manager`, `CFO`.
- Admin users log in with seeded/admin-created credentials; do not show Admin registration unless backend `UserCreate` accepts it.
- Login form: email/password.
- Register form: name/email/password/role.
- Register role values must use `backendRole("analyst")`, `backendRole("manager")`, or `backendRole("cfo")`.
- After successful login, call `GET /api/auth/me`; navigate to `defaultRouteForRole(me.role)`.

- [ ] **Step 5: Protect root routes**

Modify `src/routes/__root.tsx`:

- Use `useCurrentUser`.
- If no token and route is not `/login`, redirect or render login link.
- If `canSeeRoute(user.role, pathname)` is false, redirect to `defaultRouteForRole(user.role)`.

- [ ] **Step 6: Role-filter sidebar**

Modify `src/components/Sidebar.tsx`:

- Read `useCurrentUser`.
- Display user initials, name, and `roleLabel(user.role)`.
- Filter nav items with `canSeeRoute`.
- Define `roles` on each nav item and render only items where `roles.includes(currentUser.role)`.
- Expected Sidebar visibility:
  - Analyst: Dashboard, Inbox, Model Registry, Ingestion, Diagnosis, Forecast, Assumptions, Notifications, Audit Trail.
  - Manager: Dashboard, Model Registry, Manager Review, Notifications, Audit Trail.
  - CFO: Dashboard, Model Registry, CFO Sign-Off, Notifications, Audit Trail.
  - Admin: Dashboard, Model Registry, Sources Admin, Protection, Notifications, Audit Trail.

## Task 4: Project, Manager Request Form, And Analyst Inbox State

**Files:**

- Create: `src/lib/project-store.ts`
- Create: `src/hooks/use-analysis-requests.ts`
- Create: `src/hooks/use-projects.ts`
- Modify: `src/routes/index.tsx`
- Modify: `src/routes/inbox.tsx`
- Modify: `src/routes/registry.tsx`

- [ ] **Step 1: Selected project store**

Create `src/lib/project-store.ts`:

```ts
const PROJECT_KEY = "sheet_sherlock_selected_project_id";

export function getSelectedProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(PROJECT_KEY);
}

export function setSelectedProjectId(projectId: string): void {
  window.localStorage.setItem(PROJECT_KEY, projectId);
  window.dispatchEvent(new CustomEvent("sheet-sherlock-project-selected", { detail: projectId }));
}

export function clearSelectedProjectId(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PROJECT_KEY);
}
```

- [ ] **Step 2: Add request and project hooks**

Create `src/hooks/use-analysis-requests.ts`:

```ts
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
```

Create `src/hooks/use-projects.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createProject, listProjects, readWorkspace } from "@/lib/api/projects";
import { queryKeys } from "@/lib/api/query-keys";

export function useProjects() {
  return useQuery({ queryKey: queryKeys.projects, queryFn: listProjects });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects }),
  });
}

export function useWorkspace(projectId: string | null) {
  return useQuery({
    queryKey: projectId ? queryKeys.workspace(projectId) : ["projects", "none", "workspace"],
    queryFn: () => readWorkspace(projectId as string),
    enabled: !!projectId,
  });
}
```

- [ ] **Step 3: Replace Inbox seed data**

Modify `src/routes/inbox.tsx`:

- Replace `SEED` and local `items`.
- Keep the route label and screen copy as `Inbox`, not `Requests`.
- Treat Inbox as the analyst view of requests generated by the analyst's manager.
- Render `useAnalysisRequests().data`.
- On Accept, call acknowledge.
- On Begin, call convert-to-project, store `projectId`, then navigate to `/ingestion`.
- Show backend error detail if acknowledge or convert fails.

- [ ] **Step 4: Add Manager Request form**

Modify `src/routes/index.tsx` for Manager:

- Show a form titled `Request` or `New Request`.
- The form creates analyst work requests and must include assigned analyst email, company, symbol, sector, fiscal year, priority, due date, and note.
- The form submits this payload shape:

```json
{
  "assignedAnalystEmail": "analyst@example.com",
  "companyName": "Millat Tractors Limited",
  "companySymbol": "MTL",
  "sector": "Engineering & Industrials",
  "fiscalYear": "FY2025",
  "template": "Millat - Template.xlsx",
  "priority": "normal",
  "dueDate": "2026-06-07",
  "note": "Run the FY2025 cycle and prepare manager review pack."
}
```

- On submit, call `createAnalysisRequest`.
- Below the form, show `useAnalysisRequests()` list with status and project link.
- Do not create a separate manager `Requests` tab unless a future requirement asks for it; manager request creation belongs on the manager dashboard for this phase.

Modify `src/routes/index.tsx` for Analyst:

- Show project list from `useProjects`.
- Selecting a project stores selected project id and opens workflow.
- Empty state points to `/inbox`.

- [ ] **Step 5: Registry from projects**

Modify `src/routes/registry.tsx`:

- Replace `modelRegistry` static data with `useProjects`.
- Use `project.companyName`, `project.fiscalYear`, `project.status`, `project.reviewProgress`, and `project.updatedAt`.
- "Begin" creates or selects a backend project, then stores selected project id and navigates to `/ingestion`.

## Task 5: Ingestion And Progress

**Files:**

- Create: `src/hooks/use-project-actions.ts`
- Create: `src/hooks/use-progress-stream.ts`
- Modify: `src/routes/ingestion.tsx`
- Modify: `src/components/SourcePreviewPanel.tsx`
- Modify: `src/routes/sources.tsx`

- [ ] **Step 1: Add action hooks**

Create `src/hooks/use-project-actions.ts` with mutations for:

- `uploadDocument`
- `startExtraction`
- `submitForManagerReview`
- `recordManagerDecision`
- `PATCH review-cells`
- diagnosis run/decision
- forecast run
- assumptions generate
- comments create/update/resolve/reopen/delete

Each mutation should invalidate `queryKeys.workspace(projectId)` on success.

- [ ] **Step 2: Add progress stream hook**

Create `src/hooks/use-progress-stream.ts`:

- Build URL with `wsUrl("/api/ws/projects/${projectId}/progress")`.
- Maintain latest event array.
- Close socket on unmount or project change.
- Expose `events`, `connected`, and `lastEvent`.

- [ ] **Step 3: Replace ingestion route data**

Modify `src/routes/ingestion.tsx`:

- Load selected project id from `project-store`.
- Read workspace and source registry.
- Read mapping rules and block extraction until acknowledged.
- Upload PDF with `POST /documents`.
- Start extraction with `POST /extractions`.
- Poll job with `GET /extractions/{job_id}` and merge websocket events into the feed.
- Show `job.error` exactly when extraction fails.

- [ ] **Step 4: Source preview images**

Modify `src/components/SourcePreviewPanel.tsx`:

- If source evidence includes `documentId` and zero-based `pdfPageIndex`, call `readDocumentPageImage`.
- Render returned PNG as an object URL.
- Keep the current synthetic preview only when backend evidence lacks document/page metadata.

- [ ] **Step 5: Source registry screen**

Modify `src/routes/sources.tsx`:

- Replace hardcoded `SOURCES` with `GET /api/source-registry`.
- Restrict route to Admin via `role-access`.
- Render source metadata from the backend registry.
- Add admin mapping-rule links/actions only when project context exists.
- Remove credential rotation controls unless a backend endpoint is confirmed.

## Task 6: Review, Diagnosis, Forecast, And Assumptions

**Files:**

- Create: `src/lib/mappers/workspace.ts`
- Test: `src/lib/mappers/workspace.test.ts`
- Modify: `src/routes/diagnosis.tsx`
- Modify: `src/routes/forecast.tsx`
- Modify: `src/routes/assumptions.tsx`

- [ ] **Step 1: Add workspace mapper**

Create `src/lib/mappers/workspace.ts`:

- `reviewRows(workspace)` returns rows for diagnosis/review-cell workflows from `workspace.review`.
- `workbookSheets(workspace)` returns workbook sheets from `workspace.exportPreview`.
- `auditRows(workspace)` returns normalized `workspace.auditEvents`.
- `dashboardMetrics(workspace)` returns cards from `workspace.dashboard`.

Keep the mapper tolerant of missing keys and return empty arrays instead of throwing.

- [ ] **Step 2: Test mapper missing-key tolerance**

Create `src/lib/mappers/workspace.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { auditRows, dashboardMetrics, reviewRows, workbookSheets } from "./workspace";

const emptyWorkspace = {
  project: {} as any,
  documents: [],
  review: {},
  auditEvents: [],
  exportPreview: {},
  dashboard: {},
};

describe("workspace mappers", () => {
  it("returns empty collections when optional backend sections are absent", () => {
    expect(reviewRows(emptyWorkspace)).toEqual([]);
    expect(workbookSheets(emptyWorkspace)).toEqual([]);
    expect(auditRows(emptyWorkspace)).toEqual([]);
    expect(dashboardMetrics(emptyWorkspace)).toEqual([]);
  });
});
```

- [ ] **Step 3: Remove Diff Review route**

Remove `src/routes/diff-review.tsx`, remove `/diff-review` from `src/lib/role-access.ts`, remove the Sidebar nav item, and route ingestion follow-up actions to `/diagnosis`.

- [ ] **Step 4: Wire diagnosis**

Modify `src/routes/diagnosis.tsx`:

- Replace `ROWS`, `ISSUES`, and local override state with `workbookSheets(workspace)` and latest diagnosis.
- Recheck button calls `POST /diagnosis/balance-sheet/run`.
- Accept/apply calls diagnosis accept/apply endpoints.
- Override/reject calls diagnosis decision endpoint with the selected reason code.
- Comments panel uses project comment APIs.

- [ ] **Step 5: Wire forecast**

Modify `src/routes/forecast.tsx`:

- Replace `BASE_SCENARIOS` with `POST /forecast/run`.
- Use returned `scenarios`, `assumptions`, `citations`, and `warnings`.
- Keep macro sliders as local overlays and clearly mark values as what-if edits until persisted by a future backend endpoint.

- [ ] **Step 6: Wire assumptions**

Modify `src/routes/assumptions.tsx`:

- Generate rows with `POST /assumptions/generate`.
- Use latest forecast response as the `forecast` request body when available.
- Submit button calls `POST /review/submit`.
- If backend returns a 409 with detail object containing `threeStatementCheck`, render that blocking check instead of a generic toast.

## Task 7: Manager Review, Briefs, Audit, And Ask AI

**Files:**

- Create: `src/hooks/use-ask-ai-stream.ts`
- Modify: `src/routes/review.tsx`
- Modify: `src/routes/sign-off.tsx`
- Modify: `src/routes/audit.tsx`
- Modify: `src/components/AskAiTrigger.tsx`
- Modify: `src/components/AskAiPanel.tsx`

- [ ] **Step 1: Manager review**

Modify `src/routes/review.tsx`:

- Restrict route to Manager via `role-access`.
- Read selected project workspace.
- Render KPIs from `workspace.dashboard`.
- Render diff and override logs from `workspace.review` and `workspace.auditEvents`.
- Approve calls `POST /review/manager-decision` with `{ "action": "approve", "note": draftNote }`.
- Send back calls the same endpoint with `{ "action": "send_back", "note": draftNote }`.
- After approve, read latest brief with `GET /briefs/latest` and show status.

- [ ] **Step 2: CFO sign-off route**

Modify `src/routes/sign-off.tsx`:

- Restrict route to CFO via `role-access`.
- Read selected project latest brief with `GET /briefs/latest`.
- Approve or reject with `POST /review/cfo-signoff`.
- On approval success, refresh latest archive and audit state.

- [ ] **Step 3: Audit route**

Modify `src/routes/audit.tsx`:

- Replace static `log` with `workspace.auditEvents`.
- Replace export JSON with `GET /archive/latest` then `GET /archive/{archive_id}/audit.json`.
- Keep local signed PDF export disabled or labeled unavailable when `pdfAvailable` is false.

- [ ] **Step 4: Ask AI stream**

Create `src/hooks/use-ask-ai-stream.ts`:

- POST to `/api/projects/{project_id}/ask-ai`.
- Send `question`, `sessionId`, `routePath`, `screenName`, `sourceIds`, `documentIds`, `filters`, and `includeExternalSources`.
- Read `text/event-stream` with `ReadableStreamDefaultReader`.
- Append streamed chunks into panel state.
- On backend error, show parsed backend detail.

Modify `AskAiTrigger` and `AskAiPanel`:

- Use selected project id.
- Include current route path and screen name on every question.
- Disable Ask AI until a project is selected.

## Verification Checklist

- [ ] `docs/implementation/api-integration/03-open-questions.md` has no unanswered blocking questions.
- [ ] `bun test` passes.
- [ ] `bun run build` passes.
- [ ] Login as Analyst: `/inbox` loads assigned requests from backend.
- [ ] Analyst accepts and converts a request to a project.
- [ ] Analyst uploads a PDF and sees backend extraction progress or exact backend failure detail.
- [ ] Analyst can resolve review-cell blockers through the diagnosis/workflow screens, run diagnosis, generate forecast, generate assumptions, and submit for manager review.
- [ ] Login as Manager: dashboard shows the Manager Request form and existing analysis requests.
- [ ] Manager can create a request from the dashboard form.
- [ ] Manager can open a submitted project review pack if backend project access allows it.
- [ ] If Manager cannot access a submitted project because backend ownership blocks it, record a backend follow-up and keep frontend behavior showing a clear 403/404 state.
- [ ] Manager can approve or send back through `POST /review/manager-decision` when backend access permits it.
- [ ] Login as CFO: sidebar only shows CFO-relevant menus and CFO can access `/sign-off`.
- [ ] Login as Admin: sidebar only shows Admin-relevant menus and Admin can access `/sources`.
- [ ] Sidebar menus in `src/components/Sidebar.tsx` match the role matrix in `02-role-based-frontend-plan.md`.
