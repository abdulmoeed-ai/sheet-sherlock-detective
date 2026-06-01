# Backend API Inventory For Frontend Integration

Generated: 2026-06-01

Source inspected:
- Backend repo: `/home/tk-lpt-817/Desktop/mvp_sheet_sherlock/backend_code`
- Frontend repo: `/home/tk-lpt-817/Desktop/mvp_sheet_sherlock/sheet-sherlock-detective`
- Backend route files: `backend/app/api/routes/auth.py`, `backend/app/api/routes/analysis_requests.py`, `backend/app/api/routes/projects.py`, `backend/app/api/routes/source_registry.py`, `backend/app/api/routes/progress.py`, `backend/app/api/routes/health.py`
- Backend schema files: `backend/app/schemas/auth.py`, `backend/app/schemas/projects.py`

## Base URLs

- HTTP API base: `http://127.0.0.1:8000`
- Frontend default local dev origin allowed by backend CORS: `http://127.0.0.1:5173`, `http://localhost:5173`, `http://127.0.0.1:5174`, `http://localhost:5174`, `http://127.0.0.1:8080`, `http://localhost:8080`
- WebSocket base: same host as HTTP API with `ws://` or `wss://`

## Role Model

Expose these frontend roles:

| Frontend label | Backend role value | Main experience |
| --- | --- | --- |
| Analyst | `finance_analyst` | View manager-generated requests in Inbox, accept requests, convert request to project, run ingestion/review/diagnosis/forecast/assumptions, submit for manager review |
| Manager | `finance_manager` | Create analyst requests from a Manager Request form, monitor assigned work, review submitted project packs, approve or send back |
| CFO | `cfo` | Review executive briefs, sign off or reject models, inspect archive and audit outputs |
| Admin | `admin` | Access source/admin menus and admin-only mapping-rule controls |

`src/components/Sidebar.tsx` must show only menus relevant to the logged-in role returned by `GET /api/auth/me`.

Role constraints confirmed from backend:
- `POST /api/auth/register` accepts `finance_analyst`, `finance_manager`, and `cfo`; it does not accept `admin`.
- `POST /api/analysis-requests` requires `finance_manager` or `admin`.
- `GET /api/analysis-requests` returns all requests to `finance_manager`, `cfo`, or `admin`, and only assigned requests to analysts.
- `POST /api/analysis-requests/{request_id}/acknowledge` requires the assigned analyst.
- `POST /api/analysis-requests/{request_id}/convert-to-project` requires the assigned analyst.
- Admin-only mapping-rule endpoints should only appear in Admin menus.
- Project ownership checks currently use the logged-in user's owned projects for project APIs. Manager review actions may only work for projects the manager can access in the backend; the frontend plan includes a verification task to confirm or file a backend follow-up if manager access is not yet represented in project ownership.

## Auth APIs

### `POST /api/auth/register`

Purpose: self-service user registration.

Request:

```json
{
  "email": "analyst@example.com",
  "name": "Ayesha Analyst",
  "password": "password123",
  "role": "finance_analyst"
}
```

Response:

```json
{
  "id": "user-id",
  "email": "analyst@example.com",
  "name": "Ayesha Analyst",
  "role": "finance_analyst"
}
```

Frontend handling:
- Use for development onboarding and first-run flows.
- After register, call `POST /api/auth/login` because register returns the user but not tokens.
- Role control must map `Analyst` to `finance_analyst`, `Manager` to `finance_manager`, and `CFO` to `cfo`. Admin registration is not self-service unless the backend contract changes.

### `POST /api/auth/login`

Purpose: authenticate and receive bearer tokens.

Request:

```json
{
  "email": "analyst@example.com",
  "password": "password123"
}
```

Response:

```json
{
  "access_token": "jwt-access-token",
  "refresh_token": "jwt-refresh-token",
  "token_type": "bearer"
}
```

Frontend handling:
- Persist both tokens in local storage for this phase.
- Send `Authorization: Bearer <access_token>` on every protected API request.

### `POST /api/auth/refresh`

Purpose: refresh expired access tokens.

Request:

```json
{
  "refresh_token": "jwt-refresh-token"
}
```

Response shape is the same as login.

Frontend handling:
- On an HTTP 401 from a protected route, call refresh once and retry the original request once.
- If refresh fails, clear local tokens and redirect to the login screen.

### `GET /api/auth/me`

Purpose: hydrate current user and role.

Response:

```json
{
  "id": "user-id",
  "email": "analyst@example.com",
  "name": "Ayesha Analyst",
  "role": "finance_analyst"
}
```

Frontend handling:
- This is the source of truth for the role shown in the sidebar.
- Use it for role-based navigation and route guards.

## Health And Source Registry

### `GET /api/health`

Response:

```json
{
  "status": "ok",
  "service": "sheet-sherlock-backend"
}
```

Frontend handling:
- Optional diagnostics only. Do not block the app on this route unless a setup screen is added.

### `GET /api/source-registry`

Response:

```json
{
  "sources": [
    {
      "id": "psx",
      "name": "PSX",
      "group": "filings"
    }
  ]
}
```

Frontend handling:
- Replace static source lists in `src/routes/ingestion.tsx` and `src/routes/sources.tsx`.
- Treat extra fields as display metadata and keep unknown fields in the row model.

## Analysis Request APIs

### `POST /api/analysis-requests`

Purpose: manager creates work for an analyst.

Request:

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

Response:

```json
{
  "id": "request-id",
  "requesterUserId": "manager-user-id",
  "assignedAnalystEmail": "analyst@example.com",
  "assignedAnalystUserId": null,
  "companyName": "Millat Tractors Limited",
  "companySymbol": "MTL",
  "sector": "Engineering & Industrials",
  "fiscalYear": "FY2025",
  "template": "Millat - Template.xlsx",
  "priority": "normal",
  "dueDate": "2026-06-07",
  "note": "Run the FY2025 cycle and prepare manager review pack.",
  "status": "pending",
  "projectId": null,
  "emailStatus": "not_sent",
  "emailResult": {},
  "auditEvents": [],
  "createdAt": "2026-06-01T00:00:00Z",
  "acknowledgedAt": null,
  "convertedAt": null
}
```

Frontend handling:
- Manager dashboard must include a Manager Request form that posts to this endpoint.
- The old "Requests" tab is now named "Inbox"; do not add a separate analyst Requests tab.
- Analyst Inbox reads these requests and shows `pending`, `acknowledged`, and `converted` states.

### `GET /api/analysis-requests`

Purpose: list visible requests for current user.

Frontend handling:
- Manager sees all requests.
- Analyst sees assigned requests by user id or email.
- Replace `SEED` in `src/routes/inbox.tsx`.

### `GET /api/analysis-requests/{request_id}`

Purpose: request detail.

Frontend handling:
- Use if adding a detail drawer; list response is enough for the first pass.

### `POST /api/analysis-requests/{request_id}/acknowledge`

Purpose: analyst accepts assignment.

Frontend handling:
- Replace local `Accept & start cycle` state mutation.
- After success, call convert-to-project if the user chooses to begin immediately.

### `POST /api/analysis-requests/{request_id}/convert-to-project`

Purpose: create an owned project from an assigned request.

Frontend handling:
- Store returned `projectId`.
- Navigate to `/registry` or `/ingestion` with selected project context.

## Project APIs

### `GET /api/projects`

Purpose: list projects owned by current user.

Frontend handling:
- Replace dashboard local selection recents and model registry static list for analyst-owned projects.
- Manager access must be verified during implementation because project APIs currently use ownership checks in several paths.

### `POST /api/projects`

Purpose: direct project creation.

Request:

```json
{
  "companyName": "Millat Tractors Limited",
  "projectLabel": "FY2025 Annual Report Analysis",
  "sector": "Engineering & Industrials",
  "fiscalYear": "FY2025",
  "currencyUnit": "Rs in Thousands",
  "template": "Millat - Template.xlsx",
  "teamMembers": [
    {
      "name": "Omar Manager",
      "email": "manager@example.com",
      "initials": "OM",
      "role": "Manager",
      "canRemove": false
    }
  ]
}
```

Frontend handling:
- Use direct creation only when an analyst starts without a manager request.
- Keep template fixed to `Millat - Template.xlsx`; backend rejects other templates.

### `GET /api/projects/{project_id}`

Purpose: read project metadata and uploaded document summary.

### `GET /api/projects/{project_id}/workspace`

Purpose: main aggregate payload for the frontend.

Response top-level shape:

```json
{
  "project": {},
  "documents": [],
  "review": {},
  "auditEvents": [],
  "exportPreview": {},
  "dashboard": {},
  "ingestionPreviewSummary": null,
  "threeStatementCheck": null,
  "balanceSheetDiagnosis": null
}
```

Frontend handling:
- This is the primary read model after project selection.
- Replace static data in dashboard, registry, diff review, diagnosis, assumptions, review, sign-off, and audit screens from this payload where possible.

## Document, Extraction, And Progress APIs

### `POST /api/projects/{project_id}/documents`

Purpose: upload PDF annual report.

Request:
- Multipart form field: `file`
- Supported content: PDF file.

Frontend handling:
- Replace local file-only state in `src/routes/ingestion.tsx`.
- Show backend error detail for rejected file types.

### `GET /api/projects/{project_id}/documents/{document_id}/pages/{pdf_page_index}/image`

Purpose: render source PDF page as PNG.

Frontend handling:
- Replace synthetic source preview where document/page evidence is available.
- `pdf_page_index` is zero-based.

### `POST /api/projects/{project_id}/extractions?force=false`

Purpose: start extraction.

Response:

```json
{
  "id": "job-id",
  "projectId": "project-id",
  "status": "queued",
  "percent": 0,
  "message": "Extraction queued.",
  "error": null,
  "createdAt": "2026-06-01T00:00:00Z",
  "updatedAt": "2026-06-01T00:00:00Z"
}
```

Frontend handling:
- Use `force=true` only for explicit rerun controls.
- Poll job detail and subscribe to websocket progress.

### `GET /api/projects/{project_id}/extractions/{job_id}`

Purpose: poll extraction status and error detail.

Frontend handling:
- Surface `error` exactly in the UI when status is failed.

### `WS /api/ws/projects/{project_id}/progress`

Purpose: project progress stream.

Frontend handling:
- Use for ingestion feed and progress cards.
- Backend accepts the websocket without auth today, so do not include token-specific logic unless backend changes.

## Mapping Rules APIs

### `GET /api/projects/{project_id}/mapping-rules`

Purpose: read mapping-rule summary and acknowledgement state.

### `POST /api/projects/{project_id}/mapping-rules/acknowledge`

Request:

```json
{
  "rulesHash": "64-character-hash",
  "rulesCount": 40,
  "acknowledged": true
}
```

Frontend handling:
- Add acknowledgement gate before extraction if `acknowledged` is false.

Admin-only endpoints:
- `PATCH /api/projects/{project_id}/mapping-rules/{rule_code}`
- `GET /api/projects/{project_id}/mapping-rules/admin`

Frontend handling:
- Expose these only in Admin UI.

## Review, Comments, And Diagnosis APIs

### Comments

Endpoints:
- `POST /api/projects/{project_id}/comments`
- `GET /api/projects/{project_id}/comments?include_deleted=false`
- `PATCH /api/projects/{project_id}/comments/{comment_id}`
- `POST /api/projects/{project_id}/comments/{comment_id}/resolve`
- `POST /api/projects/{project_id}/comments/{comment_id}/reopen`
- `DELETE /api/projects/{project_id}/comments/{comment_id}`

Create/update request:

```json
{
  "body": "Please confirm this source tie-out.",
  "fieldId": "field-id",
  "templateCell": null,
  "sheetName": null
}
```

Frontend handling:
- Exactly one of `fieldId`, `templateCell`, or `sheetName` should be set.
- Use in diagnosis side panel and manager review comments.

### Review cells

Endpoints:
- `PATCH /api/projects/{project_id}/review-cells/{field_id}`
- `POST /api/projects/{project_id}/review-cells/{field_id}/revert`

Update request:

```json
{
  "action": "edit",
  "value": "54800000",
  "note": "Confirmed against annual report page 42."
}
```

Allowed actions:
- `accept`
- `edit`
- `flag`
- `clear_exception`
- `reopen_exception`
- `save_exception_note`

Revert request:

```json
{
  "revisionId": "revision-id"
}
```

Frontend handling:
- Replace local `resolved`, `overrides`, and `corrected` maps in diff review and diagnosis.

### Balance sheet diagnosis

Endpoints:
- `POST /api/projects/{project_id}/diagnosis/balance-sheet/run`
- `GET /api/projects/{project_id}/diagnosis/balance-sheet/latest`
- `POST /api/projects/{project_id}/diagnosis/balance-sheet/{candidate_id}/accept`
- `POST /api/projects/{project_id}/diagnosis/balance-sheet/{candidate_id}/apply`
- `POST /api/projects/{project_id}/diagnosis/balance-sheet/{candidate_id}/decision`

Decision request:

```json
{
  "action": "override",
  "reasonCode": "human_override",
  "classification": "unknown",
  "note": "Analyst confirmed alternate correction.",
  "manualValue": "1840",
  "journalEntry": null
}
```

Frontend handling:
- Replace hardcoded diagnosis issues and local correction state.
- Before submit to manager review, the backend requires a latest diagnosis decision.

## Source Search, Ask AI, Forecast, And Assumptions APIs

### `GET /api/projects/{project_id}/ingestion/preview?run_id=...`

Purpose: source ingestion preview.

Frontend handling:
- Use for source cards, manifest rows, freshness, and confidence display.

### `POST /api/projects/{project_id}/search`

Request:

```json
{
  "query": "MTL tractor unit sales FY2025",
  "sourceIds": ["psx", "sbp"],
  "sourceGroup": "forecast"
}
```

Frontend handling:
- Use for source search panels and citation exploration.

### `POST /api/projects/{project_id}/ask-ai`

Purpose: streaming project Ask AI response.

Request:

```json
{
  "question": "Why did revenue increase in FY2025?",
  "sessionId": "browser-session-id",
  "sourceIds": [],
  "sourceGroup": null,
  "includeExternalSources": false,
  "routePath": "/diagnosis",
  "screenName": "Diagnosis",
  "documentIds": [],
  "filters": {}
}
```

Response:
- Server-sent event stream with `text/event-stream`.

Frontend handling:
- Replace static Ask AI behavior.
- Always include current route and screen name.
- Include selected document ids or source ids when the user is looking at a document-backed cell.

### `POST /api/projects/{project_id}/forecast/run`

Request:

```json
{
  "query": "Build base, bull, and bear revenue scenarios.",
  "sourceIds": [],
  "sourceGroup": "forecast",
  "projectionYears": 5
}
```

Frontend handling:
- Replace `BASE_SCENARIOS` in `src/routes/forecast.tsx`.
- Keep what-if sliders as frontend-only overlays unless a future backend recalculation endpoint is added.

### `POST /api/projects/{project_id}/assumptions/generate`

Request:

```json
{
  "includeForecastDrivers": true,
  "forecast": {}
}
```

Frontend handling:
- Replace static assumptions rows.
- Pass latest forecast response when available.

## Brief, Archive, And Review Handoff APIs

### Executive briefs

Endpoints:
- `POST /api/projects/{project_id}/briefs/generate`
- `GET /api/projects/{project_id}/briefs/latest`
- `GET /api/projects/{project_id}/briefs/{brief_id}`

Frontend handling:
- Manager approval should call manager decision first; backend generates a brief automatically when approving if none exists.
- CFO Sign-Off is visible to CFO users and should read latest brief for the executive summary.

### Archive

Endpoints:
- `GET /api/projects/{project_id}/archive/latest`
- `GET /api/projects/{project_id}/archive/{archive_id}/audit.json`

Frontend handling:
- Replace local audit JSON export with the backend audit JSON download after project approval.
- Backend marks `pdfAvailable: false`; signed PDF export remains frontend-local or future backend work.

### Review handoff

Endpoints:
- `POST /api/projects/{project_id}/review/submit`
- `POST /api/projects/{project_id}/review/manager-decision`
- `POST /api/projects/{project_id}/review/cfo-signoff`

Submit request:

```json
{
  "note": "Ready for manager review."
}
```

Manager decision request:

```json
{
  "action": "approve",
  "note": "Approved for executive sign-off."
}
```

Frontend handling:
- Analyst uses submit.
- Manager uses manager-decision with `approve` or `send_back`.
- CFO uses cfo-signoff with `approved` true or false. Manager and Analyst should not see this route in the sidebar.

## Route-To-API Mapping

| Frontend route | Primary APIs |
| --- | --- |
| `/` | `GET /api/auth/me`, `GET /api/projects`, `GET /api/projects/{project_id}/workspace`, manager: `GET/POST /api/analysis-requests` |
| `/inbox` | `GET /api/analysis-requests`, `POST /api/analysis-requests/{id}/acknowledge`, `POST /api/analysis-requests/{id}/convert-to-project` |
| `/registry` | `GET /api/projects`, `GET /api/projects/{id}/workspace`, optional `POST /api/projects` |
| `/ingestion` | `GET /api/source-registry`, `GET/POST mapping-rules`, `POST documents`, `POST extractions`, `GET extraction job`, websocket progress |
| `/diff-review` | `GET workspace`, `PATCH review-cells`, `POST review-cells revert`, source page image |
| `/diagnosis` | `GET workspace`, diagnosis run/latest/decision, comments, review-cells |
| `/forecast` | `POST forecast/run`, `POST search`, `GET workspace` |
| `/assumptions` | `POST assumptions/generate`, `POST review/submit`, `GET workspace` |
| `/review` | manager: `GET workspace`, comments, `POST review/manager-decision`, `POST briefs/generate`, `GET briefs/latest` |
| `/sign-off` | cfo: `GET briefs/latest`, `POST review/cfo-signoff`, `GET archive/latest` |
| `/audit` | `GET workspace`, `GET archive/latest`, `GET archive/{id}/audit.json` |
| `/sources` | admin: `GET /api/source-registry`, admin mapping-rule controls where project context exists |
