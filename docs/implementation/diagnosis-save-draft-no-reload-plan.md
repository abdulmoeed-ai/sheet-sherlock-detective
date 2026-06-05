# Diagnosis Save Draft No-Reload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/diagnosis/$projectId` save workbook draft changes behind the scenes without remounting or visibly reloading the workbook when users press Enter in a cell or click `Save draft`.

**Architecture:** Keep the edited workbook snapshot mounted as local route state while save/version API calls run in the background. Replace immediate navigation to the newly-created project version with an in-place saved-version marker, and update only lightweight metadata/toasts so the grid does not reset, remount, or jump.

**Tech Stack:** React, TanStack Router, TanStack Query, Vitest/jsdom via `bun run test`, existing F(AI)nance project APIs.

---

## Root Cause

Current behavior reloads the workbook for two reasons in `sheet-sherlock-detective/src/routes/diagnosis.$projectId.tsx`:

1. `saveDraft()` calls `createProjectVersion(...)`, then immediately calls `navigate({ to: "/diagnosis/$projectId", params: { projectId: nextProject.id } })`. That changes the route param and remounts/refetches the route.
2. The effect `useEffect(() => { setDraftWorkbook(null); setPendingWorkbookEditCount(0); }, [projectId, serverWorkbook]);` clears the local workbook draft whenever `serverWorkbook` identity changes, which can discard the stable edited snapshot after background query updates.

The desired UX is not “no API calls”; it is “API calls happen behind the scenes while the visible workbook remains stable.”

## File Structure

- Modify: `sheet-sherlock-detective/src/routes/diagnosis.$projectId.tsx`
  - Keep workbook draft state mounted during save.
  - Remove navigation on save success.
  - Add lightweight saved-version state for user feedback.
  - Restrict draft reset to project changes, not every server workbook object change.
- Modify: `sheet-sherlock-detective/src/lib/diagnosis-draft.ts`
  - Add a small pure helper for save state labels if useful.
- Modify: `sheet-sherlock-detective/src/lib/diagnosis-draft.test.ts`
  - Add pure helper tests for “saving”, “saved”, and dirty-state behavior.
- Optional Test: `sheet-sherlock-detective/src/routes/diagnosis-save-draft.test.tsx`
  - Add route-level regression only if existing test harness makes TanStack Router mocking practical without broad setup.

## Task 1: Add No-Reload Draft State Tests

**Files:**
- Modify: `sheet-sherlock-detective/src/lib/diagnosis-draft.ts`
- Modify: `sheet-sherlock-detective/src/lib/diagnosis-draft.test.ts`

- [ ] **Step 1: Extend the helper contract**

Add this exported type and helper to `src/lib/diagnosis-draft.ts`:

```ts
export type DiagnosisDraftSaveState = {
  dirty: boolean;
  saving: boolean;
  savedVersionLabel?: string | null;
};

export function diagnosisDraftSaveLabel(state: DiagnosisDraftSaveState) {
  if (state.saving) return "Saving draft";
  if (state.dirty) return "Unsaved draft";
  if (state.savedVersionLabel) return `Saved ${state.savedVersionLabel}`;
  return "No draft changes";
}
```

- [ ] **Step 2: Write failing tests**

Add to `src/lib/diagnosis-draft.test.ts`:

```ts
import { diagnosisDraftSaveLabel } from "./diagnosis-draft";

it("describes background draft save state without implying a workbook reload", () => {
  expect(diagnosisDraftSaveLabel({ dirty: true, saving: false })).toBe("Unsaved draft");
  expect(diagnosisDraftSaveLabel({ dirty: true, saving: true })).toBe("Saving draft");
  expect(diagnosisDraftSaveLabel({ dirty: false, saving: false, savedVersionLabel: "Versioned Workbook Co_2025_v2" })).toBe(
    "Saved Versioned Workbook Co_2025_v2",
  );
});
```

- [ ] **Step 3: Run the focused test**

Run:

```bash
cd sheet-sherlock-detective
bun run test src/lib/diagnosis-draft.test.ts
```

Expected before implementation: FAIL because `diagnosisDraftSaveLabel` is missing.

- [ ] **Step 4: Implement the helper**

Add the helper exactly as shown in Step 1.

- [ ] **Step 5: Verify the helper test passes**

Run:

```bash
cd sheet-sherlock-detective
bun run test src/lib/diagnosis-draft.test.ts
```

Expected after implementation: PASS.

## Task 2: Keep Workbook Mounted While Cell Edits Are Staged

**Files:**
- Modify: `sheet-sherlock-detective/src/routes/diagnosis.$projectId.tsx`

- [ ] **Step 1: Replace server-workbook reset dependency**

Change this effect:

```ts
useEffect(() => {
  setDraftWorkbook(null);
  setPendingWorkbookEditCount(0);
}, [projectId, serverWorkbook]);
```

to this:

```ts
useEffect(() => {
  setDraftWorkbook(null);
  setPendingWorkbookEditCount(0);
  setSavedDraftVersion(null);
}, [projectId]);
```

This keeps the visible draft workbook mounted during background query updates and only resets when the user actually changes project route scope.

- [ ] **Step 2: Add saved-version local state**

Near the existing draft state:

```ts
const [draftWorkbook, setDraftWorkbook] = useState<WorkbookPayload | null>(null);
const [pendingWorkbookEditCount, setPendingWorkbookEditCount] = useState(0);
const [savingProjectVersion, setSavingProjectVersion] = useState(false);
const [savedDraftVersion, setSavedDraftVersion] = useState<{ id: string; label: string | null } | null>(null);
```

- [ ] **Step 3: Clear stale saved label when a new cell edit is staged**

In `commitWorkbookEdit`, after `setPendingWorkbookEditCount((count) => count + 1);`, add:

```ts
setSavedDraftVersion(null);
```

Keep the existing toast:

```ts
toast.success(`${event.sheetName}!${event.address} added to draft`);
```

This tells the user the value is updated locally without any workbook remount.

## Task 3: Save Project Version Behind The Scene Without Navigation

**Files:**
- Modify: `sheet-sherlock-detective/src/routes/diagnosis.$projectId.tsx`

- [ ] **Step 1: Remove route navigation from workbook draft save**

In `saveDraft()`, replace the workbook draft branch:

```ts
setDraftValue("");
setDraftWorkbook(null);
setPendingWorkbookEditCount(0);
setSelectedProjectId(nextProject.id);
cycleStore.startCycle({
  sector: nextProject.sector ?? cycle.sector,
  company: nextProject.companyName,
  period: nextProject.fiscalYear ?? cycle.period,
});
cycleStore.setStatus("diagnosis");
toast.success(`Draft saved as ${nextProject.projectLabel ?? "a new version"}`);
navigate({ to: "/diagnosis/$projectId", params: { projectId: nextProject.id } });
return;
```

with:

```ts
setDraftValue("");
setPendingWorkbookEditCount(0);
setSavedDraftVersion({ id: nextProject.id, label: nextProject.projectLabel ?? null });
toast.success(`Draft saved as ${nextProject.projectLabel ?? "a new version"}`);
return;
```

Do not call `setDraftWorkbook(null)` here. Keeping it mounted is the main UX fix.

- [ ] **Step 2: Keep project selection unchanged**

Do not call `setSelectedProjectId(nextProject.id)` after save. The registry can show the new version later, but the current diagnosis screen should remain stable.

- [ ] **Step 3: Preserve existing non-workbook draft behavior**

Leave the selected-cell `reviewCell.mutateAsync(...)` path unchanged for now, except do not introduce extra navigation or route-level refetch. If `workspace.refetch()` causes a visible workbook remount for text-panel saves, replace it with targeted optimistic state in a later task after verifying the workbook branch is fixed.

## Task 4: Add Visible Background Save Feedback

**Files:**
- Modify: `sheet-sherlock-detective/src/routes/diagnosis.$projectId.tsx`
- Modify: `sheet-sherlock-detective/src/lib/diagnosis-draft.ts`

- [ ] **Step 1: Import the label helper**

Update the route import:

```ts
import { diagnosisDraftSaveLabel, hasDiagnosisDraftChanges } from "@/lib/diagnosis-draft";
```

- [ ] **Step 2: Derive a compact status label**

Near `dirty`:

```ts
const draftSaveLabel = diagnosisDraftSaveLabel({
  dirty,
  saving: savingProjectVersion,
  savedVersionLabel: savedDraftVersion?.label,
});
```

- [ ] **Step 3: Render a quiet status text in the header**

In the header button group, add a small text span before `Save draft`:

```tsx
<span className="min-w-[96px] text-right text-[11px]" style={{ color: "#818EA0" }}>
  {draftSaveLabel}
</span>
```

This gives persistent feedback without introducing a modal, overlay, or workbook reload.

## Task 5: Verification

**Files:**
- Test: `sheet-sherlock-detective/src/lib/diagnosis-draft.test.ts`
- Test: `sheet-sherlock-detective/src/components/WorkbookEditor.test.tsx`
- Check: `sheet-sherlock-detective/src/routes/diagnosis.$projectId.tsx`

- [ ] **Step 1: Run helper and workbook tests**

Run:

```bash
cd sheet-sherlock-detective
bun run test src/lib/diagnosis-draft.test.ts src/components/WorkbookEditor.test.tsx
```

Expected: all tests pass.

- [ ] **Step 2: Run build**

Run:

```bash
cd sheet-sherlock-detective
bun run build
```

Expected: exit code 0. If Wrangler prints a sandbox log-write warning but build exits 0, record it as a sandbox logging warning, not an app failure.

- [ ] **Step 3: Manual browser check**

Start the existing frontend/backend dev servers using the repo’s normal commands. In `/diagnosis/$projectId`:

1. Double-click a workbook cell.
2. Enter a value and press Enter.
3. Confirm the workbook does not remount, blink, jump to the first sheet, or reset selection.
4. Confirm `Save draft` is enabled.
5. Click `Save draft`.
6. Confirm the workbook remains visible in the same position and selection.
7. Confirm a toast/status says the draft was saved as the new version.
8. Confirm the registry later lists the new project-scoped version.

## Self-Review

- Spec coverage: The plan addresses Enter-based cell edit reloads, `Save draft` reloads, background API calls, and visible user feedback.
- Placeholder scan: No `TBD`, no “handle later”, no vague test command.
- Type consistency: `savedDraftVersion`, `savingProjectVersion`, and `diagnosisDraftSaveLabel` are defined before use. The route remains project-scoped but does not route-switch on save.
