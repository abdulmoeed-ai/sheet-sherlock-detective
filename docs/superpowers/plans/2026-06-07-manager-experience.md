# Manager Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Finance Manager experience queue-first, request-first, and approval-focused by restoring request creation, turning Manager Review into a review queue, improving the review detail hierarchy, and removing CFO-era language.

**Architecture:** Keep the existing backend APIs and project workflow intact. Add focused frontend helpers/components for manager queues and request cards, reuse existing hooks where possible, and only introduce new backend endpoints if the existing project/analysis request payloads cannot support the required queue data.

**Tech Stack:** React, TanStack Router, TanStack Query, TypeScript, lucide-react, existing API hooks, Bun test, ESLint.

---

## File Map

- Modify `src/components/Sidebar.tsx`: rename `Manager Review` to `Review Queue`, keep manager-only access, choose an action-oriented icon.
- Modify `src/routes/review.tsx`: split route into queue state and detail state; show queue when no project is selected; show review detail when a project is selected.
- Modify `src/routes/index.tsx`: ensure manager Dashboard stays dashboard-focused and does not hide manager operational actions.
- Modify `src/routes/registry.tsx`: adjust manager-facing create workbook language so it does not conflict with request assignment.
- Create `src/components/manager/ManagerReviewQueue.tsx`: manager review queue UI, filters, rows, empty states, open actions.
- Create `src/components/manager/ManagerRequestPanel.tsx`: create and track analysis requests for managers.
- Create `src/components/manager/ManagerReviewDetailHeader.tsx`: selected workbook context, analyst, version, status, submitted date, readiness.
- Create `src/lib/manager-workspace.ts`: derive manager queues, labels, counts, readiness, and display-safe values from projects and requests.
- Test `src/lib/manager-workspace.test.ts`: queue filtering, status labels, counts, readiness, CFO-language guard.

---

### Task 1: Manager Workspace Derivations

**Files:**
- Create: `src/lib/manager-workspace.ts`
- Create: `src/lib/manager-workspace.test.ts`

- [ ] **Step 1: Add failing tests for manager queue derivations**

Create `src/lib/manager-workspace.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  buildManagerDashboardCounts,
  buildManagerReviewQueue,
  managerProjectStatusLabel,
} from "@/lib/manager-workspace";

const project = (overrides: Partial<any>) => ({
  id: "p1",
  companyName: "Lucky Cement Limited",
  sector: "Cement",
  fiscalYear: "FY2025",
  status: "manager_review",
  projectLabel: "FY2025 Annual Report Analysis",
  createdAt: "2026-06-01T10:00:00Z",
  updatedAt: "2026-06-07T10:00:00Z",
  reviewProgress: { reviewed: 8, total: 10 },
  ...overrides,
});

describe("manager workspace", () => {
  test("builds queue from projects awaiting manager review", () => {
    const queue = buildManagerReviewQueue([
      project({ id: "awaiting", status: "manager_review" }),
      project({ id: "approved", status: "approved" }),
      project({ id: "draft", status: "draft" }),
    ]);

    expect(queue.map((item) => item.id)).toEqual(["awaiting"]);
    expect(queue[0].primaryAction).toBe("Review");
  });

  test("counts manager dashboard workload", () => {
    const counts = buildManagerDashboardCounts([
      project({ id: "a", status: "manager_review" }),
      project({ id: "b", status: "awaiting_review" }),
      project({ id: "c", status: "approved" }),
    ]);

    expect(counts.awaitingReview).toBe(1);
    expect(counts.sentBackOrAnalystWork).toBe(1);
    expect(counts.approvedWorkbooks).toBe(1);
  });

  test("uses manager-friendly labels", () => {
    expect(managerProjectStatusLabel("manager_review")).toBe("Awaiting Manager Review");
    expect(managerProjectStatusLabel("approved")).toBe("Approved");
    expect(managerProjectStatusLabel("cfo_review")).toBe("Manager Review");
  });
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
bun test src/lib/manager-workspace.test.ts
```

Expected: fails because `src/lib/manager-workspace.ts` does not exist.

- [ ] **Step 3: Implement manager derivation helpers**

Create `src/lib/manager-workspace.ts`:

```ts
import type { ProjectResponse } from "@/lib/api/types";
import { isFinalApprovedStatus } from "@/lib/project-status-workflow";

export type ManagerQueueItem = {
  id: string;
  companyName: string;
  sector: string;
  fiscalYear: string;
  status: string;
  statusLabel: string;
  updatedAt: string;
  projectLabel: string;
  reviewed: number;
  total: number;
  readinessLabel: string;
  primaryAction: "Review" | "Open";
};

export function managerProjectStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    initiated: "Initiated",
    draft: "Draft",
    documents_uploaded: "Documents Uploaded",
    extracting: "Extracting",
    awaiting_review: "With Analyst",
    in_diagnosis: "In Diagnosis",
    extraction_failed: "Extraction Failed",
    manager_review: "Awaiting Manager Review",
    approved: "Approved",
    cfo_review: "Manager Review",
    cfo_changes_requested: "Changes Requested",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

export function buildManagerReviewQueue(projects: ProjectResponse[]): ManagerQueueItem[] {
  return projects
    .filter((project) => project.status === "manager_review")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((project) => {
      const reviewed = project.reviewProgress?.reviewed ?? 0;
      const total = project.reviewProgress?.total ?? 0;
      const complete = total > 0 && reviewed >= total;
      return {
        id: project.id,
        companyName: project.companyName,
        sector: project.sector ?? "Unassigned sector",
        fiscalYear: project.fiscalYear ?? "Current period",
        status: project.status,
        statusLabel: managerProjectStatusLabel(project.status),
        updatedAt: project.updatedAt,
        projectLabel: project.projectLabel ?? "Workbook review",
        reviewed,
        total,
        readinessLabel: complete ? "Ready to approve" : `${reviewed}/${total || "?"} fields reviewed`,
        primaryAction: "Review",
      };
    });
}

export function buildManagerDashboardCounts(projects: ProjectResponse[]) {
  return {
    awaitingReview: projects.filter((project) => project.status === "manager_review").length,
    sentBackOrAnalystWork: projects.filter((project) =>
      ["awaiting_review", "in_diagnosis", "draft", "documents_uploaded", "extracting"].includes(
        project.status,
      ),
    ).length,
    approvedWorkbooks: projects.filter((project) => isFinalApprovedStatus(project.status)).length,
  };
}
```

- [ ] **Step 4: Run tests and confirm pass**

Run:

```bash
bun test src/lib/manager-workspace.test.ts
```

Expected: all tests pass.

---

### Task 2: Manager Review Queue Landing

**Files:**
- Create: `src/components/manager/ManagerReviewQueue.tsx`
- Modify: `src/routes/review.tsx`

- [ ] **Step 1: Create queue component**

Create `src/components/manager/ManagerReviewQueue.tsx`:

```tsx
import { useMemo, useState } from "react";
import { ArrowRight, ClipboardCheck, Search } from "lucide-react";
import { Card, Badge } from "@/components/PageShell";
import { Button } from "@/components/Button";
import { PaginationControls } from "@/components/PaginationControls";
import { paginateItems } from "@/lib/pagination";
import { buildManagerReviewQueue, type ManagerQueueItem } from "@/lib/manager-workspace";
import type { ProjectResponse } from "@/lib/api/types";

export function ManagerReviewQueue({
  projects,
  loading,
  onOpen,
}: {
  projects: ProjectResponse[];
  loading: boolean;
  onOpen: (projectId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const queue = useMemo(() => buildManagerReviewQueue(projects), [projects]);
  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return queue;
    return queue.filter((item) =>
      [item.companyName, item.sector, item.fiscalYear, item.projectLabel, item.statusLabel]
        .join(" ")
        .toLowerCase()
        .includes(text),
    );
  }, [query, queue]);
  const paginated = useMemo(() => paginateItems(filtered, page), [filtered, page]);

  if (loading) {
    return (
      <Card>
        <div className="text-[13px] text-[var(--color-text-muted)]">Loading review queue...</div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-[var(--color-brand)]" />
            <h2 className="text-[16px] font-semibold">Awaiting My Review</h2>
            <Badge tone="info">{queue.length}</Badge>
          </div>
          <div className="relative w-full max-w-[360px]">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--color-text-muted)]" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search company, sector, FY, status"
              className="h-9 w-full rounded-md border bg-white pl-9 pr-3 text-[13px] outline-none transition focus:border-[var(--color-brand)]"
              style={{ borderColor: "var(--color-border-default)" }}
            />
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <div className="text-[15px] font-semibold text-[var(--color-text-primary)]">
            No workbooks awaiting review
          </div>
          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
            Analyst submissions will appear here when they are ready for manager approval.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {paginated.map((item) => (
            <ManagerReviewQueueRow key={item.id} item={item} onOpen={onOpen} />
          ))}
          <PaginationControls
            totalItems={filtered.length}
            page={page}
            onPageChange={setPage}
            label="reviews"
          />
        </div>
      )}
    </div>
  );
}

function ManagerReviewQueueRow({
  item,
  onOpen,
}: {
  item: ManagerQueueItem;
  onOpen: (projectId: string) => void;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warning">{item.statusLabel}</Badge>
            <Badge tone="neutral">{item.readinessLabel}</Badge>
          </div>
          <div className="mt-2 text-[15px] font-semibold text-[var(--color-text-primary)]">
            {item.companyName} · {item.fiscalYear}
          </div>
          <div className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
            {item.sector} · {item.projectLabel} · Last updated {formatDate(item.updatedAt)}
          </div>
        </div>
        <Button onClick={() => onOpen(item.id)}>
          <ArrowRight className="h-4 w-4" />
          Review
        </Button>
      </div>
    </Card>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
```

- [ ] **Step 2: Wire queue into review route**

Modify `src/routes/review.tsx`:

```tsx
import { ManagerReviewQueue } from "@/components/manager/ManagerReviewQueue";
import { useProjects, useWorkspace } from "@/hooks/use-projects";
```

Inside `Review()` add:

```tsx
const projects = useProjects();
```

Replace the `!projectId` branch with:

```tsx
{!projectId ? (
  <ManagerReviewQueue
    projects={projects.data ?? []}
    loading={projects.isLoading}
    onOpen={(id) => {
      setSelectedProjectId(id);
      navigate({ to: "/review" });
    }}
  />
) : workspace.isLoading ? (
```

Ensure `setSelectedProjectId` is imported from `@/lib/project-store` in addition to `useSelectedProjectId`.

- [ ] **Step 3: Verify review route**

Run:

```bash
./node_modules/.bin/eslint src/routes/review.tsx src/components/manager/ManagerReviewQueue.tsx src/lib/manager-workspace.ts
bun test src/lib/manager-workspace.test.ts
```

Expected: lint passes; tests pass.

---

### Task 3: Manager Analysis Requests Panel

**Files:**
- Create: `src/components/manager/ManagerRequestPanel.tsx`
- Modify: `src/routes/review.tsx`

- [ ] **Step 1: Extract manager request creation into reusable component**

Create `src/components/manager/ManagerRequestPanel.tsx` using the existing request creation logic from `ManagerDashboard` in `src/routes/index.tsx`. The component should accept no props and use:

```tsx
useAnalysisRequests();
useCreateAnalysisRequest();
useAnalysts();
usePsxCompanies();
```

UI headings:
- `Create Analysis Request`
- `Request Tracker`

Button text:
- `Assign Request`

Status copy:
- `Pending analyst acceptance`
- `Accepted by analyst`
- `Converted to workbook`

- [ ] **Step 2: Add panel to Review Queue landing**

In `src/routes/review.tsx`, show this panel above `ManagerReviewQueue` only when `!projectId`:

```tsx
<>
  <ManagerRequestPanel />
  <ManagerReviewQueue ... />
</>
```

- [ ] **Step 3: Remove or de-emphasize old manager request component from Dashboard**

In `src/routes/index.tsx`, either delete `ManagerDashboard` if unused or leave it unused if removing it creates broad churn. Manager Dashboard should remain dashboard-focused.

- [ ] **Step 4: Verify**

Run:

```bash
./node_modules/.bin/eslint src/components/manager/ManagerRequestPanel.tsx src/routes/review.tsx src/routes/index.tsx
```

Expected: lint passes.

---

### Task 4: Review Detail Header and Decision Hierarchy

**Files:**
- Create: `src/components/manager/ManagerReviewDetailHeader.tsx`
- Modify: `src/routes/review.tsx`
- Modify: `src/lib/manager-review-workflow.ts`

- [ ] **Step 1: Update manager workflow copy**

Modify `src/lib/manager-review-workflow.ts`:

```ts
export function managerApprovalButtonLabel() {
  return "Approve Workbook";
}

export function managerReviewSubtitle(hasProject: boolean) {
  if (!hasProject) return "Create analysis requests and review submitted workbooks.";
  return "Review the analyst submission, add comments where needed, then approve the workbook or send it back.";
}

export function managerReviewVersionLockMessage() {
  return "Approval marks this workbook as the final approved version.";
}

export function routeAfterManagerApproval(): null {
  return null;
}
```

- [ ] **Step 2: Add review detail header**

Create `src/components/manager/ManagerReviewDetailHeader.tsx`:

```tsx
import { Badge, Card } from "@/components/PageShell";
import type { ProjectResponse } from "@/lib/api/types";
import { managerProjectStatusLabel } from "@/lib/manager-workspace";

export function ManagerReviewDetailHeader({ project }: { project: ProjectResponse }) {
  const reviewed = project.reviewProgress?.reviewed ?? 0;
  const total = project.reviewProgress?.total ?? 0;
  const ready = total > 0 && reviewed >= total;

  return (
    <Card className="mb-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warning">{managerProjectStatusLabel(project.status)}</Badge>
            <Badge tone={ready ? "success" : "info"}>
              {ready ? "Ready to approve" : `${reviewed}/${total || "?"} fields reviewed`}
            </Badge>
          </div>
          <h2 className="mt-2 text-[18px] font-semibold text-[var(--color-text-primary)]">
            {project.companyName} · {project.fiscalYear ?? "Current period"}
          </h2>
          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
            {project.sector ?? "Unassigned sector"} · {project.projectLabel ?? "Workbook review"}
          </p>
        </div>
        <div className="text-right text-[12px] text-[var(--color-text-muted)]">
          Last updated
          <div className="mt-1 font-semibold text-[var(--color-text-primary)]">
            {formatDate(project.updatedAt)}
          </div>
        </div>
      </div>
    </Card>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
```

- [ ] **Step 3: Insert header and move action meaning**

In `src/routes/review.tsx`, render `ManagerReviewDetailHeader` before approval status/KPI cards.

Rename button:

```tsx
Send Back to Analyst
```

Keep approve button using `managerApprovalButtonLabel()`.

- [ ] **Step 4: Verify**

Run:

```bash
./node_modules/.bin/eslint src/routes/review.tsx src/components/manager/ManagerReviewDetailHeader.tsx src/lib/manager-review-workflow.ts
```

Expected: lint passes.

---

### Task 5: Review Detail Content Polish

**Files:**
- Modify: `src/routes/review.tsx`

- [ ] **Step 1: Rename visible manager review sections**

Change:
- `Manager approval handoff` → `Approval Status`
- `Latest executive brief status after approval.` → `Workbook approval status and generated review pack details.`
- `KPI Summary` → `Key Financial Summary`
- `Diff log` → `Model Changes`
- `Analyst override log` → `Analyst Adjustments`
- `Inline comments` → `Review Comments`
- `No comments have been added to this review pack yet.` → `No review comments have been added yet.`
- `Add a manager comment...` → `Add review comment...`

- [ ] **Step 2: Hide fallback/system badges from manager view**

Remove or rename badges showing:
- `Fallback`
- `Workspace`
- `Review`
- `Audit`

Replace with manager-facing labels only where useful:
- `Source-backed`
- `Changes`
- `Adjustments`

- [ ] **Step 3: Verify copy does not contain CFO-facing terms on manager route**

Run:

```bash
rg -n "CFO|cfo|Fallback|Workspace|handoff|Diff log|override log|Inline comments" src/routes/review.tsx src/lib/manager-review-workflow.ts src/components/manager
```

Expected: no CFO terms and no old section labels in manager-facing files.

---

### Task 6: Sidebar and Manager Navigation Polish

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Rename manager nav item**

Change:

```ts
{ to: "/review", label: "Manager Review", icon: ClipboardCheck, roles: ["finance_manager"] },
```

To:

```ts
{ to: "/review", label: "Review Queue", icon: ClipboardCheck, roles: ["finance_manager"] },
```

- [ ] **Step 2: Verify manager sidebar labels**

Run:

```bash
./node_modules/.bin/eslint src/components/Sidebar.tsx
```

Expected: lint passes.

---

### Task 7: Manager Dashboard Widgets

**Files:**
- Modify: `src/routes/index.tsx`
- Reuse: `src/lib/manager-workspace.ts`

- [ ] **Step 1: Add manager dashboard summary strip**

For `finance_manager` Dashboard, above Financial Dashboard tabs, add widgets:
- `Awaiting Review`
- `With Analyst`
- `Approved Workbooks`

Use `buildManagerDashboardCounts(projects.data ?? [])`.

- [ ] **Step 2: Add action button**

Add a secondary action:

```tsx
<Button variant="secondary" onClick={() => navigate({ to: "/review" })}>
  Open Review Queue
</Button>
```

- [ ] **Step 3: Verify**

Run:

```bash
./node_modules/.bin/eslint src/routes/index.tsx src/lib/manager-workspace.ts
bun test src/lib/manager-workspace.test.ts
```

Expected: lint passes; tests pass.

---

### Task 8: End-to-End Browser Verification

**Files:**
- No new files.

- [ ] **Step 1: Verify manager review queue with browser**

Open:

```text
http://127.0.0.1:8080/review
```

Expected:
- Page title is `Review Queue` or `Manager Review` with queue content.
- `Create Analysis Request` is visible.
- `Awaiting My Review` is visible.
- No selected workbook empty-state dead end.

- [ ] **Step 2: Verify review detail**

Click a workbook awaiting review.

Expected:
- Detail header shows company, FY, sector, status, readiness.
- Buttons read `Send Back to Analyst` and `Approve Workbook`.
- Sections read `Key Financial Summary`, `Model Changes`, `Analyst Adjustments`, `Review Comments`.

- [ ] **Step 3: Verify existing tests**

Run:

```bash
bun test src/lib/manager-workspace.test.ts src/lib/role-access.test.ts src/lib/ask-ai-context.test.ts src/lib/ask-ai-request.test.ts
./node_modules/.bin/eslint src/components/Sidebar.tsx src/routes/review.tsx src/routes/index.tsx src/routes/registry.tsx src/components/manager src/lib/manager-workspace.ts src/lib/manager-review-workflow.ts
```

Expected: tests pass; targeted lint passes.

---

## Self-Review

- The plan restores manager request creation through `ManagerRequestPanel`.
- The plan makes `/review` queue-first through `ManagerReviewQueue`.
- The plan improves detail hierarchy through `ManagerReviewDetailHeader`.
- The plan removes or rewrites CFO/internal wording from manager-facing review files.
- The plan keeps backend changes out of scope unless existing payloads prove insufficient during implementation.
