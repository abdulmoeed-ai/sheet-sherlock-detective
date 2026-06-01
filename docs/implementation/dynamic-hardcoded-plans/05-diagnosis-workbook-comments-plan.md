# Diagnosis Workbook Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static diagnosis workbook, issue list, team members, comments, correction values, and local export with backend workspace, diagnosis, comments, and review handoff data.

**Architecture:** Reuse the project workspace read model for workbook rows and comments. Use diagnosis endpoints for candidate generation/decision, review-cell endpoints for manual edits, comments endpoints for collaboration, and backend export preview/audit state for download.

**Tech Stack:** React, XLSX for client fallback export, FastAPI workspace/diagnosis/comments/review endpoints, Bun tests, pytest.

---

## Hardcoded Evidence

- `src/routes/diagnosis.tsx:61` defines static `ROWS`.
- `src/routes/diagnosis.tsx:118` defines static `SHEET_TABS`.
- `src/routes/diagnosis.tsx:130` defines static `MEMBERS`.
- `src/routes/diagnosis.tsx:138` defines static `ISSUES`.
- `src/routes/diagnosis.tsx:292` applies hardcoded correction `BS!D42: 15600`.
- `src/routes/diagnosis.tsx:1199` renders hardcoded comments.

## Backend Current State

- Workspace returns `review.rows`, `review.sheets`, `review.comments`, `threeStatementCheck`, and `balanceSheetDiagnosis`.
- Comments CRUD endpoints exist.
- Balance sheet diagnosis run/latest/accept/decision endpoints exist.
- Review submit blocks unresolved hard three-statement items.

## Files

- Modify: `sheet-sherlock-detective/src/lib/api/projects.ts`
- Create: `sheet-sherlock-detective/src/lib/workbook-workspace-adapter.ts`
- Modify: `sheet-sherlock-detective/src/routes/diagnosis.tsx`
- Test: `sheet-sherlock-detective/tests/projects-api.test.ts`
- Create: `sheet-sherlock-detective/tests/workbook-workspace-adapter.test.ts`
- Optional backend: `backend_code/backend/app/services/projects.py` if workspace comment shape is insufficient

### Task 1: Add Missing API Wrappers

- [ ] **Step 1: Extend frontend API tests**

Add to `sheet-sherlock-detective/tests/projects-api.test.ts`:

```ts
import { createReviewComment, listReviewComments, recordDiagnosisDecision } from "../src/lib/api/projects";

it("lists comments and records diagnosis decisions", async () => {
  withSession();
  const requests: Request[] = [];
  globalThis.fetch = ((input, init) => {
    requests.push(new Request(input, init));
    const path = new URL(String(input)).pathname;
    if (path.endsWith("/comments")) return jsonResponse([]);
    return jsonResponse({ id: "decision-1", action: "override", reasonCode: "human_override" });
  }) as typeof fetch;

  await listReviewComments("project-1");
  await createReviewComment("project-1", { body: "Check this", templateCell: "BS!D42" });
  await recordDiagnosisDecision("project-1", "candidate-1", {
    action: "override",
    reasonCode: "human_override",
    classification: "unknown",
    note: "Audited statement supports manual value.",
  });

  expect(requests[0].url).toEndWith("/api/projects/project-1/comments");
  expect(requests[2].url).toEndWith("/api/projects/project-1/diagnosis/balance-sheet/candidate-1/decision");
});
```

- [ ] **Step 2: Add API functions**

In `src/lib/api/projects.ts`, add:

```ts
export async function listReviewComments(projectId: string): Promise<Array<Record<string, unknown>>> {
  return apiRequest(`/api/projects/${projectId}/comments`);
}

export async function recordDiagnosisDecision(
  projectId: string,
  candidateId: string,
  input: {
    action: "accept" | "override" | "reject";
    reasonCode:
      | "diagnosis_accepted"
      | "human_override"
      | "entry_type_correction"
      | "entry_sign_logic_correction"
      | "debit_credit_sign_convention_correction"
      | "corrective_journal_entry_adjustment";
    classification:
      | "equity_injection"
      | "bank_loan"
      | "debit_credit_classification"
      | "structured_corrective_journal_entry"
      | "unknown";
    note?: string;
    manualValue?: string;
    journalEntry?: Record<string, unknown>;
  },
): Promise<Record<string, unknown>> {
  return apiRequest(`/api/projects/${projectId}/diagnosis/balance-sheet/${candidateId}/decision`, {
    method: "POST",
    json: input,
  });
}
```

### Task 2: Build Workbook Adapter

- [ ] **Step 1: Write adapter test**

Create `sheet-sherlock-detective/tests/workbook-workspace-adapter.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { workspaceToWorkbookRows } from "../src/lib/workbook-workspace-adapter";

describe("workspaceToWorkbookRows", () => {
  it("maps review rows into spreadsheet rows", () => {
    const rows = workspaceToWorkbookRows([
      {
        id: "inventory",
        label: "Inventory",
        noteReference: "25",
        rowKind: "item",
        cells: {
          "2025": { value: "19,800", status: "flagged", formula: false },
          "2024": { value: "12,100", status: "accepted", formula: false },
        },
      },
    ]);

    expect(rows[0].label).toBe("Inventory");
    expect(rows[0].note).toBe("25");
    expect(rows[0].states?.[0]).toBe("flag-red");
  });
});
```

- [ ] **Step 2: Add adapter**

Create `sheet-sherlock-detective/src/lib/workbook-workspace-adapter.ts`:

```ts
export type WorkbookRow = {
  kind: "section" | "item" | "subtotal";
  label: string;
  note?: string;
  values: Array<number | string | null>;
  formula?: boolean[];
  states?: Array<"flag-red" | "flag-amber" | "corrected" | "commented" | null>;
};

export function workspaceToWorkbookRows(rows: Array<Record<string, unknown>>): WorkbookRow[] {
  return rows.map((row) => {
    const cells = row.cells && typeof row.cells === "object" ? (row.cells as Record<string, Record<string, unknown>>) : {};
    const ordered = Object.keys(cells).sort();
    return {
      kind: normalizeKind(row.rowKind),
      label: String(row.label ?? ""),
      note: row.noteReference ? String(row.noteReference) : undefined,
      values: ordered.map((year) => normalizeValue(cells[year]?.value)),
      formula: ordered.map((year) => Boolean(cells[year]?.formula)),
      states: ordered.map((year) => stateForCell(cells[year])),
    };
  });
}

function normalizeKind(value: unknown): "section" | "item" | "subtotal" {
  return value === "section" || value === "subtotal" ? value : "item";
}

function normalizeValue(value: unknown): number | string | null {
  if (value === null || value === undefined) return null;
  const numeric = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : String(value);
}

function stateForCell(cell: Record<string, unknown> | undefined): "flag-red" | "flag-amber" | "corrected" | "commented" | null {
  const status = String(cell?.status ?? "");
  if (status === "flagged" || status === "blocked") return "flag-red";
  if (status === "pending" || status === "needs_review") return "flag-amber";
  if (status === "edited" || status === "accepted") return "corrected";
  if (status === "commented") return "commented";
  return null;
}
```

### Task 3: Replace Static Diagnosis State

- [ ] **Step 1: Load workspace**

In `src/routes/diagnosis.tsx`, replace `ROWS`, `SHEET_TABS`, `MEMBERS`, and `ISSUES` usage with data derived from workspace:

```ts
const [workspace, setWorkspace] = useState<ProjectWorkspace | null>(null);
const rows = useMemo(() => workspaceToWorkbookRows(workspace?.review.rows ?? []), [workspace]);
const sheetTabs = workspace?.review.sheets?.map((name) => ({ name, dot: null })) ?? [];
const issues = workspace?.threeStatementCheck?.items ?? [];
```

- [ ] **Step 2: Wire corrections**

Change `applyCorrection` to use backend candidate data only:

```ts
const diagnosis = await runBalanceSheetDiagnosis(cycle.projectId);
const candidateId = diagnosis.candidates[0]?.candidateId ? String(diagnosis.candidates[0].candidateId) : null;
if (!candidateId) throw new Error("No diagnosis candidate was returned.");
await acceptBalanceSheetDiagnosis(cycle.projectId, candidateId);
setWorkspace(await getProjectWorkspace(cycle.projectId));
```

Remove the `setTimeout` block that inserts `BS!D42: 15600`.

- [ ] **Step 3: Wire comments**

When submitting a comment:

```ts
await createReviewComment(cycle.projectId, {
  body: commentText,
  templateCell: currentAddr,
  sheetName: activeSheet,
});
setWorkspace(await getProjectWorkspace(cycle.projectId));
```

- [ ] **Step 4: Wire manual edits**

On cell edit save:

```ts
await updateReviewCell(cycle.projectId, fieldIdForCurrentCell, {
  action: "edit",
  value: editValue,
  note: overrideReason ?? undefined,
});
setWorkspace(await getProjectWorkspace(cycle.projectId));
```

If a cell has no `fieldId`, keep it read-only and show `toast.error("This cell is not linked to an extracted field.")`.

### Task 4: Submit For Review Through Backend

- [ ] **Step 1: Replace local ready state**

Use `submitProjectForManagerReview(cycle.projectId, "Ready for manager review")`.

- [ ] **Step 2: Refresh workflow**

After success:

```ts
cycleStore.setStatus("review");
toast.success("Diagnosis locked and sent for Finance Manager review.");
navigate({ to: "/forecast" });
```

### Task 5: Run Checks

- [ ] **Step 1: Frontend**

Run: `cd sheet-sherlock-detective && bun test tests/projects-api.test.ts tests/workbook-workspace-adapter.test.ts`

Expected: PASS.

Run: `cd sheet-sherlock-detective && bun run build`

Expected: build completes.

- [ ] **Step 2: Backend smoke**

Run: `cd backend_code/backend && uv run python -m pytest tests/unit/test_review_workspace_payload.py tests/unit/test_diagnosis_decisions.py tests/unit/test_comments.py -q`

Expected: PASS.

### Task 6: Commit

- [ ] **Step 1: Commit**

```bash
cd sheet-sherlock-detective
git add src/lib/api/projects.ts src/lib/workbook-workspace-adapter.ts src/routes/diagnosis.tsx tests/projects-api.test.ts tests/workbook-workspace-adapter.test.ts
git commit -m "feat(diagnosis): drive workbook review from backend workspace"
```

