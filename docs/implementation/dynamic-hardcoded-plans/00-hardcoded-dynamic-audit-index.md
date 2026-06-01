# Hardcoded Frontend Dynamic Data Audit

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement one plan file at a time. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track every audited frontend area that still renders static/demo data and route each area into an independent implementation plan.

**Architecture:** The frontend should consume authenticated project, workspace, ingestion, forecast, assumptions, review, and archive contracts instead of module-level demo arrays or local-only workflow state. Backend work is listed inside each plan where an existing endpoint is incomplete or too Millat-specific.

**Tech Stack:** TanStack Start/Router, React 19, Bun tests, FastAPI, Pydantic, SQLAlchemy, pytest.

---

## Audit Summary

| Plan | Frontend hardcoding found | Backend status | Priority |
| --- | --- | --- | --- |
| `01-company-template-catalog-plan.md` | Sector/company/period catalogue, request defaults, Millat template payloads | Backend accepts project/request creation but validates only `Millat - Template.xlsx` | High |
| `02-dashboard-model-summary-plan.md` | Dashboard KPIs, charts, macro strip, approval queue, active models | Backend workspace returns limited `dashboard`, projects list exists but lacks dashboard list shape | High |
| `03-ingestion-source-registry-plan.md` | Static source registry, random feed durations/cell counts, static OCR issues, UI accepts XLSX while backend rejects it | Backend has `/ingestion/preview`, extraction jobs, PDF page image route | High |
| `04-diff-review-workspace-plan.md` | Static `DIFFS`, static model preview values, local-only approve/justify state | Backend has `/workspace`, review cell update/revert, source image route | High |
| `05-diagnosis-workbook-comments-plan.md` | Static workbook rows, sheet tabs, issue list, team members, local comments/corrections/export | Backend has workspace review rows, comments, diagnosis run/decision | High |
| `06-forecast-assumptions-plan.md` | Static scenario arrays, mock sensitivity math, static assumptions rows and submission state | Backend has forecast and assumptions generation endpoints | Medium |
| `07-audit-review-archive-plan.md` | Static event log/counts, local manager/CFO buttons, fake PDF/JSON export | Backend has review decisions, brief generation, latest archive/audit JSON | High |
| `08-ask-ai-dynamic-prediction-plan.md` | Prediction intent bypasses backend and renders canned forecast, fallback answers are static | Backend has Ask AI SSE with session/route/screen/document/filter context plus forecast endpoint | Medium |

## Repo Evidence

- `src/routes/index.tsx` hardcodes the sector/company catalogue, periods, KPIs, revenue chart, waterfall, forecast chart, macro strip, approval queue, and active model rows.
- `src/routes/ingestion.tsx` hardcodes `SOURCES`, OCR issue refs, local source feed timers, random cell counts, and accepts `.xlsx` despite backend PDF-only validation.
- `src/routes/diff-review.tsx` hardcodes `DIFFS` and `mockValue`.
- `src/routes/diagnosis.tsx` hardcodes workbook rows, sheet tabs, members, issues, comments, correction values, and local export.
- `src/routes/forecast.tsx` hardcodes scenario arrays and driver sliders instead of calling `runProjectForecast`.
- `src/routes/assumptions.tsx` hardcodes rows and review submission summary instead of calling `generateProjectAssumptions` or review submit.
- `src/routes/audit.tsx` hardcodes audit log, review state, brief status, archive id, and fake export blobs.
- `src/components/AskAiTrigger.tsx` streams project Ask AI for generic questions with session, route, screen, and cycle filters; forecast/prediction prompts still branch to static UI.
- `src/components/SourcePreviewPanel.tsx` renders a synthetic page instead of the backend page image endpoint.
- `src/lib/api/projects.ts` already contains many backend clients and streams Ask AI with `sessionId`, `routePath`, `screenName`, `documentIds`, and `filters`; it still hardcodes Millat template/currency and lacks workspace, extraction job polling, ingestion preview, latest brief, review cell update, and comment-list wrappers.

## Backend Evidence

- `backend/app/api/routes/projects.py` exposes project list/create/read, document upload, extraction job start/read, workspace, ingestion preview, source search, Ask AI stream, diagnosis, forecast, assumptions, briefs, archive, review submit/decisions, review cell update/revert, and comments.
- `backend/app/schemas/projects.py` validates only `Millat - Template.xlsx` for `ProjectCreate` and `AnalysisRequestCreate`.
- `backend/app/services/projects.py` builds workspace review/dashboard/audit payloads and returns a minimal `_dashboard(fields)` with revenue, extracted values, pending review, and revenue trend.
- `backend/app/services/ingestion/preview.py` builds the source registry preview payload with 13 PRD source groups.
- `backend/app/services/forecasting.py` and `backend/app/services/assumptions.py` generate backend forecast and assumptions payloads.

## Implementation Order

1. Implement `01-company-template-catalog-plan.md` first so projects, requests, and route context stop assuming Millat-only setup.
2. Implement `03-ingestion-source-registry-plan.md` and `04-diff-review-workspace-plan.md` next because they create the project/workspace data path used by the later screens.
3. Implement `05-diagnosis-workbook-comments-plan.md` before `06-forecast-assumptions-plan.md` so forecast baselines use reviewed/locked values.
4. Implement `07-audit-review-archive-plan.md` after review submission is wired.
5. Implement `02-dashboard-model-summary-plan.md` once the workflow endpoints produce useful summaries.
6. Implement `08-ask-ai-dynamic-prediction-plan.md` after forecast and dashboard contracts are stable.
