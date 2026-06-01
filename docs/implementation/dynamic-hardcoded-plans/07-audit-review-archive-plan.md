# Audit Review Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static audit events, fake review state, fake executive brief state, and local export blobs with backend review decisions, brief generation, archive metadata, and audit JSON.

**Architecture:** The audit page should load project workspace/audit events and latest archive/brief state, call manager and CFO decision endpoints, generate briefs through the backend, and download backend audit JSON. Signed PDF export should be hidden until the backend exposes a real PDF route.

**Tech Stack:** React, FastAPI review/brief/archive endpoints, Bun tests, pytest.

---

## Hardcoded Evidence

- `src/routes/audit.tsx:19` defines static audit log events.
- `src/routes/audit.tsx:34` tracks review state locally.
- `src/routes/audit.tsx:39` creates a fake PDF blob.
- `src/routes/audit.tsx:52` creates a fake JSON export.
- `src/routes/audit.tsx:84` mutates local manager approval state.
- `src/routes/audit.tsx:97` sets brief status from an E2E env flag.
- `src/routes/audit.tsx:105` creates fake archive ids.
- `src/routes/audit.tsx:149` renders fixed audit counts.

## Backend Current State

- `POST /review/manager-decision` records manager approval/send-back.
- `POST /briefs/generate` generates executive brief and stores narrative status.
- `GET /briefs/latest` and `GET /briefs/{brief_id}` exist in backend routes, but frontend client lacks wrappers.
- `POST /review/cfo-signoff` locks approval and creates archive when approved.
- `GET /archive/latest` and `GET /archive/{archive_id}/audit.json` exist.

## Files

- Modify: `sheet-sherlock-detective/src/lib/api/projects.ts`
- Modify: `sheet-sherlock-detective/src/routes/audit.tsx`
- Test: `sheet-sherlock-detective/tests/projects-api.test.ts`
- Backend verification: `backend_code/backend/tests/integration/test_project_api.py`

### Task 1: Add Brief API Wrappers

- [ ] **Step 1: Add frontend API test**

Add to `sheet-sherlock-detective/tests/projects-api.test.ts`:

```ts
import { getLatestExecutiveBrief } from "../src/lib/api/projects";

it("loads latest executive brief", async () => {
  withSession();
  const requests: Request[] = [];
  globalThis.fetch = ((input, init) => {
    requests.push(new Request(input, init));
    return jsonResponse({
      id: "brief-1",
      projectId: "project-1",
      version: 1,
      status: "generated",
      generatedBy: "manager-1",
      payload: {},
      createdAt: "2026-06-01T00:00:00Z",
      lockedAt: null,
    });
  }) as typeof fetch;

  const brief = await getLatestExecutiveBrief("project-1");

  expect(brief.id).toBe("brief-1");
  expect(requests[0].url).toEndWith("/api/projects/project-1/briefs/latest");
});
```

- [ ] **Step 2: Add wrapper**

In `src/lib/api/projects.ts`, add:

```ts
export async function getLatestExecutiveBrief(projectId: string): Promise<{
  id: string;
  projectId: string;
  version: number;
  status: string;
  generatedBy: string;
  payload: Record<string, unknown>;
  createdAt: string;
  lockedAt: string | null;
}> {
  return apiRequest(`/api/projects/${projectId}/briefs/latest`);
}
```

### Task 2: Load Audit Page From Backend

- [ ] **Step 1: Add state**

In `src/routes/audit.tsx`:

```ts
const [workspace, setWorkspace] = useState<ProjectWorkspace | null>(null);
const [brief, setBrief] = useState<ExecutiveBrief | null>(null);
const [archive, setArchive] = useState<ModelArchive | null>(null);
const [error, setError] = useState<string | null>(null);

async function refreshAudit() {
  if (!cycle.projectId) return;
  const nextWorkspace = await getProjectWorkspace(cycle.projectId);
  setWorkspace(nextWorkspace);
  try { setBrief(await getLatestExecutiveBrief(cycle.projectId)); } catch { setBrief(null); }
  try { setArchive(await getLatestModelArchive(cycle.projectId)); } catch { setArchive(null); }
}
```

- [ ] **Step 2: Replace static log**

Use:

```ts
const events = workspace?.auditEvents ?? [];
```

Map each event:

```tsx
{events.map((event) => (
  <li key={String(event.id ?? `${event.createdAt}-${event.action}`)}>
    <span>{String(event.createdAt ?? "")}</span>
    <span>{String(event.actor ?? "")}</span>
    <span>{String(event.action ?? "")}</span>
  </li>
))}
```

### Task 3: Wire Review Actions

- [ ] **Step 1: Manager approve**

Replace local `setReviewStatus("CFO review")` with:

```ts
await recordManagerDecision(cycle.projectId, { action: "approve", note: "Manager approved from audit page." });
cycleStore.setStatus("review");
await refreshAudit();
```

- [ ] **Step 2: Generate brief**

Use existing `generateExecutiveBrief(cycle.projectId)`, set `brief`, and show backend `status`.

- [ ] **Step 3: CFO signoff**

Use:

```ts
await recordCfoSignoff(cycle.projectId, { approved: true, note: "CFO approved.", briefId: brief?.id });
cycleStore.setStatus("approved");
await refreshAudit();
```

Disable the button when `brief?.status !== "generated"`.

### Task 4: Replace Exports

- [ ] **Step 1: Export audit JSON from backend**

Replace fake JSON blob with:

```ts
if (!cycle.projectId || !archive) return;
const payload = await downloadArchiveAuditJson(cycle.projectId, archive.id);
const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
```

- [ ] **Step 2: Hide signed PDF until real route exists**

Render the PDF button disabled with tooltip:

```tsx
<Button disabled title="Backend signed PDF export route is not available yet.">
  <Download className="h-4 w-4" /> Export signed PDF
</Button>
```

Backend plan if PDF is required: add `GET /api/projects/{project_id}/archive/{archive_id}/audit.pdf`, generate server-side PDF, and test permissions alongside audit JSON.

### Task 5: Run Checks

- [ ] **Step 1: Frontend**

Run: `cd sheet-sherlock-detective && bun test tests/projects-api.test.ts`

Expected: PASS.

Run: `cd sheet-sherlock-detective && bun run build`

Expected: build completes.

- [ ] **Step 2: Backend**

Run: `cd backend_code/backend && uv run python -m pytest tests/integration/test_project_api.py::test_review_handoff_routes_lock_submission_and_record_approvals tests/integration/test_project_api.py::test_archive_routes_expose_latest_archive_and_audit_json_after_cfo_approval -q`

Expected: PASS.

### Task 6: Commit

- [ ] **Step 1: Commit**

```bash
cd sheet-sherlock-detective
git add src/lib/api/projects.ts src/routes/audit.tsx tests/projects-api.test.ts
git commit -m "feat(audit): drive review and archive from backend"
```

