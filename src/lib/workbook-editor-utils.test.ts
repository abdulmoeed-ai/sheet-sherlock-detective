import { describe, expect, it } from "vitest";
import {
  buildWorkbookCellIndex,
  cellKey,
  prepareWorkbookForUniver,
  resolveWorkbookSheetId,
  workbookEditEventFromUniverEnd,
  type WorkbookPayload,
} from "./workbook-editor-utils";

const workbook: WorkbookPayload = {
  sheetOrder: ["sheet-1"],
  sheets: {
    "sheet-1": {
      id: "sheet-1",
      name: "Inputs",
      rowCount: 4,
      columnCount: 4,
      cellData: {
        "0": {
          "0": {
            v: 125,
            diagnosis: {
              sheetName: "Inputs",
              address: "A1",
              fieldId: "field-a1",
              editable: true,
              formula: false,
              status: "pending",
            },
          },
          "1": {
            v: 250,
            f: "A1*2",
            diagnosis: {
              sheetName: "Inputs",
              address: "B1",
              editable: false,
              formula: true,
              value: "-2,630,470",
            },
          },
        },
      },
    },
  },
};

describe("workbook editor utilities", () => {
  it("indexes workbook cells and resolves sheets without component imports", () => {
    const index = buildWorkbookCellIndex(workbook);

    expect(index.get(cellKey("Inputs", "A1"))?.meta?.fieldId).toBe("field-a1");
    expect(resolveWorkbookSheetId(workbook, "Inputs")).toBe("sheet-1");
  });

  it("prepares Univer workbook snapshots with formula values and comment markers", () => {
    const prepared = prepareWorkbookForUniver(
      { ...workbook, styles: { "diagnosis-formula": {} } },
      new Map([["Inputs!A1", { count: 1, displayCount: "1" }]]),
    );

    expect(prepared.sheets?.["sheet-1"]?.cellData?.["0"]?.["0"]?.markers).toMatchObject({
      tr: { color: "#7B68EE", size: 8 },
      tl: { color: "#7B68EE", size: 8 },
    });
    expect(prepared.sheets?.["sheet-1"]?.cellData?.["0"]?.["1"]?.f).toBe("=A1*2");
    expect(prepared.sheets?.["sheet-1"]?.cellData?.["0"]?.["1"]?.v).toBe(-2630470);
  });

  it("builds edit events from Univer values", () => {
    expect(
      workbookEditEventFromUniverEnd(
        workbook,
        { sheetId: "sheet-1", row: 0, column: 0 },
        { getData: () => ({ body: { dataStream: "300\r\n\0" } }) },
      ),
    ).toMatchObject({
      sheetId: "sheet-1",
      sheetName: "Inputs",
      address: "A1",
      fieldId: "field-a1",
      oldValue: "125",
      newValue: "300",
    });
  });
});
