# Diagnosis Enter Reload and Formula Integrity Debug/Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `/diagnosis/$projectId` so pressing Enter after a cell edit does not reload/remount the workbook, and diagnose/fix incorrect formula/cached-value display in the diagnosis workbook when only `Millat - 2023.pdf` is uploaded.

**Architecture:** Split the fix into two tracks. Track A keeps the live Univer workbook mounted by moving edited workbook snapshots out of React render state and into refs/background save state. Track B traces formula values from template, extraction output, saved workbook JSON, backend workspace payload, and Univer calculation config; fixes must preserve comparative-year values present in the uploaded annual report, show blank formula results when all precedent inputs are blank, and must not modify the template workbook.

**Tech Stack:** React, TanStack Router, TanStack Query, Univer Sheets, Vitest/jsdom via `bun run test`, FastAPI, SQLAlchemy, openpyxl, pytest via `uv run python -m pytest`.

---

## Evidence Gathered So Far

### Enter reload/root cause

`sheet-sherlock-detective/src/components/WorkbookEditor.tsx` rebuilds the Univer instance in this effect:

```ts
useEffect(() => {
  // bootUniver() calls createUniver(...) and createWorkbook(...)
  return () => {
    disposed = true;
    dispose?.();
  };
}, [preparedWorkbook, workbook]);
```

`preparedWorkbook` is derived from the `workbook` prop:

```ts
const preparedWorkbook = useMemo(() => prepareWorkbookForUniver(workbook), [workbook]);
```

`sheet-sherlock-detective/src/routes/diagnosis.$projectId.tsx` currently does this after every committed cell edit:

```ts
setDraftWorkbook(event.workbook);
setPendingWorkbookEditCount((count) => count + 1);
```

That creates a new `workbook` prop identity, so `WorkbookEditor` disposes and recreates Univer. This explains why pressing Enter reloads/rerenders the sheet even though `Save draft` no longer navigates.

### Formula/cached-value suspects

`backend_code/backend/app/services/extraction/workbook_preview.py` builds workbook payloads from the template with both formula text and cached workbook values:

```py
workbook = load_workbook(path, data_only=False)
cached_workbook = load_workbook(path, data_only=True)
...
if isinstance(cell.value, str) and cell.value.startswith("="):
    payload["f"] = cell.value
    cached_value = cached_worksheet.cell(row=cell.row, column=cell.column).value
    payload["v"] = _primitive_value(cached_value)
```

`backend_code/backend/app/services/projects.py` then overlays extracted input values into that template payload, but it does not recalculate formulas before returning `diagnosisWorkbook`.

`sheet-sherlock-detective/src/components/WorkbookEditor.tsx` currently uses:

```ts
formula: {
  initialFormulaComputing: CalculationMode.WHEN_EMPTY,
}
```

If a formula cell has stale cached `v`, `WHEN_EMPTY` can preserve the stale value instead of forcing recomputation.

Local template inspection found formulas that may look suspicious out of context:

```text
PL1 - Revenue row 18 Net Local Sales:
B18 =$B$10+$B$17
C18 =$C$10+$C$17
D18 =$C$10+$C$17
E18 =$C$10+$C$17
F18 =$C$10+$C$17
```

The user has confirmed the template formulas should be treated as correct and must not be modified. The plan may audit and document formula behavior, but it must not edit `backend_code/sample_docs/Millat - Template.xlsx`.

The deterministic extractor for `Millat - 2023.pdf` returned 2023 and 2022 note 32 local-sales rows, but no 2021 rows in the quick probe. The user confirmed comparative values present inside `Millat - 2023.pdf` should be displayed, so 2022 values are expected and should not be removed. 2021 should not show note-reference or stale formula values from this upload.

## User Decisions

- Formula subtotal/total rows whose precedent cells are all blank should display a blank cell, not `0`.
- When only `Millat - 2023.pdf` is uploaded, display the years and comparative values present inside that annual report.
- Do not modify or commit changes to `backend_code/sample_docs/Millat - Template.xlsx`; the template formulas are considered correct.
- Do not clean or regenerate saved workbook JSON for project `a60885ed-1ad8-4a28-8676-bf85f208e632`. The user will retest by uploading the 2023 annual report again.

See `sheet-sherlock-detective/docs/implementation/diagnosis-debug-questions-for-user.md`.

## File Structure

Frontend files:

- Modify: `sheet-sherlock-detective/src/routes/diagnosis.$projectId.tsx`
  - Store committed workbook snapshots in a `useRef`, not render state.
  - Keep dirty/save UI state in React state.
  - Save using the ref snapshot.
- Modify: `sheet-sherlock-detective/src/components/WorkbookEditor.tsx`
  - Avoid remounting Univer on parent draft state changes.
  - Force formula recomputation if confirmed.
  - Add test hooks or small helpers for stable workbook identity if needed.
- Modify: `sheet-sherlock-detective/src/components/WorkbookEditor.test.tsx`
  - Add regression tests for formula config and no-remount behavior where practical.
- Modify: `sheet-sherlock-detective/src/lib/diagnosis-draft.ts`
  - Add tiny helpers only if needed to keep route tests small.

Backend files:

- Modify: `backend_code/backend/app/services/extraction/workbook_preview.py`
  - Stop marking stale cached formula values as trusted computed results unless a real recalculation occurred.
  - Add formula metadata that lets the frontend display blank when all precedent inputs are blank.
- Modify: `backend_code/backend/app/services/projects.py`
  - Add diagnostic payload/logging for formula cells during workspace generation.
  - Ensure saved workbook merges do not preserve stale generated formula cells in the response payload, without mutating existing saved workbook JSON.
- Modify: `backend_code/backend/app/services/extraction/excel_population.py`
  - Reuse or expose recalculation evidence if server-side recalculation becomes part of the fix.
- Do not modify: `backend_code/sample_docs/Millat - Template.xlsx`
  - Template formulas are treated as correct per user decision.
- Add/modify tests under:
  - `backend_code/backend/tests/excel/test_workbook_preview.py`
  - `backend_code/backend/tests/extraction/test_millat_batch_pipeline.py`
  - `backend_code/backend/tests/integration/test_project_api.py`

## Task 1: Capture Current Project Evidence Before Fixing

**Files:**
- Create: `backend_code/backend/scripts/debug_diagnosis_workbook.py`
- Output: temporary console output only; do not commit generated JSON unless requested.

- [ ] **Step 1: Create a focused debug script**

Create `backend_code/backend/scripts/debug_diagnosis_workbook.py`:

```py
from __future__ import annotations

import asyncio
import json
import sys

from sqlalchemy import select

from app.db.models import ProjectWorkbook
from app.db.session import AsyncSessionLocal
from app.services.projects import ProjectService


CELLS = {
    "B11": ("10", "1"),
    "C11": ("10", "2"),
    "D11": ("10", "3"),
    "E11": ("10", "4"),
    "F11": ("10", "5"),
    "B18": ("17", "1"),
    "C18": ("17", "2"),
    "D18": ("17", "3"),
    "E18": ("17", "4"),
    "F18": ("17", "5"),
    "B19": ("18", "1"),
    "C19": ("18", "2"),
    "D19": ("18", "3"),
    "E19": ("18", "4"),
    "F19": ("18", "5"),
}


def find_sheet(workbook: dict, name: str) -> dict | None:
    for sheet in (workbook.get("sheets") or {}).values():
        if isinstance(sheet, dict) and sheet.get("name") == name:
            return sheet
    return None


def cell_payload(sheet: dict, row_key: str, col_key: str):
    row = (sheet.get("cellData") or {}).get(row_key)
    if not isinstance(row, dict):
        return None
    return row.get(col_key)


async def main() -> None:
    project_id = sys.argv[1]
    user_id = sys.argv[2]
    async with AsyncSessionLocal() as session:
        service = ProjectService(session)
        workspace = await service.get_workspace(user_id=user_id, project_id=project_id)
        generated = workspace.get("diagnosisWorkbook")
        saved = await session.scalar(select(ProjectWorkbook).where(ProjectWorkbook.project_id == project_id))
        print("documents", [doc.get("filename") for doc in workspace.get("documents", [])])
        print("project", workspace.get("project"))
        for label, workbook in [("workspace", generated), ("saved", saved.workbook_json if saved else None)]:
            print(f"## {label}")
            if not isinstance(workbook, dict):
                print("missing")
                continue
            sheet = find_sheet(workbook, "PL1 - Revenue")
            if sheet is None:
                print("PL1 missing")
                continue
            for address, (row_key, col_key) in CELLS.items():
                print(address, json.dumps(cell_payload(sheet, row_key, col_key), default=str, sort_keys=True))


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: Run against the reported project**

Run from `backend_code/backend` after identifying the owning user id:

```bash
UV_NO_SYNC=1 UV_CACHE_DIR=/tmp/uv-cache uv run python scripts/debug_diagnosis_workbook.py a60885ed-1ad8-4a28-8676-bf85f208e632 <USER_ID>
```

Expected: prints `PL1 - Revenue` payloads for generated workspace and saved workbook, including each cell's `f`, `v`, and `diagnosis`.

- [ ] **Step 3: Interpret evidence**

Classify each suspicious value:

- If suspicious values appear in `saved` but not generated workspace: root cause is stale/corrupt saved project workbook JSON or the merge policy.
- If suspicious values appear in generated workspace before saved merge: root cause is template cache, extraction mapping, formula config, or template formula.
- If suspicious values appear only after Univer renders: root cause is client formula evaluation/config.

## Task 2: Fix Enter-Key Workbook Remount

**Files:**
- Modify: `sheet-sherlock-detective/src/routes/diagnosis.$projectId.tsx`
- Test: `sheet-sherlock-detective/src/lib/diagnosis-draft.test.ts` or `sheet-sherlock-detective/src/components/WorkbookEditor.test.tsx`

- [ ] **Step 1: Add a draft snapshot ref**

Near the current draft state in `diagnosis.$projectId.tsx`, add:

```ts
const draftWorkbookRef = useRef<WorkbookPayload | null>(null);
```

- [ ] **Step 2: Stop using `draftWorkbook` as the visible workbook prop**

Replace:

```ts
const [draftWorkbook, setDraftWorkbook] = useState<WorkbookPayload | null>(null);
const workbook = draftWorkbook ?? serverWorkbook;
```

with:

```ts
const workbook = serverWorkbook;
```

Keep `pendingWorkbookEditCount` and `savedDraftVersion` as React state because they affect header UI only.

- [ ] **Step 3: Reset the ref only when project changes**

Change the project reset effect to:

```ts
useEffect(() => {
  draftWorkbookRef.current = null;
  setPendingWorkbookEditCount(0);
  setSavedDraftVersion(null);
}, [projectId]);
```

- [ ] **Step 4: Store committed workbook snapshots in the ref**

In `commitWorkbookEdit`, replace:

```ts
setDraftWorkbook(event.workbook);
```

with:

```ts
draftWorkbookRef.current = event.workbook;
```

Do not pass the new snapshot back into `WorkbookEditor` through props. Univer already has the edited value internally, so React should not remount the spreadsheet engine just to remember the save payload.

- [ ] **Step 5: Save the ref snapshot**

In the workbook draft branch of `saveDraft()`, replace:

```ts
workbook: workbook as Record<string, unknown>,
```

with:

```ts
workbook: (draftWorkbookRef.current ?? workbook) as Record<string, unknown>,
```

- [ ] **Step 6: Add regression coverage**

Prefer a focused route-level test if a light harness exists. If not, add a small helper test that documents the rule:

```ts
export function workbookDraftSaveSnapshot<T>(draftSnapshot: T | null, serverWorkbook: T): T {
  return draftSnapshot ?? serverWorkbook;
}
```

Test:

```ts
expect(workbookDraftSaveSnapshot({ id: "edited" }, { id: "server" })).toEqual({ id: "edited" });
expect(workbookDraftSaveSnapshot(null, { id: "server" })).toEqual({ id: "server" });
```

- [ ] **Step 7: Verify Enter no longer remounts manually**

Run the frontend dev server and open the reported route. Double-click a cell, enter a value, press Enter. Confirm:

- no `Loading spreadsheet engine` banner reappears,
- selection does not jump,
- toolbar does not reset,
- `Unsaved draft` appears,
- `Save draft` remains enabled.

## Task 3: Reproduce and Guard Against Note-Reference Values Being Written As Amounts

**Files:**
- Modify: `backend_code/backend/tests/extraction/test_millat_batch_pipeline.py`
- Modify only after failing test: `backend_code/backend/app/services/extraction/batch_pipeline.py`

- [ ] **Step 1: Add a regression test for 2023 note 32 local sales**

Add a focused test:

```py
def test_batch_extraction_2023_note_32_does_not_treat_note_numbers_as_amounts():
    result = extract_millat_batch([SAMPLE_ROOT / "Millat - 2023.pdf"])

    assert result.find_value("Tractors", 2023).value == Decimal("39707798")
    assert result.find_value("Tractors", 2022).value == Decimal("53838874")
    assert result.find_value("Tractors", 2021) is None

    for label in ["Gross Local Sales", "Total Deductions", "Net Local Sales"]:
        assert result.find_value(label, 2021) is None
```

- [ ] **Step 2: Run the test**

Run:

```bash
cd backend_code/backend
UV_NO_SYNC=1 UV_CACHE_DIR=/tmp/uv-cache uv run python -m pytest tests/extraction/test_millat_batch_pipeline.py -k "2023_note_32"
```

Expected before implementation: should pass for extractor-level behavior if the bug is not extraction. If it fails, fix extraction parsing before touching workbook rendering.

- [ ] **Step 3: If failing, fix note-token parsing**

Only if the test fails, inspect helpers:

- `_looks_like_note_reference`
- `_looks_like_integer_note_reference`
- `_numeric_tokens_after_label`
- calls using `skip_leading_note_reference`

The fix must reject standalone note references like `32`, `13.1`, `24`, `46`, or `74` as amount values when they appear in the note column.

## Task 4: Fix Formula Payload Semantics For Blank Precedents

**Files:**
- Modify: `backend_code/backend/app/services/extraction/workbook_preview.py`
- Modify: `backend_code/backend/tests/excel/test_workbook_preview.py`
- Maybe modify: `sheet-sherlock-detective/src/components/WorkbookEditor.tsx`
- Modify: `sheet-sherlock-detective/src/components/WorkbookEditor.test.tsx`

- [ ] **Step 1: Add backend test proving blank-precedent formulas are not displayed as stale values**

Add a test in `test_workbook_preview.py` that inspects a formula cell:

```py
def test_workbook_preview_marks_formula_with_blank_precedents_as_blank_display():
    workbook_data = build_workbook_preview(TEMPLATE_PATH)
    pl1 = next(sheet for sheet in workbook_data["sheets"].values() if sheet["name"] == "PL1 - Revenue")

    cell = pl1["cellData"][9][1]

    assert cell["f"] == "=SUM(B5:B9)"
    assert cell["v"] is None
    assert cell.get("formulaValueStatus") == "blank_precedents"
```

- [ ] **Step 2: Implement blank-precedent formula metadata**

In `workbook_preview.py`, when setting formula payloads, inspect referenced same-sheet precedent cells. For formulas whose referenced input cells are all blank, do not expose stale cached `v`; keep the cached value separately for debugging:

```py
payload["cachedV"] = _primitive_value(cached_value)
payload["v"] = None
payload["formulaValueStatus"] = "blank_precedents"
```

For formulas with at least one nonblank precedent, keep the current cached value but mark it explicitly:

```py
payload["cachedV"] = _primitive_value(cached_value)
payload["v"] = _primitive_value(cached_value)
payload["formulaValueStatus"] = "cached"
```

Use openpyxl formula-token parsing only if the local formula is not a simple range. For the first implementation, support direct same-sheet ranges such as `=SUM(B5:B9)` and direct same-sheet references such as `=$B$10+$B$17`; add focused tests for both.

- [ ] **Step 3: Force client-side formula computation**

Change `WorkbookEditor.tsx`:

```ts
initialFormulaComputing: CalculationMode.FORCED,
```

and keep:

```ts
eventApi.getFormula?.().setInitialFormulaComputing?.(CalculationMode.FORCED);
```

Update `WorkbookEditor.test.tsx` to assert `CalculationMode.FORCED` is passed to `UniverSheetsCorePreset`.

- [ ] **Step 4: Preserve blank-precedent display in the frontend**

Review this current frontend logic:

```ts
if (formula && cell.diagnosis && "value" in cell.diagnosis) {
  preparedCell.v = workbookDisplayValue(cell.diagnosis.value);
}
```

Add a guard so formula cells do not get amount-like values from metadata unless explicitly computed:

```ts
if (
  formula &&
  cell.diagnosis &&
  "value" in cell.diagnosis &&
  cell.formulaValueStatus !== "blank_precedents"
) {
  preparedCell.v = workbookDisplayValue(cell.diagnosis.value);
}
```

Add the matching TypeScript field to `WorkbookCellPayload`.

## Task 5: Audit Template Formula Behavior Without Editing The Template

**Files:**
- Inspect: `backend_code/sample_docs/Millat - Template.xlsx`
- Create: `backend_code/backend/scripts/audit_template_formulas.py`
- Test: `backend_code/backend/tests/excel/test_workbook_preview.py`

- [ ] **Step 1: Add a formula audit script**

Create `backend_code/backend/scripts/audit_template_formulas.py`:

```py
from __future__ import annotations

from openpyxl import load_workbook

from app.services.extraction.workbook_preview import default_template_path


CHECKS = {
    "PL1 - Revenue": {
        "B18": "=$B$10+$B$17",
        "C18": "=$C$10+$C$17",
        "D18": "=$C$10+$C$17",
        "E18": "=$C$10+$C$17",
        "F18": "=$C$10+$C$17",
    }
}


def main() -> None:
    workbook = load_workbook(default_template_path(), data_only=False)
    for sheet_name, checks in CHECKS.items():
        worksheet = workbook[sheet_name]
        for address, expected in checks.items():
            actual = worksheet[address].value
            print(sheet_name, address, actual, "OK" if actual == expected else f"EXPECTED {expected}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run audit**

Run:

```bash
cd backend_code/backend
UV_NO_SYNC=1 UV_CACHE_DIR=/tmp/uv-cache uv run python scripts/audit_template_formulas.py
```

Expected with current evidence: B18-F18 match the formulas currently in the template.

- [ ] **Step 3: Do not modify template formulas**

Do not write to `backend_code/sample_docs/Millat - Template.xlsx`. The user confirmed the formulas are correct and must not be modified.

- [ ] **Step 4: Add regression test documenting current formulas**

Add:

```py
def test_pl1_net_local_sales_formulas_match_template_contract():
    workbook_data = build_workbook_preview(TEMPLATE_PATH)
    pl1 = next(sheet for sheet in workbook_data["sheets"].values() if sheet["name"] == "PL1 - Revenue")

    assert pl1["cellData"][17][1]["f"] == "=$B$10+$B$17"
    assert pl1["cellData"][17][2]["f"] == "=$C$10+$C$17"
    assert pl1["cellData"][17][3]["f"] == "=$C$10+$C$17"
    assert pl1["cellData"][17][4]["f"] == "=$C$10+$C$17"
    assert pl1["cellData"][17][5]["f"] == "=$C$10+$C$17"
```

## Task 6: Prevent Stale Saved Formula Values In Response Payload Only

**Files:**
- Modify: `backend_code/backend/app/services/projects.py`
- Test: `backend_code/backend/tests/excel/test_workbook_preview.py`

- [ ] **Step 1: Add a test for stale formula cells in saved workbook JSON**

Extend the existing `_merge_diagnosis_metadata` test:

```py
def test_merge_diagnosis_metadata_does_not_keep_stale_saved_formula_values():
    saved_workbook = {
        "sheetOrder": ["sheet-1"],
        "sheets": {
            "sheet-1": {
                "id": "sheet-1",
                "name": "PL1 - Revenue",
                "cellData": {"10": {"3": {"f": "=SUM(D5:D10)", "v": 879178}}},
            }
        },
    }
    generated_workbook = {
        "sheetOrder": ["sheet-1"],
        "sheets": {
            "sheet-1": {
                "id": "sheet-1",
                "name": "PL1 - Revenue",
                "cellData": {10: {3: {"f": "=SUM(D5:D10)", "v": None, "formulaValueStatus": "blank_precedents"}}},
            }
        },
    }

    merged = _merge_diagnosis_metadata(saved_workbook, generated_workbook)

    assert merged["sheets"]["sheet-1"]["cellData"]["10"]["3"]["v"] is None
    assert merged["sheets"]["sheet-1"]["cellData"]["10"]["3"]["formulaValueStatus"] == "blank_precedents"
```

- [ ] **Step 2: Update merge logic**

Currently `_merge_diagnosis_metadata` only copies generated cells that contain `"diagnosis"`. Change it so formula cells from generated workbook replace saved formula cells too:

```py
if "diagnosis" in generated_cell or "f" in generated_cell:
    saved_row[str(col_key)] = json.loads(json.dumps(generated_cell))
```

This prevents old saved project workbook JSON from freezing stale formula values in the response payload. Do not mutate or regenerate existing `project_workbooks.workbook_json` records for the reported project.

## Task 7: Verification

**Frontend commands:**

```bash
cd sheet-sherlock-detective
bun run test src/components/WorkbookEditor.test.tsx src/lib/diagnosis-draft.test.ts
bun run build
```

Expected: tests pass and build exits 0. If Wrangler cannot write logs under `/home/.../.config/.wrangler/logs` in the sandbox but exits 0, record it as a sandbox logging warning.

**Backend commands:**

```bash
cd backend_code/backend
UV_NO_SYNC=1 UV_CACHE_DIR=/tmp/uv-cache uv run python -m pytest tests/excel/test_workbook_preview.py tests/extraction/test_millat_batch_pipeline.py -k "blank_precedents or 2023_note_32 or pl1_net_local_sales"
UV_NO_SYNC=1 UV_CACHE_DIR=/tmp/uv-cache uv run python -m compileall app
```

Expected: focused tests pass and compileall exits 0.

**Manual browser checks:**

1. Open `http://localhost:8080/diagnosis/a60885ed-1ad8-4a28-8676-bf85f208e632`.
2. Enter a value in any editable cell and press Enter.
3. Confirm the workbook does not reload, remount, or show `Loading spreadsheet engine`.
4. Confirm `Save draft` becomes enabled and status changes to `Unsaved draft`.
5. Click `Save draft`.
6. Confirm the workbook does not navigate away or remount.
7. Inspect `PL1 - Revenue`:
   - 2023 detail values should match `Millat - 2023.pdf`.
   - 2022 comparative values from `Millat - 2023.pdf` should appear when present in the uploaded annual report.
   - 2021 should not show note-reference or stale formula values for Note 32 rows.
   - Formula total rows should display blank when all precedent inputs are blank; otherwise they should compute from populated precedent inputs or carry an explicit nonblank formula status.

## Self-Review

- Spec coverage: covers Enter-triggered reload, Save Draft background behavior, formula values in empty years, note-column leakage suspicion, wrong Gross Local Sales formula/value, and possible DB/saved-workbook corruption.
- Placeholder scan: no `TBD`, no vague “handle edge cases”; each task names files, commands, and expected outputs.
- Type consistency: `formulaValueStatus`, `draftWorkbookRef`, and merge-policy changes are introduced before use.
