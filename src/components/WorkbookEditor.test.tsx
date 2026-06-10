import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalculationMode } from "@univerjs/sheets-formula";
import { WorkbookEditor } from "./WorkbookEditor";
import {
  buildWorkbookCellIndex,
  cellKey,
  prepareWorkbookForUniver,
  resolveWorkbookSheetId,
  workbookCellFromUniverPosition,
  workbookEditEventFromUniverEnd,
  type WorkbookPayload,
} from "@/lib/workbook-editor-utils";

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
          "2": {
            v: null,
            f: "A1*2",
            formulaValueStatus: "blank_precedents",
            diagnosis: {
              sheetName: "Inputs",
              address: "C1",
              editable: false,
              formula: true,
              value: "74",
            },
          },
        },
      },
    },
  },
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
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
      styles: {
        "diagnosis-formula": { bg: { rgb: "#F9FAFB" }, cl: { rgb: "#374151" } },
        "diagnosis-default": { bg: { rgb: "#F8FBFF" }, cl: { rgb: "#1D4ED8" } },
      },
      sheets: {
        "sheet-1": {
          ...workbook.sheets!["sheet-1"],
          showGridlines: 0,
        },
      },
      unknownBackendField: true,
    });

    expect(prepared.formulaEvaluation).toBeUndefined();
    expect(prepared.unknownBackendField).toBeUndefined();
    expect(prepared.sheets?.["sheet-1"]?.cellData?.["0"]?.["0"]?.diagnosis?.fieldId).toBe(
      "field-a1",
    );
    expect(prepared.sheets?.["sheet-1"]?.cellData?.["0"]?.["1"]?.f).toBe("=A1*2");
    expect(prepared.sheets?.["sheet-1"]?.cellData?.["0"]?.["1"]?.v).toBe(-2630470);
    expect(prepared.sheets?.["sheet-1"]?.cellData?.["0"]?.["2"]?.v).toBeNull();
    expect(prepared.sheets?.["sheet-1"]?.showGridlines).toBe(1);
    expect(prepared.sheets?.["sheet-1"]?.cellData?.["0"]?.["0"]?.s).toBeDefined();
    expect(prepared.styles).toMatchObject({
      "diagnosis-formula": { n: { pattern: "#,##0;(#,##0);0" } },
      "diagnosis-default": { n: { pattern: "#,##0;(#,##0);0" } },
    });
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

  it("configures Univer to render backend formula values on initial load", async () => {
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
        commitPending={false}
        onSelect={vi.fn()}
        onCommitEdit={vi.fn()}
      />,
    );

    await waitFor(() => expect(createWorkbook).toHaveBeenCalled());
    expect(presetSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        formula: { initialFormulaComputing: CalculationMode.NO_CALCULATION },
      }),
    );
    expect(setInitialFormulaComputing).toHaveBeenCalledWith(CalculationMode.NO_CALCULATION);
  });

  it("adds purple Univer markers to both top corners for cells with comment indicators", () => {
    const prepared = prepareWorkbookForUniver(
      workbook,
      new Map([["Inputs!A1", { count: 2, displayCount: "2" }]]),
    );

    expect(prepared.sheets?.["sheet-1"]?.cellData?.["0"]?.["0"]?.markers).toMatchObject({
      tr: {
        color: "#7B68EE",
        size: 8,
      },
      tl: {
        color: "#7B68EE",
        size: 8,
      },
    });
    expect(prepared.sheets?.["sheet-1"]?.cellData?.["0"]?.["1"]?.markers).toBeUndefined();
  });

  it("debounces Univer selection move-end events before forwarding selected cells", async () => {
    vi.resetModules();
    let selectionMoveEnd: ((params: Record<string, unknown>) => void) | undefined;
    const createWorkbook = vi.fn();

    vi.doMock("@univerjs/presets", () => ({
      createUniver: () => ({
        univerAPI: {
          getFormula: () => ({ setInitialFormulaComputing: vi.fn() }),
          createWorkbook,
          getActiveWorkbook: () => ({ setActiveSheet: vi.fn() }),
          dispose: vi.fn(),
          Event: { SelectionMoveEnd: "SelectionMoveEnd" },
          addEvent: vi.fn((event, callback) => {
            if (event === "SelectionMoveEnd") selectionMoveEnd = callback;
          }),
        },
      }),
      LocaleType: { EN_US: "en-US" },
      mergeLocales: (locale: unknown) => locale,
    }));
    vi.doMock("@univerjs/preset-sheets-core", () => ({
      UniverSheetsCorePreset: vi.fn((config: unknown) => ({ config })),
    }));
    vi.doMock("@univerjs/preset-sheets-core/locales/en-US", () => ({
      default: {},
    }));

    const { WorkbookEditor: MockedWorkbookEditor } = await import("./WorkbookEditor");
    const onSelect = vi.fn();

    render(
      <MockedWorkbookEditor
        workbook={workbook}
        activeSheetId="sheet-1"
        selected={{ sheetId: "sheet-1", row: 0, col: 0 }}
        draftValue=""
        commitPending={false}
        onSelect={onSelect}
        onCommitEdit={vi.fn()}
      />,
    );

    await waitFor(() => expect(createWorkbook).toHaveBeenCalled());
    vi.useFakeTimers();

    selectionMoveEnd?.({
      worksheet: { getSheetId: () => "sheet-1" },
      selections: [{ startRow: 0, startColumn: 1, endRow: 0, endColumn: 1 }],
    });

    expect(onSelect).not.toHaveBeenCalled();
    vi.advanceTimersByTime(99);
    expect(onSelect).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onSelect).toHaveBeenCalledWith({ sheetId: "sheet-1", row: 0, col: 1 });
  });

  it("collapses rapid Univer selection movement to the latest selected cell", async () => {
    vi.resetModules();
    let selectionMoveEnd: ((params: Record<string, unknown>) => void) | undefined;
    const createWorkbook = vi.fn();

    vi.doMock("@univerjs/presets", () => ({
      createUniver: () => ({
        univerAPI: {
          getFormula: () => ({ setInitialFormulaComputing: vi.fn() }),
          createWorkbook,
          getActiveWorkbook: () => ({ setActiveSheet: vi.fn() }),
          dispose: vi.fn(),
          Event: { SelectionMoveEnd: "SelectionMoveEnd" },
          addEvent: vi.fn((event, callback) => {
            if (event === "SelectionMoveEnd") selectionMoveEnd = callback;
          }),
        },
      }),
      LocaleType: { EN_US: "en-US" },
      mergeLocales: (locale: unknown) => locale,
    }));
    vi.doMock("@univerjs/preset-sheets-core", () => ({
      UniverSheetsCorePreset: vi.fn((config: unknown) => ({ config })),
    }));
    vi.doMock("@univerjs/preset-sheets-core/locales/en-US", () => ({
      default: {},
    }));

    const { WorkbookEditor: MockedWorkbookEditor } = await import("./WorkbookEditor");
    const onSelect = vi.fn();

    render(
      <MockedWorkbookEditor
        workbook={workbook}
        activeSheetId="sheet-1"
        selected={{ sheetId: "sheet-1", row: 0, col: 0 }}
        draftValue=""
        commitPending={false}
        onSelect={onSelect}
        onCommitEdit={vi.fn()}
      />,
    );

    await waitFor(() => expect(createWorkbook).toHaveBeenCalled());
    vi.useFakeTimers();

    selectionMoveEnd?.({
      worksheet: { getSheetId: () => "sheet-1" },
      selections: [{ startRow: 0, startColumn: 1, endRow: 0, endColumn: 1 }],
    });
    vi.advanceTimersByTime(60);
    selectionMoveEnd?.({
      worksheet: { getSheetId: () => "sheet-1" },
      selections: [{ startRow: 0, startColumn: 2, endRow: 0, endColumn: 2 }],
    });
    vi.advanceTimersByTime(100);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({ sheetId: "sheet-1", row: 0, col: 2 });
  });

  it("uses Univer selection-changed events as a keyboard selection fallback", async () => {
    vi.resetModules();
    let selectionChanged: ((params: Record<string, unknown>) => void) | undefined;
    const createWorkbook = vi.fn();

    vi.doMock("@univerjs/presets", () => ({
      createUniver: () => ({
        univerAPI: {
          getFormula: () => ({ setInitialFormulaComputing: vi.fn() }),
          createWorkbook,
          getActiveWorkbook: () => ({ setActiveSheet: vi.fn() }),
          dispose: vi.fn(),
          Event: { SelectionChanged: "SelectionChanged" },
          addEvent: vi.fn((event, callback) => {
            if (event === "SelectionChanged") selectionChanged = callback;
          }),
        },
      }),
      LocaleType: { EN_US: "en-US" },
      mergeLocales: (locale: unknown) => locale,
    }));
    vi.doMock("@univerjs/preset-sheets-core", () => ({
      UniverSheetsCorePreset: vi.fn((config: unknown) => ({ config })),
    }));
    vi.doMock("@univerjs/preset-sheets-core/locales/en-US", () => ({
      default: {},
    }));

    const { WorkbookEditor: MockedWorkbookEditor } = await import("./WorkbookEditor");
    const onSelect = vi.fn();

    render(
      <MockedWorkbookEditor
        workbook={workbook}
        activeSheetId="sheet-1"
        selected={{ sheetId: "sheet-1", row: 0, col: 0 }}
        draftValue=""
        commitPending={false}
        onSelect={onSelect}
        onCommitEdit={vi.fn()}
      />,
    );

    await waitFor(() => expect(createWorkbook).toHaveBeenCalled());
    vi.useFakeTimers();

    selectionChanged?.({
      worksheet: { getName: () => "Inputs" },
      selections: [{ startRow: 0, startColumn: 1, endRow: 0, endColumn: 1 }],
    });
    vi.advanceTimersByTime(100);

    expect(onSelect).toHaveBeenCalledWith({ sheetId: "sheet-1", row: 0, col: 1 });
  });

  it("converts Univer edit-end events into review-cell save events for editable inputs only", () => {
    expect(
      workbookEditEventFromUniverEnd(workbook, { sheetId: "sheet-1", row: 0, column: 0 }, "300"),
    ).toEqual(
      expect.objectContaining({
        sheetId: "sheet-1",
        sheetName: "Inputs",
        address: "A1",
        fieldId: "field-a1",
        oldCell: expect.objectContaining({ v: 125 }),
        newCell: expect.objectContaining({ v: 300 }),
        oldValue: "125",
        newValue: "300",
        note: "Saved from workbook editor.",
      }),
    );

    expect(
      workbookEditEventFromUniverEnd(workbook, { sheetId: "sheet-1", row: 0, column: 1 }, "300"),
    ).toMatchObject({
      sheetId: "sheet-1",
      sheetName: "Inputs",
      address: "B1",
      newValue: "300",
    });
  });

  it("extracts scalar values from Univer cell objects before saving", () => {
    expect(
      workbookEditEventFromUniverEnd(
        workbook,
        { sheetId: "sheet-1", row: 0, column: 0 },
        { v: -11 },
      ),
    ).toMatchObject({
      fieldId: "field-a1",
      newValue: "-11",
    });

    expect(
      workbookEditEventFromUniverEnd(
        workbook,
        { sheetId: "sheet-1", row: 0, column: 0 },
        { v: "−11" },
      ),
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

    expect(onCommitEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        sheetId: "sheet-1",
        sheetName: "Inputs",
        address: "A1",
        fieldId: "field-a1",
        oldValue: "125",
        newValue: "300",
        note: "Saved from workbook editor.",
      }),
    );
  });

  it("autosaves formula edits with an updated workbook snapshot", async () => {
    const onCommitEdit = vi.fn();

    render(
      <WorkbookEditor
        workbook={workbook}
        activeSheetId="sheet-1"
        selected={{ sheetId: "sheet-1", row: 0, col: 1 }}
        draftValue=""
        commitPending={false}
        onSelect={vi.fn()}
        onCommitEdit={onCommitEdit}
      />,
    );

    await userEvent.dblClick(screen.getByRole("gridcell", { name: /B1 250/i }));
    await userEvent.clear(screen.getByDisplayValue("250"));
    await userEvent.type(screen.getByDisplayValue(""), "=A1*3{enter}");

    expect(onCommitEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        sheetName: "Inputs",
        address: "B1",
        oldCell: expect.objectContaining({ f: "A1*2" }),
        newCell: expect.objectContaining({ f: "=A1*3" }),
      }),
    );
    expect(onCommitEdit.mock.calls[0][0].workbook.sheets["sheet-1"].cellData["0"]["1"].f).toBe(
      "=A1*3",
    );
  });

  it("allows Univer to start editing blank cells and existing formula cells", async () => {
    vi.resetModules();
    let beforeEditStart: ((params: Record<string, unknown>) => void) | undefined;
    const createWorkbook = vi.fn();

    vi.doMock("@univerjs/presets", () => ({
      createUniver: () => ({
        univerAPI: {
          getFormula: () => ({ setInitialFormulaComputing: vi.fn() }),
          createWorkbook,
          getActiveWorkbook: () => ({ setActiveSheet: vi.fn() }),
          dispose: vi.fn(),
          Event: { BeforeSheetEditStart: "BeforeSheetEditStart" },
          addEvent: vi.fn((event, callback) => {
            if (event === "BeforeSheetEditStart") beforeEditStart = callback;
          }),
        },
      }),
      LocaleType: { EN_US: "en-US" },
      mergeLocales: (locale: unknown) => locale,
    }));
    vi.doMock("@univerjs/preset-sheets-core", () => ({
      UniverSheetsCorePreset: vi.fn((config: unknown) => ({ config })),
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
        commitPending={false}
        onSelect={vi.fn()}
        onCommitEdit={vi.fn()}
      />,
    );

    await waitFor(() => expect(createWorkbook).toHaveBeenCalled());
    const formulaCellParams = {
      worksheet: { getSheetId: () => "sheet-1" },
      row: 0,
      column: 1,
    };
    const blankCellParams = {
      worksheet: { getSheetId: () => "sheet-1" },
      row: 2,
      column: 2,
    };

    beforeEditStart?.(formulaCellParams);
    beforeEditStart?.(blankCellParams);

    expect(formulaCellParams).not.toHaveProperty("cancel");
    expect(blankCellParams).not.toHaveProperty("cancel");
  });

  it("autosaves edits on newly-added Univer sheets from the live workbook snapshot", async () => {
    vi.resetModules();
    let beforeEditEnd: ((params: Record<string, unknown>) => void) | undefined;
    const createWorkbook = vi.fn();
    const liveWorkbook: WorkbookPayload = {
      sheetOrder: ["sheet-1", "new-sheet"],
      sheets: {
        ...workbook.sheets,
        "new-sheet": {
          id: "new-sheet",
          name: "testing sheet",
          rowCount: 20,
          columnCount: 8,
          cellData: {},
        },
      },
    };

    vi.doMock("@univerjs/presets", () => ({
      createUniver: () => ({
        univerAPI: {
          getFormula: () => ({ setInitialFormulaComputing: vi.fn() }),
          createWorkbook,
          getActiveWorkbook: () => ({
            setActiveSheet: vi.fn(),
            save: () => liveWorkbook,
          }),
          dispose: vi.fn(),
          Event: { BeforeSheetEditEnd: "BeforeSheetEditEnd" },
          addEvent: vi.fn((event, callback) => {
            if (event === "BeforeSheetEditEnd") beforeEditEnd = callback;
          }),
        },
      }),
      LocaleType: { EN_US: "en-US" },
      mergeLocales: (locale: unknown) => locale,
    }));
    vi.doMock("@univerjs/preset-sheets-core", () => ({
      UniverSheetsCorePreset: vi.fn((config: unknown) => ({ config })),
    }));
    vi.doMock("@univerjs/preset-sheets-core/locales/en-US", () => ({
      default: {},
    }));

    const { WorkbookEditor: MockedWorkbookEditor } = await import("./WorkbookEditor");
    const onSelect = vi.fn();
    const onCommitEdit = vi.fn();

    render(
      <MockedWorkbookEditor
        workbook={workbook}
        activeSheetId="sheet-1"
        selected={{ sheetId: "sheet-1", row: 0, col: 0 }}
        draftValue=""
        commitPending={false}
        onSelect={onSelect}
        onCommitEdit={onCommitEdit}
      />,
    );

    await waitFor(() => expect(createWorkbook).toHaveBeenCalled());

    beforeEditEnd?.({
      worksheet: { getSheetId: () => "new-sheet" },
      row: 0,
      column: 0,
      value: "=SUM(10,20)",
    });

    expect(onSelect).toHaveBeenCalledWith({ sheetId: "new-sheet", row: 0, col: 0 });
    expect(onCommitEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        sheetId: "new-sheet",
        sheetName: "testing sheet",
        address: "A1",
        oldCell: null,
        newCell: expect.objectContaining({ f: "=SUM(10,20)", v: null }),
      }),
    );
    expect(onCommitEdit.mock.calls[0][0].workbook.sheets["new-sheet"].cellData["0"]["0"].f).toBe(
      "=SUM(10,20)",
    );
  });

  it("builds autosave events for formula edits from Univer", () => {
    const event = workbookEditEventFromUniverEnd(
      workbook,
      { sheetId: "sheet-1", row: 0, column: 1 },
      "=A2+B2",
    );

    expect(event).toEqual(
      expect.objectContaining({
        sheetId: "sheet-1",
        sheetName: "Inputs",
        address: "B1",
        oldCell: expect.objectContaining({ f: "A1*2" }),
        newCell: expect.objectContaining({ f: "=A2+B2" }),
      }),
    );
  });
});
