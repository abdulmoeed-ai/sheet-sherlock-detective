# Dashboard Model Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static dashboard KPIs, model list, macro strip, charts, and approval queue with backend project/workspace summary data.

**Architecture:** Add a backend dashboard summary endpoint that aggregates project list, workspace dashboard, review progress, three-statement status, latest archive, and source freshness into a single screen payload. Frontend dashboard renders from that payload and keeps only display formatting local.

**Tech Stack:** FastAPI, SQLAlchemy query aggregation, Pydantic response shape, TanStack Router, React state/effects or React Query, Bun tests, pytest.

---

## Hardcoded Evidence

- `src/routes/index.tsx:672` renders fixed KPI cards.
- `src/routes/index.tsx:707` renders fixed Actual/Budget/Variance summary stats.
- `src/routes/index.tsx:760` renders fixed CPI/KIBOR/PKR/USD assumptions.
- `src/routes/index.tsx:822` renders fixed approval queue counts.
- `src/routes/index.tsx:851` renders fixed macro tiles.
- `src/routes/index.tsx:899` renders fixed active model rows.
- `src/routes/index.tsx:973`, `src/routes/index.tsx:1029`, and `src/routes/index.tsx:1080` generate static chart series.

## Backend Current State

- `GET /api/projects` lists projects, but `ProjectResponse` does not include dashboard rows or last workflow summaries.
- `GET /api/projects/{project_id}/workspace` returns `dashboard`, `reviewProgress`, `threeStatementCheck`, `balanceSheetDiagnosis`, `auditEvents`, and `ingestionPreviewSummary`.
- `_dashboard(fields)` currently returns only revenue, extracted values, pending review, and trend.

## Files

- Modify: `backend_code/backend/app/schemas/projects.py`
- Modify: `backend_code/backend/app/api/routes/projects.py`
- Modify: `backend_code/backend/app/services/projects.py`
- Test: `backend_code/backend/tests/integration/test_project_api.py`
- Modify: `sheet-sherlock-detective/src/lib/api/projects.ts`
- Modify: `sheet-sherlock-detective/src/routes/index.tsx`
- Test: `sheet-sherlock-detective/tests/projects-api.test.ts`

### Task 1: Define Backend Dashboard Summary Contract

- [ ] **Step 1: Add schema**

In `backend_code/backend/app/schemas/projects.py`, add:

```python
class DashboardModelRow(BaseModel):
    projectId: str
    companyName: str
    sector: str | None = None
    period: str | None = None
    analyst: str | None = None
    dataConfidence: float | None = None
    status: str
    updatedAt: str
    tone: str


class DashboardSummaryResponse(BaseModel):
    selectedProjectId: str | None = None
    metrics: list[dict[str, Any]]
    trend: list[dict[str, Any]]
    varianceBridge: list[dict[str, Any]]
    forecastScenarios: list[dict[str, Any]]
    macroTiles: list[dict[str, Any]]
    approvalQueue: list[dict[str, Any]]
    activeModels: list[DashboardModelRow]
    lastApproved: dict[str, Any] | None = None
    alerts: list[dict[str, Any]] = Field(default_factory=list)
```

- [ ] **Step 2: Write integration test**

Add to `backend_code/backend/tests/integration/test_project_api.py`:

```python
def test_dashboard_summary_route_returns_project_rows(project_client: TestClient):
    headers = auth_headers(project_client, "dash@example.com")
    created = project_client.post("/api/projects", json=millat_payload(), headers=headers).json()

    response = project_client.get("/api/projects/dashboard-summary", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["activeModels"][0]["projectId"] == created["id"]
    assert body["metrics"]
    assert body["approvalQueue"]
```

- [ ] **Step 3: Run test to verify failure**

Run: `cd backend_code/backend && uv run python -m pytest tests/integration/test_project_api.py::test_dashboard_summary_route_returns_project_rows -q`

Expected: FAIL with 404.

### Task 2: Implement Backend Aggregation

- [ ] **Step 1: Add service method**

In `backend_code/backend/app/services/projects.py`, add:

```python
async def get_dashboard_summary(self, *, user_id: str, selected_project_id: str | None = None) -> dict[str, Any]:
    projects = await self.projects.list_projects(user_id=user_id)
    selected = None
    if selected_project_id:
        selected = await self._get_owned_project(user_id=user_id, project_id=selected_project_id)
    elif projects:
        selected = projects[0]

    fields = await self._list_fields(selected.id) if selected else []
    dashboard = _dashboard(fields)
    export_summary = _export_summary(fields)
    check = await self._latest_three_statement_check_payload(selected.id) if selected else None
    diagnosis = await self._latest_balance_sheet_diagnosis_payload(selected.id) if selected else None
    ingestion_summary = (
        (await self.get_source_ingestion_preview(user_id=user_id, project_id=selected.id))["summary"]
        if selected
        else None
    )

    return {
        "selectedProjectId": selected.id if selected else None,
        "metrics": dashboard["metrics"],
        "trend": dashboard["trend"],
        "varianceBridge": _dashboard_variance_bridge(fields),
        "forecastScenarios": [],
        "macroTiles": _dashboard_macro_tiles(ingestion_summary),
        "approvalQueue": _dashboard_approval_queue(export_summary, check, diagnosis, selected.status if selected else "idle"),
        "activeModels": [await self._dashboard_model_row(project) for project in projects],
        "lastApproved": await self._latest_approved_summary(user_id=user_id),
        "alerts": _dashboard_alerts(check, diagnosis),
    }
```

Add helper functions returning deterministic payloads derived from existing fields/status, not new external APIs. For missing data, return `"Pending"` and empty arrays instead of demo figures.

- [ ] **Step 2: Add route**

In `backend_code/backend/app/api/routes/projects.py`, import `DashboardSummaryResponse` and add this route before `/{project_id}` routes:

```python
@router.get("/dashboard-summary", response_model=DashboardSummaryResponse)
async def read_dashboard_summary(
    current_user: CurrentUserDep,
    projects: ProjectServiceDep,
    project_id: str | None = Query(default=None),
) -> dict:
    return await projects.get_dashboard_summary(user_id=current_user.id, selected_project_id=project_id)
```

- [ ] **Step 3: Run backend test**

Run: `cd backend_code/backend && uv run python -m pytest tests/integration/test_project_api.py::test_dashboard_summary_route_returns_project_rows -q`

Expected: PASS.

### Task 3: Add Frontend API Client

- [ ] **Step 1: Write frontend test**

Add to `sheet-sherlock-detective/tests/projects-api.test.ts`:

```ts
import { getDashboardSummary } from "../src/lib/api/projects";

it("loads dashboard summary", async () => {
  withSession();
  const requests: Request[] = [];
  globalThis.fetch = ((input, init) => {
    requests.push(new Request(input, init));
    return jsonResponse({
      selectedProjectId: "project-1",
      metrics: [{ label: "Revenue", value: "Rs 54.8B", period: "FY2025" }],
      trend: [],
      varianceBridge: [],
      forecastScenarios: [],
      macroTiles: [],
      approvalQueue: [],
      activeModels: [],
      lastApproved: null,
      alerts: [],
    });
  }) as typeof fetch;

  const summary = await getDashboardSummary("project-1");

  expect(summary.selectedProjectId).toBe("project-1");
  expect(requests[0].url).toEndWith("/api/projects/dashboard-summary?project_id=project-1");
});
```

- [ ] **Step 2: Add API wrapper**

In `sheet-sherlock-detective/src/lib/api/projects.ts`, add:

```ts
export type DashboardSummary = {
  selectedProjectId: string | null;
  metrics: Array<Record<string, unknown>>;
  trend: Array<Record<string, unknown>>;
  varianceBridge: Array<Record<string, unknown>>;
  forecastScenarios: Array<Record<string, unknown>>;
  macroTiles: Array<Record<string, unknown>>;
  approvalQueue: Array<Record<string, unknown>>;
  activeModels: Array<Record<string, unknown>>;
  lastApproved: Record<string, unknown> | null;
  alerts: Array<Record<string, unknown>>;
};

export async function getDashboardSummary(projectId?: string | null): Promise<DashboardSummary> {
  const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
  return apiRequest(`/api/projects/dashboard-summary${query}`);
}
```

- [ ] **Step 3: Run frontend test**

Run: `cd sheet-sherlock-detective && bun test tests/projects-api.test.ts`

Expected: PASS.

### Task 4: Render Dashboard From Summary

- [ ] **Step 1: Load summary**

In `sheet-sherlock-detective/src/routes/index.tsx`, call `getDashboardSummary(cycle.projectId)` after catalog/selection hydration. Add loading and error states:

```ts
const [summary, setSummary] = useState<DashboardSummary | null>(null);
const [summaryError, setSummaryError] = useState<string | null>(null);

useEffect(() => {
  getDashboardSummary(cycleStore.get().projectId)
    .then(setSummary)
    .catch((error) => setSummaryError(error instanceof Error ? error.message : "Could not load dashboard."));
}, [selection?.company, selection?.period]);
```

- [ ] **Step 2: Replace static sections**

Map these UI blocks from `summary`:

```ts
const metrics = summary?.metrics ?? [];
const trend = summary?.trend ?? [];
const macroTiles = summary?.macroTiles ?? [];
const approvalQueue = summary?.approvalQueue ?? [];
const models = summary?.activeModels ?? [];
```

Render empty states:

```tsx
{metrics.length === 0 ? <EmptyState label="No extracted dashboard metrics yet." /> : metrics.map(...)}
```

- [ ] **Step 3: Keep charts data-driven**

Change `RevenueChart`, `Waterfall`, and `ForecastChart` props from no-arg/static to:

```ts
function RevenueChart({ data }: { data: Array<Record<string, unknown>> }) { ... }
function Waterfall({ steps }: { steps: Array<Record<string, unknown>> }) { ... }
function ForecastChart({ scenarios, scenario }: { scenarios: Array<Record<string, unknown>>; scenario: "Base" | "Bull" | "Bear" }) { ... }
```

When arrays are empty, show a compact chart placeholder reading values from project status, not demo data.

- [ ] **Step 4: Run checks**

Run: `cd sheet-sherlock-detective && bun test tests/projects-api.test.ts`

Expected: PASS.

Run: `cd sheet-sherlock-detective && bun run build`

Expected: build completes.

### Task 5: Commit

- [ ] **Step 1: Commit**

```bash
cd backend_code
git add backend/app/schemas/projects.py backend/app/api/routes/projects.py backend/app/services/projects.py backend/tests/integration/test_project_api.py
git commit -m "feat(projects): expose dashboard summary"

cd ../sheet-sherlock-detective
git add src/lib/api/projects.ts src/routes/index.tsx tests/projects-api.test.ts
git commit -m "feat(dashboard): render project summary from api"
```

