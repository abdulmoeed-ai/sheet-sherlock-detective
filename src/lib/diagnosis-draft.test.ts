import { describe, expect, it } from "vitest";
import {
  diagnosisExportUnsavedDraftWarning,
  diagnosisDraftSaveLabel,
  hasDiagnosisDraftChanges,
  workbookDraftSaveSnapshot,
} from "./diagnosis-draft";

describe("diagnosis draft helpers", () => {
  it("enables draft saving for pending workbook edits even without side-panel text", () => {
    expect(hasDiagnosisDraftChanges({ draftValue: "", pendingWorkbookEditCount: 1 })).toBe(true);
  });

  it("keeps draft saving disabled when there are no text or workbook edits", () => {
    expect(hasDiagnosisDraftChanges({ draftValue: "   ", pendingWorkbookEditCount: 0 })).toBe(false);
  });

  it("describes background draft save state without implying a workbook reload", () => {
    expect(diagnosisDraftSaveLabel({ dirty: true, saving: false })).toBe("Unsaved draft");
    expect(diagnosisDraftSaveLabel({ dirty: true, saving: true })).toBe("Saving draft");
    expect(
      diagnosisDraftSaveLabel({
        dirty: false,
        saving: false,
        savedVersionLabel: "Versioned Workbook Co_2025_v2",
      }),
    ).toBe("Saved Versioned Workbook Co_2025_v2");
  });

  it("saves the latest workbook draft snapshot without feeding it back into render state", () => {
    expect(workbookDraftSaveSnapshot({ id: "edited" }, { id: "server" })).toEqual({ id: "edited" });
    expect(workbookDraftSaveSnapshot(null, { id: "server" })).toEqual({ id: "server" });
  });

  it("warns that unsaved draft values are excluded from Excel export", () => {
    expect(diagnosisExportUnsavedDraftWarning({ dirty: true })).toContain(
      "Save your draft before exporting",
    );
    expect(diagnosisExportUnsavedDraftWarning({ dirty: false })).toBe("");
  });
});
