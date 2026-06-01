# Forecast Assumptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static forecast scenarios, sensitivity math, assumptions rows, and local submission state with backend forecast and assumptions payloads.

**Architecture:** Use `POST /forecast/run` to generate scenario data and `POST /assumptions/generate` to produce the assumptions sheet. Store the latest forecast response in component state and pass it to assumptions generation. Only keep UI slider values as user input parameters.

**Tech Stack:** React, FastAPI forecast/assumptions services, source registry, Bun tests, pytest.

---

## Hardcoded Evidence

- `src/routes/forecast.tsx:17` defines `BASE_SCENARIOS`.
- `src/routes/forecast.tsx:22` defines forecast years.
- `src/routes/forecast.tsx:32` applies local mock sensitivity math.
- `src/routes/forecast.tsx:147` defines static scenario summary margins/CAGRs.
- `src/routes/forecast.tsx:168` defines static key assumptions.
- `src/routes/assumptions.tsx:26` defines static assumptions rows.
- `src/routes/assumptions.tsx:75` says `47 assumption rows · 0 unresolved flags` regardless of backend.

## Backend Current State

- `POST /api/projects/{project_id}/forecast/run` returns steps, scenarios, assumptions, citations, and warnings.
- `POST /api/projects/{project_id}/assumptions/generate` returns rows, summary, write policy, generated timestamp.
- Forecast payload currently does not accept KIBOR/CPI/FX override values; those can be represented in the query until a richer backend driver schema is added.

## Files

- Modify: `sheet-sherlock-detective/src/routes/forecast.tsx`
- Modify: `sheet-sherlock-detective/src/routes/assumptions.tsx`
- Modify: `sheet-sherlock-detective/src/lib/api/projects.ts`
- Test: `sheet-sherlock-detective/tests/projects-api.test.ts`
- Optional backend: `backend_code/backend/app/schemas/projects.py`, `backend_code/backend/app/services/forecasting.py`
- Optional backend tests: `backend_code/backend/tests/unit/test_forecasting.py`, `backend_code/backend/tests/unit/test_assumptions.py`

### Task 1: Normalize Frontend Types

- [ ] **Step 1: Add strict response types**

In `src/lib/api/projects.ts`, replace loose forecast/assumption return objects with:

```ts
export type ForecastScenarioPoint = {
  year: string;
  revenue: number;
  revenueGrowth: number;
  ebitda: number;
  ebitdaMargin: number;
};

export type ForecastScenario = {
  id: "bear" | "base" | "bull" | string;
  label: string;
  revenueGrowth: number;
  points: ForecastScenarioPoint[];
};

export type ForecastRunResponse = {
  status: string;
  projectId: string;
  companyName: string;
  sector: string | null;
  projectionYears: number;
  sourceStatus: string;
  sourceReason: string | null;
  steps: Array<Record<string, unknown>>;
  scenarios: ForecastScenario[];
  assumptions: Array<Record<string, unknown>>;
  citations: Array<Record<string, unknown>>;
  warnings: string[];
};

export type AssumptionsGenerateResponse = {
  status: string;
  projectId: string;
  sheetName: string;
  generatedAt: string;
  writePolicy: Record<string, unknown>;
  rows: Array<Record<string, unknown>>;
  summary: Record<string, number>;
};
```

- [ ] **Step 2: Run type/build check**

Run: `cd sheet-sherlock-detective && bun run build`

Expected: build completes or shows call sites requiring updates.

### Task 2: Wire Forecast Screen

- [ ] **Step 1: Replace static scenarios with API state**

In `src/routes/forecast.tsx`:

```ts
const [forecast, setForecast] = useState<ForecastRunResponse | null>(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

async function runForecast() {
  if (!cycle.projectId) {
    setError("Create or open a project before running forecast.");
    return;
  }
  setLoading(true);
  setError(null);
  try {
    setForecast(
      await runProjectForecast(cycle.projectId, {
        query: `${cycle.company} ${cycle.sector} forecast with KIBOR ${kibor.toFixed(1)}%, CPI ${cpi.toFixed(1)}%, PKR/USD ${fx.toFixed(0)}`,
        projectionYears: 5,
      }),
    );
  } catch (err) {
    setError(err instanceof Error ? err.message : "Could not run forecast.");
  } finally {
    setLoading(false);
  }
}
```

Call `runForecast()` on page load when `cycle.projectId` exists and when the user presses a new `Run forecast` button.

- [ ] **Step 2: Render backend scenarios**

Change chart and table input:

```ts
const scenarios = forecast?.scenarios ?? [];
const activeScenario = scenarios.find((item) => item.id.toLowerCase().includes(scenario.toLowerCase()));
```

Render empty state when no forecast exists:

```tsx
{!forecast ? <EmptyForecastState onRun={runForecast} loading={loading} /> : <ForecastSvg scenarios={scenarios} active={scenario} />}
```

- [ ] **Step 3: Store forecast for assumptions**

When navigating:

```ts
sessionStorage.setItem("sheet_sherlock_latest_forecast", JSON.stringify(forecast));
navigate({ to: "/assumptions" });
```

### Task 3: Wire Assumptions Screen

- [ ] **Step 1: Generate assumptions from backend**

In `src/routes/assumptions.tsx`:

```ts
const [payload, setPayload] = useState<AssumptionsGenerateResponse | null>(null);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  if (!cycle.projectId) return;
  const forecastRaw = sessionStorage.getItem("sheet_sherlock_latest_forecast");
  const forecast = forecastRaw ? JSON.parse(forecastRaw) : undefined;
  generateProjectAssumptions(cycle.projectId, forecast)
    .then(setPayload)
    .catch((err) => setError(err instanceof Error ? err.message : "Could not generate assumptions."));
}, [cycle.projectId]);
```

- [ ] **Step 2: Render backend rows**

Replace `ROWS` with `payload?.rows ?? []` and map:

```tsx
<td>{String(row.driver ?? row.name ?? "")}</td>
<td>{String(row.value ?? "")}</td>
<td>{String(row.source ?? "")}</td>
<td>{String(row.period ?? "")}</td>
<td>{row.confidence == null ? "n/a" : `${row.confidence}%`}</td>
<td>{String(row.sensitivityRank ?? "low")}</td>
```

Use `payload.summary.total`, `payload.summary.highSensitivity`, and `payload.summary.missingSource` instead of `47 rows`.

- [ ] **Step 3: Submit through review endpoint**

Replace local submission with:

```ts
if (!cycle.projectId) return;
await submitProjectForManagerReview(cycle.projectId, "Assumptions reviewed and ready for manager review.");
cycleStore.setStatus("review");
navigate({ to: "/audit" });
```

### Task 4: Optional Backend Driver Schema

- [ ] **Step 1: Add driver overrides if richer sensitivity is required**

In `backend/app/schemas/projects.py`, add:

```python
drivers: dict[str, float] = Field(default_factory=dict)
```

to `ForecastRunRequest`.

- [ ] **Step 2: Apply in forecast service**

In `backend/app/services/forecasting.py`, accept driver overrides and adjust growth rate deterministically:

```python
driver_adjustment = Decimal(str(drivers.get("cpi", 0))) * Decimal("0.0004")
```

Keep bounds from `_scenario`.

- [ ] **Step 3: Run backend tests**

Run: `cd backend_code/backend && uv run python -m pytest tests/unit/test_forecasting.py tests/unit/test_assumptions.py -q`

Expected: PASS.

### Task 5: Run Checks

- [ ] **Step 1: Frontend**

Run: `cd sheet-sherlock-detective && bun test tests/projects-api.test.ts`

Expected: PASS.

Run: `cd sheet-sherlock-detective && bun run build`

Expected: build completes.

### Task 6: Commit

- [ ] **Step 1: Commit**

```bash
cd sheet-sherlock-detective
git add src/lib/api/projects.ts src/routes/forecast.tsx src/routes/assumptions.tsx tests/projects-api.test.ts
git commit -m "feat(forecast): render forecast and assumptions from api"
```

If backend driver schema changed:

```bash
cd backend_code
git add backend/app/schemas/projects.py backend/app/services/forecasting.py backend/tests/unit/test_forecasting.py
git commit -m "feat(forecast): support explicit driver overrides"
```

