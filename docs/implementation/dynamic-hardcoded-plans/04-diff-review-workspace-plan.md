# Diff Review Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static diff rows and mock model preview values with backend workspace review rows, evidence, and review-cell mutation endpoints.

**Architecture:** Treat `/api/projects/{project_id}/workspace` as the read model for diff review. Convert workspace review rows into diff rows in a frontend adapter, use `PATCH /review-cells/{field_id}` for approve/edit/flag/exception decisions, and refresh workspace after mutations.

**Tech Stack:** React, TanStack Router, FastAPI workspace endpoint, review cell update/revert endpoints, Bun tests, pytest.

---

## Hardcoded Evidence

- `src/routes/diff-review.tsx:35` defines static `DIFFS`.
- `src/routes/diff-review.tsx:47` pre-resolves rows `0` and `1`.
- `src/routes/diff-review.tsx:310` renders static row labels and columns.
- `src/routes/diff-review.tsx:406` computes `mockValue()`.

## Backend Current State

- `GET /api/projects/{project_id}/workspace` returns `review.rows`, `review.auditLog`, `review.sheets`, `exportPreview`, and `dashboard`.
- `PATCH /api/projects/{project_id}/review-cells/{field_id}` accepts `accept`, `edit`, `flag`, `clear_exception`, `reopen_exception`, and `save_exception_note`.
- `POST /api/projects/{project_id}/review-cells/{field_id}/revert` exists.

## Files

- Modify: `sheet-sherlock-detective/src/lib/api/projects.ts`
- Create: `sheet-sherlock-detective/src/lib/workspace-diff-adapter.ts`
- Modify: `sheet-sherlock-detective/src/routes/diff-review.tsx`
- Test: `sheet-sherlock-detective/tests/projects-api.test.ts`
- Create: `sheet-sherlock-detective/tests/workspace-diff-adapter.test.ts`
- Optional backend test: `backend_code/backend/tests/unit/test_review_workspace_payload.py`

### Task 1: Add Workspace and Review Cell API Client

- [ ] **Step 1: Add API tests**

Add to `sheet-sherlock-detective/tests/projects-api.test.ts`:

```ts
import { getProjectWorkspace, updateReviewCell } from "../src/lib/api/projects";

it("loads workspace and updates review cells", async () => {
  withSession();
  const requests: Request[] = [];
  globalThis.fetch = ((input, init) => {
    requests.push(new Request(input, init));
    const path = new URL(String(input)).pathname;
    if (path.endsWith("/workspace")) {
      return jsonResponse({ project: { id: "project-1" }, documents: [], review: { rows: [] }, auditEvents: [], exportPreview: {}, dashboard: {} });
    }
    return jsonResponse({ id: "field-1", status: "accepted" });
  }) as typeof fetch;

  await getProjectWorkspace("project-1");
  await updateReviewCell("project-1", "field-1", { action: "accept" });

  expect(requests[0].url).toEndWith("/api/projects/project-1/workspace");
  expect(requests[1].url).toEndWith("/api/projects/project-1/review-cells/field-1");
  expect(JSON.parse(String(requests[1].init?.body))).toEqual({ action: "accept" });
});
```

- [ ] **Step 2: Add client functions**

In `src/lib/api/projects.ts`, add:

```ts
export type ProjectWorkspace = {
  project: Record<string, unknown>;
  documents: Array<Record<string, unknown>>;
  review: {
    rows: Array<Record<string, unknown>>;
    auditLog?: Array<Record<string, unknown>>;
    selectedCell?: string | null;
    sheets?: string[];
    templateName?: string;
    comments?: Record<string, unknown>;
  };
  auditEvents: Array<Record<string, unknown>>;
  exportPreview: Record<string, unknown>;
  dashboard: Record<string, unknown>;
  ingestionPreviewSummary?: Record<string, unknown> | null;
  threeStatementCheck?: Record<string, unknown> | null;
  balanceSheetDiagnosis?: Record<string, unknown> | null;
};

export async function getProjectWorkspace(projectId: string): Promise<ProjectWorkspace> {
  return apiRequest(`/api/projects/${projectId}/workspace`);
}

export async function updateReviewCell(
  projectId: string,
  fieldId: string,
  input: { action: "accept" | "edit" | "flag" | "clear_exception" | "reopen_exception" | "save_exception_note"; value?: string; note?: string },
): Promise<Record<string, unknown>> {
  return apiRequest(`/api/projects/${projectId}/review-cells/${fieldId}`, {
    method: "PATCH",
    json: input,
  });
}
```

### Task 2: Build Workspace Diff Adapter

- [ ] **Step 1: Write adapter tests**

Create `sheet-sherlock-detective/tests/workspace-diff-adapter.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { workspaceRowsToDiffs } from "../src/lib/workspace-diff-adapter";

describe("workspaceRowsToDiffs", () => {
  it("converts backend review cells into diff rows", () => {
    const diffs = workspaceRowsToDiffs([
      {
        id: "revenue",
        label: "Revenue",
        sheetName: "Input - IS",
        cells: {
          "2025": {
            fieldId: "field-1",
            templateCell: "C12",
            previousValue: "48,700",
            value: "54,800",
            sourceName: "Millat - 2025.pdf",
            confidence: 0.97,
            status: "pending",
            evidence: { documentName: "Millat - 2025.pdf", printedPageNumber: 42, pdfPageIndex: 41 },
          },
        },
      },
    ]);

    expect(diffs[0]).toMatchObject({
      fieldId: "field-1",
      cell: "C12",
      sheet: "Input - IS",
      field: "Revenue",
      old: "48,700",
      next: "54,800",
      tier: "auto",
    });
  });
});
```

- [ ] **Step 2: Add adapter**

Create `sheet-sherlock-detective/src/lib/workspace-diff-adapter.ts`:

```ts
export type DiffReviewRow = {
  fieldId: string;
  cell: string;
  sheet: string;
  field: string;
  old: string;
  next: string;
  source: string;
  conf: number;
  tier: "auto" | "confirm" | "block";
  status: string;
  ref: {
    doc: string;
    page: number;
    field: string;
    value: string;
    conf: number;
    bbox?: [number, number, number, number];
    documentId?: string;
    pdfPageIndex?: number;
    imageUrl?: string;
  };
};

export function workspaceRowsToDiffs(rows: Array<Record<string, unknown>>, projectId?: string): DiffReviewRow[] {
  return rows.flatMap((row) => {
    const cells = row.cells && typeof row.cells === "object" ? (row.cells as Record<string, Record<string, unknown>>) : {};
    return Object.entries(cells)
      .filter(([, cell]) => cell.fieldId && cell.status !== "formula")
      .map(([period, cell]) => {
        const confidence = Number(cell.confidence ?? 0);
        const evidence = (cell.evidence ?? {}) as Record<string, unknown>;
        return {
          fieldId: String(cell.fieldId),
          cell: String(cell.templateCell ?? ""),
          sheet: String(row.sheetName ?? row.sheet ?? ""),
          field: String(row.label ?? ""),
          old: String(cell.previousValue ?? ""),
          next: String(cell.value ?? ""),
          source: String(cell.sourceName ?? evidence.documentName ?? "Uploaded source"),
          conf: confidence > 1 ? confidence : Math.round(confidence * 100),
          tier: confidence >= 0.9 ? "auto" : confidence >= 0.8 ? "confirm" : "block",
          status: String(cell.status ?? "pending"),
          ref: {
            doc: String(evidence.documentName ?? cell.sourceName ?? "Uploaded source"),
            page: Number(evidence.printedPageNumber ?? evidence.sourcePage ?? 1),
            field: String(row.label ?? period),
            value: String(cell.value ?? ""),
            conf: confidence > 1 ? confidence : Math.round(confidence * 100),
            documentId: evidence.documentId ? String(evidence.documentId) : undefined,
            pdfPageIndex: typeof evidence.pdfPageIndex === "number" ? evidence.pdfPageIndex : undefined,
            imageUrl: undefined,
          },
        };
      });
  });
}
```

- [ ] **Step 3: Run adapter test**

Run: `cd sheet-sherlock-detective && bun test tests/workspace-diff-adapter.test.ts`

Expected: PASS.

### Task 3: Replace Static DiffReview Screen

- [ ] **Step 1: Load workspace**

In `src/routes/diff-review.tsx`, remove `DIFFS` and add:

```ts
const [workspace, setWorkspace] = useState<ProjectWorkspace | null>(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

async function refreshWorkspace() {
  if (!cycle.projectId) return;
  setLoading(true);
  setError(null);
  try {
    setWorkspace(await getProjectWorkspace(cycle.projectId));
  } catch (err) {
    setError(err instanceof Error ? err.message : "Could not load review workspace.");
  } finally {
    setLoading(false);
  }
}

useEffect(() => {
  void refreshWorkspace();
}, [cycle.projectId]);
```

- [ ] **Step 2: Approve/justify through backend**

Replace `approveRow` with:

```ts
const approveRow = async (diff: DiffReviewRow, note?: string) => {
  if (!cycle.projectId) return;
  await updateReviewCell(cycle.projectId, diff.fieldId, { action: "accept", note });
  await refreshWorkspace();
};
```

For blocked rows, send the justification in `note`.

- [ ] **Step 3: Replace model preview values**

Use `workspace.exportPreview` or `workspace.review.rows` to render the right panel. If the backend workbook payload is present, render sheet/cell values from it. If absent, show:

```tsx
<div className="rounded-xl border bg-white p-5 text-sm text-text-muted">
  No workbook preview is available yet. Complete extraction first.
</div>
```

### Task 4: Run Checks

- [ ] **Step 1: Frontend**

Run: `cd sheet-sherlock-detective && bun test tests/projects-api.test.ts tests/workspace-diff-adapter.test.ts`

Expected: PASS.

Run: `cd sheet-sherlock-detective && bun run build`

Expected: build completes.

### Task 5: Commit

- [ ] **Step 1: Commit**

```bash
cd sheet-sherlock-detective
git add src/lib/api/projects.ts src/lib/workspace-diff-adapter.ts src/routes/diff-review.tsx tests/projects-api.test.ts tests/workspace-diff-adapter.test.ts
git commit -m "feat(review): drive diff review from workspace api"
```

