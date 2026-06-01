# API Integration Completion And Diff Review Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining frontend/backend API-integration gaps and remove the Diff Review product surface from the frontend and backend-facing integration plan.

**Architecture:** Keep the current API client, auth, role guard, and React Query patterns. Move any remaining analyst review actions into Diagnosis/Assumptions where needed, remove `/diff-review` navigation and route surfaces, and only remove backend review-cell routes after confirming they are not required by the revised analyst workflow.

**Tech Stack:** React 19, TanStack Router, TanStack Query, TypeScript, Vite/Bun, FastAPI backend, JWT auth, WebSocket/SSE-style streams.

---

## Requirement Change: Remove Diff Review

- Remove `Diff Review` from `src/components/Sidebar.tsx`.
- Remove the frontend `/diff-review` route and generated route tree entries.
- Remove references from `src/lib/role-access.ts`, `src/lib/cycle-store.ts`, `src/routes/ingestion.tsx`, and `src/components/AskAiTrigger.tsx`.
- Update docs under `docs/implementation/api-integration/` so Diff Review is no longer listed as an analyst menu, route, or remaining implementation task.
- Backend removal must be confirmed before deleting public `review-cells` endpoints because manager submission currently depends on review-cell status resolution.

## Blocking Questions Before Implementation

1. Should backend public review-cell endpoints be deleted entirely?
   - Endpoints involved:
     - `PATCH /api/projects/{project_id}/review-cells/{field_id}`
     - `POST /api/projects/{project_id}/review-cells/{field_id}/revert`
   - Risk: `submit_for_manager_review` currently checks unresolved review cells. If these endpoints are removed without a replacement, analysts may have no way to resolve pending or flagged cells.
   - Recommended answer: keep backend review-cell internals and endpoints for now, but remove the Diff Review route/UI and stop linking to it. Then move required cell actions into Diagnosis/Assumptions in a later backend-safe pass.

2. What should happen if a user opens `/diff-review` directly after the route is removed?
   - Recommended answer: route should not exist; TanStack Router should show the app's existing 404.
   - Alternative: add a temporary redirect from `/diff-review` to `/diagnosis`.

3. For passing forecast into assumptions, should the frontend store the latest forecast response in localStorage per project?
   - Backend appears to expose `POST /forecast/run` but no `GET latest forecast` endpoint.
   - Recommended answer: store latest forecast response in frontend localStorage per project until backend provides a read endpoint.

4. For `/sources` admin mapping-rule controls, should Admin toggle rules only for the currently selected project?
   - Recommended answer: show read-only source registry without a selected project, and show mapping-rule toggles only when `sheet_sherlock_selected_project_id` is set.

5. `AskAiPanel.tsx` appears unused while `AskAiTrigger.tsx` is active. Should it be backend-wired anyway?
   - Recommended answer: keep `AskAiPanel.tsx` presentational unless a route imports it; complete backend streaming in `AskAiTrigger.tsx`.

## Task 1: Update Planning Docs For Diff Review Removal

**Files:**

- Modify: `docs/implementation/api-integration/00-backend-api-inventory.md`
- Modify: `docs/implementation/api-integration/01-frontend-api-integration-plan.md`
- Modify: `docs/implementation/api-integration/02-role-based-frontend-plan.md`
- Modify: `docs/implementation/api-integration/03-open-questions.md`

- [x] **Step 1: Remove Diff Review from frontend route/menu matrices**

Update the docs so the analyst menu list no longer includes `Diff Review`, the route matrix no longer lists `/diff-review`, and the old task to wire Diff Review is replaced with a removal task.

- [x] **Step 2: Record backend review-cell endpoint decision**

If the answer is to keep backend review-cell endpoints, document them as internal/reused backend workflow endpoints rather than a Diff Review screen API. If the answer is to delete them, document the replacement action path first.

## Task 2: Remove Diff Review Frontend Surface

**Files:**

- Modify: `src/components/Sidebar.tsx`
- Modify: `src/lib/role-access.ts`
- Modify: `src/lib/cycle-store.ts`
- Modify: `src/routes/ingestion.tsx`
- Modify: `src/components/AskAiTrigger.tsx`
- Delete: `src/routes/diff-review.tsx`
- Regenerate: `src/routeTree.gen.ts`

- [x] **Step 1: Remove Sidebar nav item**

Delete the `Diff Review` nav item and unused `GitCompare` icon import from `src/components/Sidebar.tsx`.

- [x] **Step 2: Remove route access**

Delete `"/diff-review": ["finance_analyst"]` from `src/lib/role-access.ts`.

- [x] **Step 3: Remove cycle step**

Remove the `diff-review` cycle status and `/diff-review` progress step from `src/lib/cycle-store.ts`. Send users from ingestion to diagnosis.

- [x] **Step 4: Remove route links**

Change `src/routes/ingestion.tsx` to navigate to `/diagnosis` after extraction. Change `src/components/AskAiTrigger.tsx` to send parsed PDFs or source-follow-up actions to `/diagnosis` or `/ingestion`, not `/diff-review`.

- [x] **Step 5: Delete route file and regenerate route tree**

Delete `src/routes/diff-review.tsx`, then run `bun run build` or the router generator so `src/routeTree.gen.ts` no longer registers `/diff-review`.

## Task 3: Complete Comment APIs And UI Controls

**Files:**

- Modify: `src/lib/api/types.ts`
- Modify: `src/lib/api/projects.ts`
- Modify: `src/hooks/use-project-actions.ts`
- Modify: `src/routes/review.tsx`
- Modify: `src/routes/diagnosis.tsx`

- [x] **Step 1: Add comment response/input types**

Add `ReviewCommentResponse` and `ReviewCommentInput` types matching backend fields: `id`, `body`, `status`, `fieldId`, `templateCell`, `sheetName`, `mentions`, `createdAt`, `updatedAt`, `resolvedAt`, and `resolvedBy`.

- [x] **Step 2: Add project API wrappers**

Add wrappers for:

- `PATCH /api/projects/{project_id}/comments/{comment_id}`
- `POST /api/projects/{project_id}/comments/{comment_id}/reopen`
- `DELETE /api/projects/{project_id}/comments/{comment_id}`

- [x] **Step 3: Add hooks**

Add `useUpdateComment`, `useReopenComment`, and `useDeleteComment`, invalidating `queryKeys.comments(projectId)` and `queryKeys.workspace(projectId)` on success.

- [x] **Step 4: Wire manager review comments**

In `src/routes/review.tsx`, add edit, resolve/reopen, and delete controls beside each comment. Keep create comment behavior.

- [x] **Step 5: Add diagnosis comments panel**

In `src/routes/diagnosis.tsx`, list comments, create a comment, and allow resolve/reopen for diagnosis discussion.

## Task 4: Complete Admin Mapping-Rule Controls

**Files:**

- Modify: `src/routes/sources.tsx`
- Modify: `src/lib/api/types.ts`

- [x] **Step 1: Render selected project mapping controls**

When a selected project exists, load `queryKeys.adminMappingRules(projectId)` using `readAdminMappingRules(projectId)`.

- [x] **Step 2: Add toggle controls**

Render rule rows with rule code/name/category/criticality and a toggle button that calls `useToggleMappingRule(projectId)`.

- [x] **Step 3: Keep no-project state read-only**

When no selected project exists, show a compact notice: source registry is visible, mapping-rule controls require selecting a project.

## Task 5: Complete Diagnosis Reason Handling

**Files:**

- Modify: `src/routes/diagnosis.tsx`

- [x] **Step 1: Replace fixed reject payload**

Add a selected reason-code control per diagnosis candidate. Use the selected value in the `decideDiagnosis` mutation payload.

- [x] **Step 2: Preserve accept/decision API behavior**

Keep `acceptBalanceSheetDiagnosis` for accept and `decideBalanceSheetDiagnosis` for reject/override decisions.

## Task 6: Pass Forecast Into Assumptions

**Files:**

- Create: `src/lib/forecast-store.ts`
- Modify: `src/routes/forecast.tsx`
- Modify: `src/routes/assumptions.tsx`

- [x] **Step 1: Add per-project forecast store**

Create a localStorage-backed forecast store keyed by project id.

- [x] **Step 2: Save forecast response**

After `POST /forecast/run` succeeds, store the response for the selected project.

- [x] **Step 3: Use forecast in assumptions**

When generating assumptions, pass the stored forecast response instead of `forecast: null`. Show whether forecast context was included.

## Task 7: Render Structured Blocking Details

**Files:**

- Create: `src/components/ApiErrorDetails.tsx`
- Modify: `src/routes/assumptions.tsx`
- Modify: `src/routes/review.tsx`
- Modify: `src/routes/sign-off.tsx`

- [x] **Step 1: Add reusable API error detail renderer**

Render backend detail strings directly. If detail is an object with `message`, show `message` and an expandable JSON details panel.

- [x] **Step 2: Render three-statement blocking checks**

If detail contains `threeStatementCheck`, render blocking rows/checklist before the generic JSON panel.

- [x] **Step 3: Use in handoff routes**

Use the component for assumptions submit, manager decision, and CFO sign-off errors.

## Task 8: Manager Brief Status After Approval

**Files:**

- Modify: `src/routes/review.tsx`

- [x] **Step 1: Read latest brief**

Add `useQuery` for `readLatestExecutiveBrief(projectId)` on the manager review screen.

- [x] **Step 2: Refresh after approval**

After approve succeeds, invalidate/read latest brief and show brief status, id, generated time, or backend error.

## Task 9: Complete Ask AI Active Surface

**Files:**

- Modify: `src/hooks/use-ask-ai-stream.ts`
- Modify: `src/components/AskAiTrigger.tsx`
- Optionally Modify: `src/components/AskAiPanel.tsx`

- [x] **Step 1: Stream visible chunks**

Expose an `onChunk` callback from `useAskAiStream` so `AskAiTrigger` updates the active AI bubble while chunks arrive.

- [x] **Step 2: Disable until project selected**

Keep the trigger visible but disabled/clear about selecting a project before asking. Do not send backend requests without a project id.

- [x] **Step 3: Remove Diff Review links**

Any Ask AI action that pointed to `/diff-review` should point to `/diagnosis` or `/ingestion`.

## Task 10: Backend Diff Review Removal Decision

**Files:**

- Possible Modify: `backend_code/backend/app/api/routes/projects.py`
- Possible Modify: `backend_code/backend/app/schemas/projects.py`
- Possible Modify: `backend_code/backend/tests/integration/test_project_api.py`
- Possible Modify: backend implementation docs mentioning Diff Review.

- [x] **Step 1: If public review-cell endpoints are retained**

Leave backend code untouched, but update docs/tests wording so these endpoints are not described as the Diff Review backend. They become generic review-cell workflow endpoints.

- [x] **Step 2: Not applicable by request**

Backend review-cell endpoints were explicitly retained. No backend route, service, or test removal is part of this implementation.

## Verification

- [x] `npx tsc --noEmit --pretty false`
- [x] `bun run test`
- [x] targeted `npx eslint` on changed frontend files
- [x] `bun run build`
- [x] If backend code changes: run backend tests covering changed routes. No backend code changed; endpoints retained by request.
- [x] Confirm `rg "diff-review|Diff Review" sheet-sherlock-detective/src` returns no active frontend source references.
- [x] Confirm `src/components/Sidebar.tsx` no longer renders Diff Review.
- [x] Confirm `/ingestion` next action routes to `/diagnosis`.
