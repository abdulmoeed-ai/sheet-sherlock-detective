import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalculationMode } from "@univerjs/sheets-formula";
import {
  buildWorkbookCellIndex,
  cellKey,
  prepareWorkbookForUniver,
  resolveWorkbookSheetId,
  workbookEditEventFromUniverEnd,
  workbookCellFromUniverPosition,
  WorkbookEditor,
  type WorkbookPayload,
} from "./WorkbookEditor";

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
          "1": { v: 250, f: "A1*2", diagnosis: { sheetName: "Inputs", address: "B1", editable: false, formula: true } },
        },
      },
    },
  },
};

afterEach(() => {
  cleanup();
  vi.doUnmock("@univerjs/presets");
  vi.doUnmock("@univerjs/preset-sheets-core");
  vi.doUnmock("@univerjs/preset-sheets-core/locales/en-US");
});

describe("WorkbookEditor bridge", () => {
  it("indexes workbook cells by sheet and address", () => {
    const index = buildWorkbookCellIndex(workbook);

    expect(index.get(cellKey("Inputs", "A1"))?.meta?.fieldId).toBe("field-a1");
    expect(index.get(cellKey("Inputs", "B1"))?.meta?.formula).toBe(true);
  });

  it("resolves Univer row and column positions to current diagnosis metadata", () => {
    const resolved = workbookCellFromUniverPosition(workbook, {
      sheetId: "sheet-1",
      row: 0,
      column: 0,
    });

    expect(resolved?.address).toBe("A1");
    expect(resolved?.cell.diagnosis?.fieldId).toBe("field-a1");
  });

  it("resolves Univer events by sheet id or sheet name", () => {
    expect(resolveWorkbookSheetId(workbook, "sheet-1")).toBe("sheet-1");
    expect(resolveWorkbookSheetId(workbook, "Inputs")).toBe("sheet-1");
    expect(resolveWorkbookSheetId(workbook, "missing")).toBeNull();
  });

  it("prepares workbook data for Univer without dropping diagnosis metadata", () => {
    const prepared = prepareWorkbookForUniver({
      ...workbook,
      formulaEvaluation: { status: "computed" },
      unknownBackendField: true,
    });

    expect(prepared.formulaEvaluation).toBeUndefined();
    expect(prepared.unknownBackendField).toBeUndefined();
    expect(prepared.sheets?.["sheet-1"]?.cellData?.["0"]?.["0"]?.diagnosis?.fieldId).toBe("field-a1");
    expect(prepared.sheets?.["sheet-1"]?.cellData?.["0"]?.["1"]?.f).toBe("=A1*2");
    expect(prepared.sheets?.["sheet-1"]?.cellData?.["0"]?.["0"]?.s).toBeDefined();
  });

  it("normalizes Univer sheet dimensions so extracted values remain readable", () => {
    const prepared = prepareWorkbookForUniver({
      sheetOrder: ["sheet-1"],
      sheets: {
        "sheet-1": {
          ...workbook.sheets!["sheet-1"],
          defaultColumnWidth: 42,
          defaultRowHeight: 14,
          rowData: { "0": { h: 12 } },
          columnData: { "0": { w: 38 } },
          cellData: {
            "0": {
              "0": { v: "Unconsolidated Statement of Financial Position" },
              "1": { v: 250 },
            },
          },
        },
      },
    });
    const sheet = prepared.sheets?.["sheet-1"];

    expect(sheet?.defaultColumnWidth).toBeGreaterThanOrEqual(112);
    expect(sheet?.defaultRowHeight).toBeGreaterThanOrEqual(28);
    expect(sheet?.rowData?.["0"]?.h).toBeGreaterThanOrEqual(28);
    expect(sheet?.columnData?.["0"]?.w).toBeGreaterThan(112);
    expect(sheet?.columnData?.["1"]?.w).toBeGreaterThanOrEqual(112);
  });

  it("configures Univer to force formula calculation when loading the workbook", async () => {
    vi.resetModules();
    const presetSpy = vi.fn((config: unknown) => ({ config }));
    const setInitialFormulaComputing = vi.fn();
    const createWorkbook = vi.fn();
    const dispose = vi.fn();

    vi.doMock("@univerjs/presets", () => ({
      createUniver: () => ({
        univerAPI: {
          getFormula: () => ({ setInitialFormulaComputing }),
          createWorkbook,
          getActiveWorkbook: () => ({ setActiveSheet: vi.fn() }),
          dispose,
          Event: {},
          addEvent: vi.fn(),
        },
      }),
      LocaleType: { EN_US: "en-US" },
      mergeLocales: (locale: unknown) => locale,
    }));
    vi.doMock("@univerjs/preset-sheets-core", () => ({
      UniverSheetsCorePreset: presetSpy,
    }));
    vi.doMock("@univerjs/preset-sheets-core/locales/en-US", () => ({
      default: {},
    }));

    const { WorkbookEditor: MockedWorkbookEditor } = await import("./WorkbookEditor");

    render(
      <MockedWorkbookEditor
        workbook={workbook}
        activeSheetId="sheet-1"
        selected={{ sheetId: "sheet-1", row: 0, col: 0 }}
        draftValue=""
        candidateCells={new Set()}
        commitPending={false}
        onSelect={vi.fn()}
        onCommitEdit={vi.fn()}
      />,
    );

    await waitFor(() => expect(createWorkbook).toHaveBeenCalled());
    expect(presetSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        formula: { initialFormulaComputing: CalculationMode.FORCED },
      }),
    );
    expect(setInitialFormulaComputing).toHaveBeenCalledWith(CalculationMode.FORCED);
  });

  it("converts Univer edit-end events into review-cell save events for editable inputs only", () => {
    expect(
      workbookEditEventFromUniverEnd(workbook, { sheetId: "sheet-1", row: 0, column: 0 }, "300"),
    ).toEqual({
      sheetName: "Inputs",
      address: "A1",
      fieldId: "field-a1",
      oldValue: "125",
      newValue: "300",
      note: "Saved from workbook editor.",
    });

    expect(workbookEditEventFromUniverEnd(workbook, { sheetId: "sheet-1", row: 0, column: 1 }, "300")).toBeNull();
  });

  it("extracts scalar values from Univer cell objects before saving", () => {
    expect(
      workbookEditEventFromUniverEnd(workbook, { sheetId: "sheet-1", row: 0, column: 0 }, { v: -11 }),
    ).toMatchObject({
      fieldId: "field-a1",
      newValue: "-11",
    });

    expect(
      workbookEditEventFromUniverEnd(workbook, { sheetId: "sheet-1", row: 0, column: 0 }, { v: "−11" }),
    ).toMatchObject({
      fieldId: "field-a1",
      newValue: "−11",
    });
  });

  it("extracts plain text from Univer rich text edit values before saving", () => {
    expect(
      workbookEditEventFromUniverEnd(
        workbook,
        { sheetId: "sheet-1", row: 0, column: 0 },
        { toPlainText: () => "-11\r\n" },
      ),
    ).toMatchObject({
      fieldId: "field-a1",
      newValue: "-11",
    });

    expect(
      workbookEditEventFromUniverEnd(
        workbook,
        { sheetId: "sheet-1", row: 0, column: 0 },
        { getData: () => ({ body: { dataStream: "-12\r\n\0" } }) },
      ),
    ).toMatchObject({
      fieldId: "field-a1",
      newValue: "-12",
    });
  });

  it("renders a spreadsheet editor surface and forwards editable cell changes", async () => {
    const onSelect = vi.fn();
    const onCommitEdit = vi.fn();

    render(
      <WorkbookEditor
        workbook={workbook}
        activeSheetId="sheet-1"
        selected={{ sheetId: "sheet-1", row: 0, col: 0 }}
        draftValue=""
        candidateCells={new Set()}
        commitPending={false}
        onSelect={onSelect}
        onCommitEdit={onCommitEdit}
      />,
    );

    await userEvent.click(screen.getByRole("gridcell", { name: /A1 125/i }));
    expect(onSelect).toHaveBeenCalledWith({ sheetId: "sheet-1", row: 0, col: 0 });

    await userEvent.dblClick(screen.getByRole("gridcell", { name: /A1 125/i }));
    await userEvent.clear(screen.getByDisplayValue("125"));
    await userEvent.type(screen.getByDisplayValue(""), "300{enter}");

    expect(onCommitEdit).toHaveBeenCalledWith({
      sheetName: "Inputs",
      address: "A1",
      fieldId: "field-a1",
      oldValue: "125",
      newValue: "300",
      note: "Saved from workbook editor.",
    });
  });

  it("does not allow formula cells to enter edit mode", async () => {
    const onCommitEdit = vi.fn();

    render(
      <WorkbookEditor
        workbook={workbook}
        activeSheetId="sheet-1"
        selected={{ sheetId: "sheet-1", row: 0, col: 1 }}
        draftValue=""
        candidateCells={new Set()}
        commitPending={false}
        onSelect={vi.fn()}
        onCommitEdit={onCommitEdit}
      />,
    );

    await userEvent.dblClick(screen.getByRole("gridcell", { name: /B1 250/i }));

    expect(screen.queryByDisplayValue("250")).toBeNull();
    expect(onCommitEdit).not.toHaveBeenCalled();
  });

  it("marks cells that have open comments", async () => {
    render(
      <WorkbookEditor
        workbook={workbook}
        activeSheetId="sheet-1"
        selected={{ sheetId: "sheet-1", row: 0, col: 0 }}
        draftValue=""
        candidateCells={new Set()}
        commentIndicators={new Set(["Inputs!A1"])}
        commitPending={false}
        onSelect={vi.fn()}
        onCommitEdit={vi.fn()}
      />,
    );

    expect(await screen.findByLabelText("A1 has open comments")).toBeTruthy();
  });
});
