# Frontend Backend API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete backend API integration for the replaced Sheet Sherlock frontend and expose Analyst, Manager, CFO, and Admin roles with role-filtered sidebar menus.

**Architecture:** Use `docs/implementation/api-integration/00-backend-api-inventory.md` as the backend contract, `docs/implementation/api-integration/01-frontend-api-integration-plan.md` as the execution plan, and `docs/implementation/api-integration/02-role-based-frontend-plan.md` as the role/access source of truth. Implementation should proceed frontend-first, with backend changes only if verification proves an access-model gap.

**Tech Stack:** React 19, TanStack Router, TanStack Query, TypeScript, Vite/Bun frontend, FastAPI backend, JWT bearer auth, SSE Ask AI, WebSocket extraction progress.

---

## Execution Order

- [ ] Read `docs/implementation/api-integration/00-backend-api-inventory.md`.
- [ ] Read `docs/implementation/api-integration/02-role-based-frontend-plan.md`.
- [ ] Read `docs/implementation/api-integration/03-open-questions.md`.
- [ ] Execute tasks in `docs/implementation/api-integration/01-frontend-api-integration-plan.md` in order.
- [ ] After each task, run the task's listed tests or `bun run build` when the task touches route/component wiring.
- [ ] Keep backend route names and request/response casing exactly as documented.
- [ ] Expose Analyst, Manager, CFO, and Admin role experiences according to `02-role-based-frontend-plan.md`.
- [ ] `src/components/Sidebar.tsx` must show only menus relevant to the logged-in user's role.
- [ ] Keep the analyst request queue named `Inbox`; do not reintroduce a separate `Requests` tab.
- [ ] Add the Manager `Request` form on the manager dashboard for creating analyst work requests.
- [ ] If a detail is unclear, add it to `docs/implementation/api-integration/03-open-questions.md` and ask the user before assuming.
- [ ] Preserve existing user changes, including the current modified `src/routeTree.gen.ts`.

## Verification Gate

- [ ] No blocking open questions remain in `docs/implementation/api-integration/03-open-questions.md`.
- [ ] `bun test` passes.
- [ ] `bun run build` passes.
- [ ] Analyst can log in, accept a request, convert it to a project, upload a PDF, start extraction, review cells, run diagnosis, generate assumptions, and submit for manager review.
- [ ] Analyst sees manager-generated requests in `/inbox`.
- [ ] Manager can log in, create a request from the dashboard Request form, see request status, and approve or send back a submitted review pack when backend access allows it.
- [ ] CFO can log in and only sees CFO-relevant menus, including CFO Sign-Off.
- [ ] Admin can log in and only sees admin-relevant menus, including Sources Admin.
- [ ] Backend error details are visible in the frontend for upload, extraction, review-submit, and manager-decision failures.
