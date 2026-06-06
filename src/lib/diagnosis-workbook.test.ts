import { describe, expect, it, vi } from "vitest";
import {
  buildCommentTarget,
  buildConfirmedCellUpdate,
  buildFieldIdCellKeys,
  buildOptimisticCellUpdate,
  displayValue,
  firstSheetWithDiagnosis,
  isNumericDraft,
  resolveSelection,
  workbookPayload,
  workbookValueFromDraft,
  type WorkbookPayload,
} from "./diagnosis-workbook";

const workbook: WorkbookPayload = {
  sheetOrder: ["sheet-1", "sheet-2"],
  sheets: {
    "sheet-1": {
      name: "Inputs",
      cellData: {
        "0": {
          "0": { v: 125, diagnosis: { fieldId: "field-a1", address: "A1" } },
          "1": { v: null, f: "A1*2" },
        },
      },
    },
    "sheet-2": {
      name: "Outputs",
      cellData: {
        "0": {
          "0": { v: 10, diagnosis: { fieldId: "field-a1", address: "A1" } },
        },
      },
    },
  },
};

describe("diagnosis workbook helpers", () => {
  it("normalizes backend workbook payloads and resolves diagnosis selections", () => {
    const parsed = workbookPayload({ workbookData: workbook });

    expect(parsed?.sheets?.["sheet-1"]?.name).toBe("Inputs");
    expect(resolveSelection(null, "sheet-1", workbook.sheets?.["sheet-1"])).toEqual({
      sheetId: "sheet-1",
      row: 0,
      col: 0,
    });
    expect(firstSheetWithDiagnosis(parsed, ["sheet-2", "sheet-1"])).toBe("sheet-2");
  });

  it("tracks only unique field ids for comment cell keys", () => {
    const keys = buildFieldIdCellKeys(workbook);

    expect(keys.has("field-a1")).toBe(false);
  });

  it("builds optimistic and confirmed cell updates", () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const optimistic = buildOptimisticCellUpdate({
      fieldId: "field-a1",
      draftValue: "(1,250)",
      oldValue: "125",
      currentUser: { id: "user-1", name: "Analyst One" },
    });
    const confirmed = buildConfirmedCellUpdate("field-a1", { value: "1,300" }, optimistic);

    expect(optimistic.workbookValue).toBe(-1250);
    expect(optimistic.history[0]).toMatchObject({
      actor: "user-1",
      actorDisplayName: "Analyst One",
      newValue: "(1,250)",
    });
    expect(confirmed.displayValue).toBe("1,300");
    expect(confirmed.workbookValue).toBe(1300);
  });

  it("formats draft and comment target values", () => {
    expect(displayValue({ v: null, f: "A1*2" })).toBe("=A1*2");
    expect(workbookValueFromDraft(" 1,250 ")).toBe(1250);
    expect(isNumericDraft("abc")).toBe(false);
    expect(
      buildCommentTarget({
        meta: { fieldId: "field-a1", sheetName: "Inputs", templateCell: "A1" },
        selectedCellAddress: "B2",
      }),
    ).toEqual({
      fieldId: "field-a1",
      sheetName: "Inputs",
      templateCell: "A1",
    });
  });
});
