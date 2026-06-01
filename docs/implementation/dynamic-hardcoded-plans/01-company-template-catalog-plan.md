# Company Template Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded sector, company, period, currency, and Millat template assumptions with backend-driven catalogue data.

**Architecture:** Add backend catalogue endpoints for companies, sectors, templates, periods, and project defaults. Move frontend request/dashboard selection to React Query-backed API data with local storage used only for last selected IDs, not as the source of truth.

**Tech Stack:** FastAPI, Pydantic, SQLAlchemy or static registry service, TanStack Router, React Query, Bun tests, pytest.

---

## Hardcoded Evidence

- `src/routes/index.tsx:46` defines `SECTORS` with fixed companies and tickers.
- `src/routes/index.tsx:189` defines fixed periods.
- `src/routes/index.tsx:258` falls back to Millat/MTL/FY2025.
- `src/routes/requests.tsx:32` initializes the request form with Millat, MTL, Industrial Engineering, FY2025.
- `src/lib/api/projects.ts:128` and `src/lib/api/projects.ts:442` force `"Millat - Template.xlsx"`.
- `backend/app/schemas/projects.py:41` and `backend/app/schemas/projects.py:60` reject every template except Millat.

## Backend Current State

- Project and analysis request creation exist.
- The database already stores `company_symbol`, `sector`, `fiscal_year`, `currency_unit`, and `template_name`.
- There is no catalogue endpoint for valid sectors, companies, fiscal periods, or templates.

## Files

- Create: `backend_code/backend/app/services/catalog.py`
- Create: `backend_code/backend/app/api/routes/catalog.py`
- Modify: `backend_code/backend/app/main.py`
- Modify: `backend_code/backend/app/schemas/projects.py`
- Modify: `sheet-sherlock-detective/src/lib/api/projects.ts`
- Create: `sheet-sherlock-detective/src/lib/api/catalog.ts`
- Modify: `sheet-sherlock-detective/src/routes/index.tsx`
- Modify: `sheet-sherlock-detective/src/routes/requests.tsx`
- Modify: `sheet-sherlock-detective/src/routes/requests.$requestId.tsx`
- Test: `backend_code/backend/tests/unit/test_catalog.py`
- Test: `backend_code/backend/tests/integration/test_catalog_api.py`
- Test: `sheet-sherlock-detective/tests/catalog-api.test.ts`
- Test: update `sheet-sherlock-detective/e2e/02-request-initiation.e2e.ts`

### Task 1: Backend Catalogue Service

- [ ] **Step 1: Write unit tests**

Create `backend_code/backend/tests/unit/test_catalog.py`:

```python
from app.services.catalog import get_catalog, resolve_template_for_sector


def test_catalog_exposes_companies_periods_and_templates():
    catalog = get_catalog()

    assert catalog["defaultPeriod"] == "FY2025"
    assert any(sector["name"] == "Engineering & Industrials" for sector in catalog["sectors"])
    assert any(company["ticker"] == "MTL" for company in catalog["companies"])
    assert any(template["name"] == "Millat - Template.xlsx" for template in catalog["templates"])


def test_resolve_template_for_sector_uses_sector_default():
    assert resolve_template_for_sector("Engineering & Industrials") == "Millat - Template.xlsx"
    assert resolve_template_for_sector("Unknown Sector") == "Millat - Template.xlsx"
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd backend_code/backend && uv run python -m pytest tests/unit/test_catalog.py -q`

Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.catalog'`.

- [ ] **Step 3: Add catalogue service**

Create `backend_code/backend/app/services/catalog.py`:

```python
from __future__ import annotations

from typing import Any

CATALOG: dict[str, Any] = {
    "defaultPeriod": "FY2025",
    "periods": ["FY2025", "FY2024", "FY2023", "Q3 FY2025", "Q2 FY2025"],
    "sectors": [
        {"id": "engineering-industrials", "name": "Engineering & Industrials", "defaultTemplate": "Millat - Template.xlsx"},
        {"id": "banking-finance", "name": "Banking & Finance", "defaultTemplate": "Banking IFRS 9 template.xlsx"},
        {"id": "oil-gas", "name": "Oil & Gas", "defaultTemplate": "E&P sector template.xlsx"},
    ],
    "companies": [
        {"id": "mtl", "name": "Millat Tractors Limited", "ticker": "MTL", "sector": "Engineering & Industrials", "defaultCurrencyUnit": "Rs in Thousands"},
        {"id": "agtl", "name": "Al-Ghazi Tractors", "ticker": "AGTL", "sector": "Engineering & Industrials", "defaultCurrencyUnit": "Rs in Thousands"},
        {"id": "mcb", "name": "MCB Bank", "ticker": "MCB", "sector": "Banking & Finance", "defaultCurrencyUnit": "Rs in Thousands"},
    ],
    "templates": [
        {"name": "Millat - Template.xlsx", "sector": "Engineering & Industrials", "status": "supported"},
        {"name": "Banking IFRS 9 template.xlsx", "sector": "Banking & Finance", "status": "planned"},
        {"name": "E&P sector template.xlsx", "sector": "Oil & Gas", "status": "planned"},
    ],
}


def get_catalog() -> dict[str, Any]:
    return CATALOG


def supported_template_names() -> set[str]:
    return {template["name"] for template in CATALOG["templates"] if template["status"] == "supported"}


def resolve_template_for_sector(sector: str | None) -> str:
    for item in CATALOG["sectors"]:
        if item["name"] == sector:
            return str(item["defaultTemplate"])
    return "Millat - Template.xlsx"
```

- [ ] **Step 4: Run unit test**

Run: `cd backend_code/backend && uv run python -m pytest tests/unit/test_catalog.py -q`

Expected: PASS.

### Task 2: Backend Catalogue API

- [ ] **Step 1: Write integration test**

Create `backend_code/backend/tests/integration/test_catalog_api.py`:

```python
from fastapi.testclient import TestClient

from app.main import create_app


def test_catalog_endpoint_returns_dynamic_selection_options():
    client = TestClient(create_app())

    response = client.get("/api/catalog")

    assert response.status_code == 200
    body = response.json()
    assert body["defaultPeriod"] == "FY2025"
    assert body["companies"][0]["name"]
    assert body["templates"][0]["name"] == "Millat - Template.xlsx"
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd backend_code/backend && uv run python -m pytest tests/integration/test_catalog_api.py -q`

Expected: FAIL with 404 for `/api/catalog`.

- [ ] **Step 3: Add route and register it**

Create `backend_code/backend/app/api/routes/catalog.py`:

```python
from __future__ import annotations

from fastapi import APIRouter

from app.services.catalog import get_catalog

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


@router.get("")
async def read_catalog() -> dict[str, object]:
    return get_catalog()
```

Modify `backend_code/backend/app/main.py`:

```python
from app.api.routes import catalog

app.include_router(catalog.router)
```

- [ ] **Step 4: Run integration test**

Run: `cd backend_code/backend && uv run python -m pytest tests/integration/test_catalog_api.py -q`

Expected: PASS.

### Task 3: Relax Template Validation Safely

- [ ] **Step 1: Update schema tests**

Add to `backend_code/backend/tests/unit/test_catalog.py`:

```python
import pytest
from pydantic import ValidationError

from app.schemas.projects import ProjectCreate


def test_project_create_accepts_supported_catalog_template():
    payload = ProjectCreate(
        companyName="Millat Tractors Limited",
        sector="Engineering & Industrials",
        template="Millat - Template.xlsx",
    )

    assert payload.template == "Millat - Template.xlsx"


def test_project_create_rejects_unsupported_template():
    with pytest.raises(ValidationError):
        ProjectCreate(companyName="Demo", template="Unknown.xlsx")
```

- [ ] **Step 2: Modify validation**

In `backend_code/backend/app/schemas/projects.py`, replace the exact Millat check with:

```python
from app.services.catalog import supported_template_names


@field_validator("template")
@classmethod
def require_supported_template(cls, value: str) -> str:
    if value not in supported_template_names():
        raise ValueError(f"Unsupported template: {value}")
    return value
```

Apply the same validator body for `AnalysisRequestCreate`.

- [ ] **Step 3: Run backend tests**

Run: `cd backend_code/backend && uv run python -m pytest tests/unit/test_catalog.py tests/integration/test_catalog_api.py tests/integration/test_project_api.py -q`

Expected: PASS.

### Task 4: Frontend Catalogue Client

- [ ] **Step 1: Write API test**

Create `sheet-sherlock-detective/tests/catalog-api.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { getCatalog } from "../src/lib/api/catalog";

describe("catalog api", () => {
  it("loads sectors, companies, periods, and templates", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            defaultPeriod: "FY2025",
            periods: ["FY2025"],
            sectors: [{ id: "engineering-industrials", name: "Engineering & Industrials", defaultTemplate: "Millat - Template.xlsx" }],
            companies: [{ id: "mtl", name: "Millat Tractors Limited", ticker: "MTL", sector: "Engineering & Industrials", defaultCurrencyUnit: "Rs in Thousands" }],
            templates: [{ name: "Millat - Template.xlsx", sector: "Engineering & Industrials", status: "supported" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )) as typeof fetch;

    const catalog = await getCatalog();

    expect(catalog.defaultPeriod).toBe("FY2025");
    expect(catalog.companies[0].ticker).toBe("MTL");
    globalThis.fetch = originalFetch;
  });
});
```

- [ ] **Step 2: Add API client**

Create `sheet-sherlock-detective/src/lib/api/catalog.ts`:

```ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

export type CatalogCompany = {
  id: string;
  name: string;
  ticker: string;
  sector: string;
  defaultCurrencyUnit: string;
};

export type CatalogSector = {
  id: string;
  name: string;
  defaultTemplate: string;
};

export type CatalogTemplate = {
  name: string;
  sector: string;
  status: "supported" | "planned";
};

export type CatalogResponse = {
  defaultPeriod: string;
  periods: string[];
  sectors: CatalogSector[];
  companies: CatalogCompany[];
  templates: CatalogTemplate[];
};

export async function getCatalog(): Promise<CatalogResponse> {
  const response = await fetch(`${API_BASE_URL}/api/catalog`);
  if (!response.ok) {
    throw new Error(response.statusText || "Could not load catalog.");
  }
  return response.json() as Promise<CatalogResponse>;
}
```

- [ ] **Step 3: Run frontend API test**

Run: `cd sheet-sherlock-detective && bun test tests/catalog-api.test.ts`

Expected: PASS.

### Task 5: Replace Frontend Hardcoded Selection

- [ ] **Step 1: Replace `SECTORS` and `PERIODS` in dashboard**

In `sheet-sherlock-detective/src/routes/index.tsx`, load `getCatalog()` on mount and map sectors/companies to the existing panel shape. Keep icon selection in a local `sectorIconForName()` function.

```ts
const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
const [catalogError, setCatalogError] = useState<string | null>(null);

useEffect(() => {
  getCatalog()
    .then(setCatalog)
    .catch((error) => setCatalogError(error instanceof Error ? error.message : "Could not load catalog."));
}, []);

const sectors = useMemo(
  () =>
    (catalog?.sectors ?? []).map((sector) => ({
      name: sector.name,
      icon: sectorIconForName(sector.name),
      total: (catalog?.companies ?? []).filter((company) => company.sector === sector.name).length,
      companies: (catalog?.companies ?? [])
        .filter((company) => company.sector === sector.name)
        .map((company) => ({ name: company.name, ticker: company.ticker })),
    })),
  [catalog],
);
```

Use `catalog?.periods ?? []` for period chips. If `catalogError` is set, render a compact error inside the selection panel.

- [ ] **Step 2: Replace request form defaults**

In `sheet-sherlock-detective/src/routes/requests.tsx`, load catalog and initialize the form from the first supported company:

```ts
const defaultCompany = catalog?.companies[0];
const defaultPeriod = catalog?.defaultPeriod ?? "FY2025";
```

Set `companyName`, `companySymbol`, `sector`, and `fiscalYear` from catalog after the first successful fetch if the user has not typed into the form.

- [ ] **Step 3: Pass template/currency dynamically**

Modify `createProjectForCycle` and `createAnalysisRequest` in `src/lib/api/projects.ts` to accept optional `template` and `currencyUnit`, then send caller-provided values:

```ts
template: input.template,
currencyUnit: input.currencyUnit,
```

Callers should use the selected sector's `defaultTemplate` and selected company's `defaultCurrencyUnit`.

- [ ] **Step 4: Run frontend checks**

Run: `cd sheet-sherlock-detective && bun test tests/catalog-api.test.ts tests/projects-api.test.ts`

Expected: PASS.

Run: `cd sheet-sherlock-detective && bun run build`

Expected: build completes.

### Task 6: Commit

- [ ] **Step 1: Commit backend and frontend separately**

Backend:

```bash
cd backend_code
git add backend/app/services/catalog.py backend/app/api/routes/catalog.py backend/app/main.py backend/app/schemas/projects.py backend/tests/unit/test_catalog.py backend/tests/integration/test_catalog_api.py backend/tests/integration/test_project_api.py
git commit -m "feat(catalog): expose supported company and template options"
```

Frontend:

```bash
cd sheet-sherlock-detective
git add src/lib/api/catalog.ts src/lib/api/projects.ts src/routes/index.tsx src/routes/requests.tsx "src/routes/requests.$requestId.tsx" tests/catalog-api.test.ts tests/projects-api.test.ts
git commit -m "feat(catalog): load company and template options dynamically"
```

