# Role-Based Frontend And Sidebar Plan

Generated: 2026-06-01

## Decision

The frontend exposes four backend roles:

- Analyst
- Manager
- CFO
- Admin

Backend values:

- Analyst maps to `finance_analyst`
- Manager maps to `finance_manager`
- CFO maps to `cfo`
- Admin maps to `admin`

The frontend must use `GET /api/auth/me` as the source of truth for the logged-in user's role. `src/components/Sidebar.tsx` must render only the menu items relevant to that role, and route guards must enforce the same access model so hidden menus are not the only protection.

## Role Entry Points

### Analyst

Default route after login: `/inbox`

Primary jobs:

- See assigned analysis requests in the Inbox. The old "Requests" tab is now named "Inbox".
- Acknowledge manager-generated requests.
- Convert acknowledged requests to projects.
- Upload annual report PDFs.
- Run extraction.
- Resolve review-cell blockers through diagnosis/workflow screens.
- Run balance-sheet diagnosis.
- Generate forecast and assumptions.
- Submit the project for manager review.

Visible Sidebar menus:

- Dashboard
- Inbox
- Model Registry
- Ingestion
- Diagnosis
- Forecast
- Assumptions
- Notifications
- Audit Trail

### Manager

Default route after login: `/`

Primary jobs:

- Create analysis requests for analysts from a Manager Request form.
- See all analysis requests returned by `GET /api/analysis-requests`.
- Track request status: `pending`, `acknowledged`, `converted`.
- Review submitted project packs.
- Approve or send back with `POST /api/projects/{project_id}/review/manager-decision`.

Visible Sidebar menus:

- Dashboard
- Model Registry
- Manager Review
- Notifications
- Audit Trail

### CFO

Default route after login: `/sign-off`

Primary jobs:

- Review generated executive briefs.
- Approve or reject CFO sign-off with `POST /api/projects/{project_id}/review/cfo-signoff`.
- Read archive and audit outputs for approved models.

Visible Sidebar menus:

- Dashboard
- Model Registry
- CFO Sign-Off
- Audit Trail
- Notifications

### Admin

Default route after login: `/sources`

Primary jobs:

- Read source registry.
- Access admin mapping-rule controls.
- Monitor project/request state where backend access allows it.
- Keep operational/admin views separate from analyst workbench actions.

Visible Sidebar menus:

- Dashboard
- Model Registry
- Sources Admin
- Audit Trail
- Notifications

Admin-only API surfaces:

- `GET /api/projects/{project_id}/mapping-rules/admin`
- `PATCH /api/projects/{project_id}/mapping-rules/{rule_code}`

## Auth Screen Requirements

The `/login` screen should support:

- Existing user login.
- Development registration.
- A segmented role selector with `Analyst`, `Manager`, and `CFO` for self-service registration.

Backend `UserCreate` currently accepts `finance_analyst`, `finance_manager`, and `cfo`. It does not accept `admin` through self-service registration. Admin users should be seeded or created by backend/admin tooling unless the backend contract changes.

Register request mapping:

```ts
const rolePayloadByFrontendRole = {
  analyst: "finance_analyst",
  manager: "finance_manager",
  cfo: "cfo",
} as const;
```

After login:

1. Store tokens returned by `POST /api/auth/login`.
2. Call `GET /api/auth/me`.
3. Route user:
   - `finance_analyst` to `/inbox`
   - `finance_manager` to `/`
   - `cfo` to `/sign-off`
   - `admin` to `/sources`

## Sidebar Menu Matrix

`src/components/Sidebar.tsx` should derive visible nav items from the logged-in user's backend role. Do not hardcode one static `nav` list directly into JSX. Use a role-aware nav definition and filter it before rendering.

| Sidebar menu   | Route            | Analyst | Manager | CFO | Admin |
| -------------- | ---------------- | ------- | ------- | --- | ----- |
| Dashboard      | `/`              | Yes     | Yes     | Yes | Yes   |
| Inbox          | `/inbox`         | Yes     | No      | No  | No    |
| Model Registry | `/registry`      | Yes     | Yes     | Yes | Yes   |
| Ingestion      | `/ingestion`     | Yes     | No      | No  | No    |
| Diagnosis      | `/diagnosis`     | Yes     | No      | No  | No    |
| Forecast       | `/forecast`      | Yes     | No      | No  | No    |
| Assumptions    | `/assumptions`   | Yes     | No      | No  | No    |
| Manager Review | `/review`        | No      | Yes     | No  | No    |
| CFO Sign-Off   | `/sign-off`      | No      | No      | Yes | No    |
| Protection     | `/protection`    | No      | No      | No  | Yes   |
| Notifications  | `/notifications` | Yes     | Yes     | Yes | Yes   |
| Audit Trail    | `/audit`         | Yes     | Yes     | Yes | Yes   |
| Sources Admin  | `/sources`       | No      | No      | No  | Yes   |

Implementation sketch for `src/lib/role-access.ts`:

```ts
export type BackendRole = "finance_analyst" | "finance_manager" | "cfo" | "admin";
export type FrontendRole = "analyst" | "manager" | "cfo" | "admin";

export function frontendRole(role: BackendRole): FrontendRole {
  if (role === "finance_manager") return "manager";
  if (role === "finance_analyst") return "analyst";
  return role;
}

export function roleLabel(role: BackendRole): string {
  if (role === "finance_analyst") return "Analyst";
  if (role === "finance_manager") return "Manager";
  if (role === "cfo") return "CFO";
  return "Admin";
}

export function defaultRouteForRole(role: BackendRole): string {
  if (role === "finance_analyst") return "/inbox";
  if (role === "finance_manager") return "/";
  if (role === "cfo") return "/sign-off";
  return "/sources";
}

const routeRoles: Record<string, BackendRole[]> = {
  "/": ["finance_analyst", "finance_manager", "cfo", "admin"],
  "/inbox": ["finance_analyst"],
  "/registry": ["finance_analyst", "finance_manager", "cfo", "admin"],
  "/ingestion": ["finance_analyst"],
  "/diagnosis": ["finance_analyst"],
  "/forecast": ["finance_analyst"],
  "/assumptions": ["finance_analyst"],
  "/review": ["finance_manager"],
  "/sign-off": ["cfo"],
  "/protection": ["admin"],
  "/notifications": ["finance_analyst", "finance_manager", "cfo", "admin"],
  "/audit": ["finance_analyst", "finance_manager", "cfo", "admin"],
  "/sources": ["admin"],
};

export function canSeeRoute(role: BackendRole, pathname: string): boolean {
  if (pathname === "/login") return true;
  return routeRoles[pathname]?.includes(role) ?? false;
}
```

Implementation sketch for `src/components/Sidebar.tsx`:

```ts
const nav = [
  {
    to: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["finance_analyst", "finance_manager", "cfo", "admin"],
  },
  { to: "/inbox", label: "Inbox", icon: Inbox, roles: ["finance_analyst"] },
  {
    to: "/registry",
    label: "Model Registry",
    icon: GitBranch,
    roles: ["finance_analyst", "finance_manager", "cfo", "admin"],
  },
  { to: "/ingestion", label: "Ingestion", icon: Download, roles: ["finance_analyst"] },
  { to: "/diagnosis", label: "Diagnosis", icon: Stethoscope, roles: ["finance_analyst"] },
  { to: "/forecast", label: "Forecast", icon: TrendingUp, roles: ["finance_analyst"] },
  { to: "/assumptions", label: "Assumptions", icon: FileText, roles: ["finance_analyst"] },
  { to: "/review", label: "Manager Review", icon: ClipboardCheck, roles: ["finance_manager"] },
  { to: "/sign-off", label: "CFO Sign-Off", icon: Lock, roles: ["cfo"] },
  { to: "/protection", label: "Protection", icon: ShieldCheck, roles: ["admin"] },
  {
    to: "/notifications",
    label: "Notifications",
    icon: Bell,
    roles: ["finance_analyst", "finance_manager", "cfo", "admin"],
  },
  {
    to: "/audit",
    label: "Audit Trail",
    icon: ShieldCheck,
    roles: ["finance_analyst", "finance_manager", "cfo", "admin"],
  },
  { to: "/sources", label: "Sources Admin", icon: KeyRound, roles: ["admin"] },
] as const;

const visibleNav = nav.filter((item) => item.roles.includes(currentUser.role));
```

## Route Access Matrix

| Route            | Analyst | Manager | CFO | Admin | Backend source                                                        |
| ---------------- | ------- | ------- | --- | ----- | --------------------------------------------------------------------- |
| `/login`         | Yes     | Yes     | Yes | Yes   | Auth APIs                                                             |
| `/`              | Yes     | Yes     | Yes | Yes   | Dashboard summaries by role                                           |
| `/inbox`         | Yes     | No      | No  | No    | Analyst Inbox backed by `GET /api/analysis-requests`                  |
| `/registry`      | Yes     | Yes     | Yes | Yes   | `GET /api/projects`                                                   |
| `/ingestion`     | Yes     | No      | No  | No    | source registry, mapping rules, documents, extraction                 |
| `/diagnosis`     | Yes     | No      | No  | No    | workspace, diagnosis, comments                                        |
| `/forecast`      | Yes     | No      | No  | No    | forecast/run, search                                                  |
| `/assumptions`   | Yes     | No      | No  | No    | assumptions/generate, review/submit                                   |
| `/review`        | No      | Yes     | No  | No    | review/manager-decision, briefs                                       |
| `/sign-off`      | No      | No      | Yes | No    | review/cfo-signoff, briefs, archive                                   |
| `/protection`    | No      | No      | No  | Yes   | admin-only controls or placeholder until backend support is confirmed |
| `/notifications` | Yes     | Yes     | Yes | Yes   | local or future backend notifications                                 |
| `/audit`         | Yes     | Yes     | Yes | Yes   | workspace audit, archive                                              |
| `/sources`       | No      | No      | No  | Yes   | source registry and admin mapping-rule controls                       |

## Manager Workflow

1. Manager logs in.
2. Dashboard shows a `Request` or `New Request` form.
3. Dashboard also calls `GET /api/analysis-requests` to show request status.
4. Manager creates a request with:

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
  "note": "Prepare manager review pack."
}
```

5. Manager watches request status update through list refresh.
6. When a project is submitted for review, Manager opens `/review`.
7. Manager decision:

```json
{
  "action": "approve",
  "note": "Approved for executive sign-off."
}
```

or:

```json
{
  "action": "send_back",
  "note": "Please resolve the inventory comment and resubmit."
}
```

8. If backend returns 403 or 404 for a submitted project, the frontend must show a clear access-state message and record a backend follow-up because project APIs currently use ownership checks in key paths.

## Analyst Workflow

1. Analyst logs in.
2. `/inbox` calls `GET /api/analysis-requests`.
3. Inbox copy should say these are requests generated by the analyst's manager.
4. Analyst acknowledges request:

```http
POST /api/analysis-requests/{request_id}/acknowledge
```

5. Analyst converts request to project:

```http
POST /api/analysis-requests/{request_id}/convert-to-project
```

6. Frontend stores `projectId` in `sheet_sherlock_selected_project_id`.
7. Analyst uploads PDF:

```http
POST /api/projects/{project_id}/documents
```

8. Analyst acknowledges mapping rules if required.
9. Analyst starts extraction:

```http
POST /api/projects/{project_id}/extractions?force=false
```

10. Analyst reviews extraction result through workspace:

```http
GET /api/projects/{project_id}/workspace
```

11. Analyst resolves review cells with `PATCH /review-cells/{field_id}`.
12. Analyst runs or accepts diagnosis.
13. Analyst generates forecast and assumptions.
14. Analyst submits for manager review:

```json
{
  "note": "All blocking checks resolved. Ready for manager review."
}
```

## CFO Workflow

1. CFO logs in.
2. `/sign-off` loads latest submitted review/brief state.
3. CFO reads the executive brief from `GET /api/projects/{project_id}/briefs/latest`.
4. CFO approves or rejects with:

```json
{
  "approved": true,
  "note": "Approved.",
  "briefId": "brief-id"
}
```

5. CFO reviews archive and audit outputs after approval.

## Admin Workflow

1. Admin logs in.
2. `/sources` loads `GET /api/source-registry`.
3. Admin-only mapping rules use:

```http
GET /api/projects/{project_id}/mapping-rules/admin
PATCH /api/projects/{project_id}/mapping-rules/{rule_code}
```

4. If a route has no backend support yet, keep it read-only or add the decision to `03-open-questions.md`.

## Sidebar Identity

Sidebar identity should come from `GET /api/auth/me`.

Display:

- Name: `user.name`
- Role: `roleLabel(user.role)`
- Initials: derive from `user.name`, fallback to first two email characters.

Role-filtered nav must be computed at render time, not hardcoded by hiding with CSS. Hidden routes should also be guarded by route logic.

## Error Handling

Authentication:

- 401 on `GET /api/auth/me`: clear tokens and route to `/login`.
- 401 on protected request: refresh once; if refresh fails, clear tokens and route to `/login`.

Authorization:

- 403: show "You do not have access to this action with your current role."
- 404 on project/request: show "This item is not available to your account."

Validation:

- Show backend `detail` string exactly.
- If backend `detail` is an object with `message`, show `message` and attach the object to expandable details.

Workflow conflicts:

- 409 on submit for manager review should show blocking checklist from backend detail.
- 409 on manager decision should tell the manager the project is no longer awaiting manager review and refresh workspace.
- 409 on CFO sign-off should tell the CFO whether the project is not awaiting sign-off or the executive brief is not ready.

## Backend Verification Before Implementation

Before implementing role UI, run:

```bash
cd /home/tk-lpt-817/Desktop/mvp_sheet_sherlock/backend_code/backend
uv run python -m pytest -q
```

Then smoke-test the live role flow with seeded or newly registered users:

```bash
curl -s http://127.0.0.1:8000/api/health
```

Expected:

```json
{ "status": "ok", "service": "sheet-sherlock-backend" }
```

Manager registration payload:

```json
{
  "email": "manager@example.com",
  "name": "Omar Manager",
  "password": "password123",
  "role": "finance_manager"
}
```

Analyst registration payload:

```json
{
  "email": "analyst@example.com",
  "name": "Ayesha Analyst",
  "password": "password123",
  "role": "finance_analyst"
}
```

CFO registration payload:

```json
{ "email": "cfo@example.com", "name": "CFO User", "password": "password123", "role": "cfo" }
```

Admin user note:

```md
Admin is a backend role but is not accepted by the current self-service register schema. Use seeded/admin-created users for Admin login unless the backend contract changes.
```

The frontend implementation should continue even if these users already exist; login should be used when register returns duplicate email.
