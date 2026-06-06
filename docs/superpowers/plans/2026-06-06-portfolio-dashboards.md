# Portfolio Dashboards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build saved Portfolio Dashboards so analysts and managers can compare multiple companies across one or more sectors, control Private/Public visibility, and export presentable multi-page PDFs.

**Architecture:** Add portfolio dashboard persistence in the backend, then build a frontend portfolio workspace on the existing Dashboard route. Reuse PSX company data, AskAnalyst overview, Financial Dashboard helper logic, source freshness, approved-model coverage, and existing role access rather than creating a separate analytics stack.

**Tech Stack:** FastAPI backend, existing project/source APIs, React + TanStack Router/Query frontend, existing `PageShell`, `Card`, `Combobox`, `Button`, `financial-dashboard.ts`, browser print/export CSS for PDF.

---

## File Structure

Backend:
- Create `backend/app/models/portfolio_dashboard.py` for persisted portfolio dashboards.
- Create `backend/app/schemas/portfolio_dashboards.py` for request/response contracts.
- Create `backend/app/services/portfolio_dashboards.py` for ownership, visibility, and query logic.
- Create `backend/app/api/routes/portfolio_dashboards.py` for CRUD and PDF metadata endpoints.
- Modify backend router registration where API routes are included.
- Add backend tests under `backend/tests/integration/test_portfolio_dashboards_api.py`.

Frontend:
- Create `src/lib/api/portfolio-dashboards.ts` for typed API client calls.
- Add portfolio types to `src/lib/api/types.ts`.
- Add query keys in `src/lib/api/query-keys.ts`.
- Create `src/lib/portfolio-dashboard.ts` for selection, aggregation, visibility, and export helpers.
- Create `src/lib/portfolio-dashboard.test.ts` for helper tests.
- Modify `src/routes/index.tsx` to add a `Portfolio Dashboards` sub-tab and wire the screen.
- Create focused components later if `src/routes/index.tsx` grows too much, preferably `src/components/PortfolioDashboardBuilder.tsx`, `src/components/PortfolioDashboardList.tsx`, and `src/components/PortfolioDashboardReport.tsx`.
- Add print styles in `src/styles.css` only for PDF/export page breaks.

---

## Slice 1: Portfolio Dashboard Data Contract

**Outcome:** Backend and frontend agree on what a portfolio dashboard is.

- [ ] Define portfolio fields:
  - `id`
  - `name`
  - `description`
  - `visibility`: `"private" | "public"`
  - `createdByUserId`
  - `createdByName`
  - `createdByRole`
  - `companySelections`: `{ symbol, name, sector, weight? }[]`
  - `createdAt`
  - `updatedAt`
  - `lastExportedAt`
- [ ] Default visibility to `private`.
- [ ] Validate portfolio has at least 1 company.
- [ ] Validate duplicate company symbols are collapsed or rejected.
- [ ] Add frontend helper test for duplicate symbols and visibility defaults.

## Slice 2: Backend CRUD And Visibility Rules

**Outcome:** Users can save, update, list, and open portfolios with correct access.

- [ ] Add `POST /api/portfolio-dashboards`.
- [ ] Add `GET /api/portfolio-dashboards?scope=my|public|all`.
- [ ] Add `GET /api/portfolio-dashboards/{id}`.
- [ ] Add `PATCH /api/portfolio-dashboards/{id}`.
- [ ] Add `DELETE /api/portfolio-dashboards/{id}`.
- [ ] Enforce rules:
  - Creator can read/edit/delete own dashboards.
  - Everyone with Dashboard access can read public dashboards.
  - Non-creators cannot edit public dashboards.
  - Private dashboards are invisible to non-creators.
- [ ] Integration tests:
  - analyst creates private dashboard
  - manager cannot read analyst private dashboard
  - manager can read analyst public dashboard
  - manager cannot edit analyst public dashboard
  - creator attribution is returned

## Slice 3: Frontend API And Query Hooks

**Outcome:** Frontend has typed portfolio dashboard API access.

- [ ] Add `listPortfolioDashboards`, `createPortfolioDashboard`, `readPortfolioDashboard`, `updatePortfolioDashboard`, `deletePortfolioDashboard`.
- [ ] Add query keys:
  - `portfolioDashboards(scope)`
  - `portfolioDashboard(id)`
- [ ] Add mutations that invalidate portfolio dashboard lists.
- [ ] Add lightweight API tests or helper tests where project patterns allow.

## Slice 4: Dashboard Navigation And Empty State

**Outcome:** Dashboard has a portfolio entry point without disrupting the existing Financial Dashboard.

- [ ] Add `Portfolio Dashboards` sub-tab after `Financial Dashboard`.
- [ ] Keep `Financial Dashboard` as default landing tab for analysts and managers.
- [ ] For analysts, show:
  - `New Portfolio Dashboard`
  - `My Portfolio Dashboards`
  - `Public Portfolio Dashboards`
- [ ] For managers, show:
  - `Public Portfolio Dashboards`
  - creator filter
  - read-only open action
- [ ] Empty state copy:
  - “Create a portfolio dashboard to compare companies across sectors or within a single sector.”

## Slice 5: Portfolio Builder

**Outcome:** Analysts can build a portfolio from multiple sectors and companies.

- [ ] Add portfolio name and description fields.
- [ ] Add visibility segmented control: `Private` and `Public`.
- [ ] Add sector selector that can be used repeatedly.
- [ ] Add company multi-select filtered by selected sector.
- [ ] Allow same-sector multi-company portfolios.
- [ ] Allow cross-sector portfolios.
- [ ] Show selected companies as removable rows with columns:
  - Company
  - Ticker
  - Sector
  - Optional Weight
- [ ] Validate:
  - name is required
  - at least one company is required
  - weights, if entered, must be positive
- [ ] Save creates portfolio and opens dashboard detail.

## Slice 6: Portfolio Listing UX

**Outcome:** Users can find and manage dashboards.

- [ ] Add search by portfolio name, company, ticker, sector, creator.
- [ ] Add visibility filter: `All`, `Private`, `Public`.
- [ ] Add creator filter for managers/admins.
- [ ] Sort by most recently updated by default.
- [ ] Cards/table show:
  - portfolio name
  - visibility badge
  - creator details
  - companies count
  - sector chips
  - last updated
  - open action
  - edit/delete only for creator
  - duplicate action for all users with dashboard access

## Slice 7: Portfolio Analytics View

**Outcome:** Opening a portfolio shows multi-company dashboard analytics.

- [ ] Fetch AskAnalyst overview for each selected company.
- [ ] Reuse existing financial dashboard helper functions to derive metrics.
- [ ] Render:
  - portfolio summary cards
  - sector allocation
  - company comparison table
  - valuation matrix
  - price performance comparison
  - source freshness strip
  - approved-model coverage
  - broker/source availability panel
- [ ] Clearly show missing data states per company.
- [ ] Show `Last synced` using the freshest and stalest source timestamps.
- [ ] Show “Created by” for public dashboards.

## Slice 8: Approved Model Coverage

**Outcome:** Portfolio dashboards explain which data is live market data and which data comes from approved models.

- [ ] Match selected companies against approved projects.
- [ ] Show coverage count: `3 of 8 companies have approved models`.
- [ ] For approved companies, surface approved model metrics via existing workspace dashboard metrics.
- [ ] For missing companies, show “Approved model not available.”
- [ ] Do not block live market portfolio analytics when approved models are missing.

## Slice 9: Public/Private UX Polish

**Outcome:** Publishing is explicit and understandable.

- [ ] New dashboards default to `Private`.
- [ ] Public toggle copy:
  - Private: “Only you can view this dashboard.”
  - Public: “Everyone with Dashboard access can view this dashboard.”
- [ ] Add creator attribution to public listing and detail header.
- [ ] On changing Private to Public, show a confirmation modal.
- [ ] On changing Public to Private, show a confirmation modal that it will disappear from public listings.

## Slice 10: PDF Export

**Outcome:** Users can download presentable multi-page portfolio dashboard PDFs.

- [ ] Add `Download PDF` button on portfolio detail.
- [ ] Build a print/export layout with:
  - portfolio title
  - visibility
  - created by
  - created/updated timestamps
  - data last synced
  - selected companies and sectors
  - charts/tables
  - source coverage
  - caveats
  - page footer
- [ ] Use CSS print rules:
  - page breaks before major dashboard sections
  - avoid breaking tables/cards awkwardly
  - hide interactive controls
- [ ] Export can use browser print/save-to-PDF first; later backend PDF rendering can be added if needed.
- [ ] Each PDF export is timestamped and treated as a snapshot.
- [ ] Public dashboards can be exported by any viewer.
- [ ] Private dashboards can be exported only by creator.

## Slice 11: Tests And Verification

**Outcome:** The feature is shippable with meaningful confidence.

- [ ] Backend integration tests for CRUD, visibility, and permissions.
- [ ] Frontend helper tests for selection aggregation, filters, visibility labels, and source coverage.
- [ ] Browser checks:
  - analyst creates private dashboard
  - analyst publishes dashboard
  - manager sees public dashboard with creator attribution
  - manager cannot edit analyst dashboard
  - same-sector multi-company portfolio works
  - cross-sector portfolio works
  - PDF export print view is presentable
- [ ] Verify existing Financial Dashboard still defaults correctly.

---

## Delivery Recommendation

Implement in this order:

1. Backend data + permissions.
2. Frontend API + listing shell.
3. Portfolio builder.
4. Portfolio analytics.
5. Public/private polish.
6. PDF export.

This keeps every slice independently reviewable and avoids building a polished UI on top of uncertain persistence or permissions.
