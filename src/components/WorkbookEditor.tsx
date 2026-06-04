import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import {
  diagnosisCellTone,
  isActionableWarningSet,
  shouldCommitCellDraftOnKey,
  type DiagnosisTone,
} from "@/lib/diagnosis-cell";
import { CalculationMode } from "@univerjs/sheets-formula";
import "@univerjs/preset-sheets-core/lib/index.css";

export type WorkbookCellMeta = {
  sheetName?: string;
  address?: string;
  editable?: boolean;
  formula?: boolean;
  fieldId?: string;
  status?: string;
  confidence?: number | null;
  templateCell?: string;
  warnings?: string[];
  [key: string]: unknown;
};

export type WorkbookCellPayload = {
  v?: unknown;
  f?: string;
  diagnosis?: WorkbookCellMeta;
  s?: string;
};

export type WorkbookSheetPayload = {
  id?: string;
  name: string;
  rowCount?: number;
  columnCount?: number;
  defaultColumnWidth?: number;
  defaultRowHeight?: number;
  rowData?: Record<string, { h?: number; hd?: number; [key: string]: unknown }>;
  columnData?: Record<string, { w?: number; hd?: number; [key: string]: unknown }>;
  cellData?: Record<string, Record<string, WorkbookCellPayload>>;
};

export type WorkbookPayload = {
  id?: string;
  name?: string;
  sheetOrder?: string[];
  sheets?: Record<string, WorkbookSheetPayload>;
  [key: string]: unknown;
};

export type WorkbookSelection = { sheetId: string; row: number; col: number };

export type WorkbookEditEvent = {
  workbook: WorkbookPayload;
  sheetId: string;
  sheetName: string;
  address: string;
  fieldId?: string | null;
  oldCell?: WorkbookCellPayload | null;
  newCell?: WorkbookCellPayload | null;
  oldValue: string;
  newValue: string;
  note: string;
};

type IndexedCell = {
  sheetId: string;
  sheetName: string;
  row: number;
  col: number;
  address: string;
  cell: WorkbookCellPayload;
  meta?: WorkbookCellMeta;
};

const MAX_VISIBLE_ROWS = 90;
const MAX_VISIBLE_COLS = 14;
const MIN_COLUMN_WIDTH = 112;
const MAX_COLUMN_WIDTH = 260;
const MIN_ROW_HEIGHT = 28;

export function WorkbookEditor({
  workbook,
  activeSheetId,
  selected,
  draftValue,
  commentIndicators = new Set(),
  commitPending,
  onSelect,
  onCommitEdit,
}: {
  workbook: WorkbookPayload;
  activeSheetId?: string | null;
  selected: WorkbookSelection;
  draftValue: string;
  commentIndicators?: Set<string>;
  commitPending: boolean;
  onSelect: (selection: WorkbookSelection) => void;
  onCommitEdit: (event: WorkbookEditEvent) => Promise<void> | void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const onCommitEditRef = useRef(onCommitEdit);
  const [editing, setEditing] = useState<WorkbookSelection | null>(null);
  const [editValue, setEditValue] = useState("");
  const [univerState, setUniverState] = useState<"loading" | "ready" | "fallback">("loading");
  const [paintState, setPaintState] = useState<"unknown" | "painted" | "blank">("unknown");
  const preparedWorkbook = useMemo(() => prepareWorkbookForUniver(workbook), [workbook]);
  const activeSheet = activeSheetId ? workbook.sheets?.[activeSheetId] : undefined;
  const shape = useMemo(() => sheetShape(activeSheet), [activeSheet]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    onCommitEditRef.current = onCommitEdit;
  }, [onCommitEdit]);

  useEffect(() => {
    let disposed = false;
    let dispose: (() => void) | undefined;
    let paintTimer: number | undefined;

    async function bootUniver() {
      if (!containerRef.current) return;
      try {
        const [{ createUniver, LocaleType, mergeLocales }, { UniverSheetsCorePreset }, localeModule] =
          await Promise.all([
            import("@univerjs/presets"),
            import("@univerjs/preset-sheets-core"),
            import("@univerjs/preset-sheets-core/locales/en-US"),
          ]);
        if (disposed || !containerRef.current) return;
        const { univerAPI } = createUniver({
          locale: LocaleType.EN_US,
          locales: {
            [LocaleType.EN_US]: mergeLocales(localeModule.default),
          },
          presets: [
            UniverSheetsCorePreset({
              container: containerRef.current,
              formula: {
                initialFormulaComputing: CalculationMode.FORCED,
              },
            }),
          ],
        });
        const eventApi = univerAPI as unknown as {
          getFormula?: () => { setInitialFormulaComputing?: (mode: unknown) => void };
          createWorkbook: (data: WorkbookPayload, options?: Record<string, unknown>) => void;
          getActiveWorkbook?: () => {
            setActiveSheet?: (sheetId: string) => void;
            save?: () => WorkbookPayload;
            getSnapshot?: () => WorkbookPayload;
          };
          dispose: () => void;
          Event?: {
            BeforeSheetEditEnd?: unknown;
            BeforeSheetEditStart?: unknown;
            CellClicked?: unknown;
            SheetEditEnded?: unknown;
          };
          addEvent?: (event: unknown, callback: (params: Record<string, unknown>) => void) => void;
        };
        eventApi.getFormula?.().setInitialFormulaComputing?.(CalculationMode.FORCED);
        eventApi.createWorkbook(preparedWorkbook, { makeCurrent: true });
        if (activeSheetId) {
          eventApi.getActiveWorkbook?.().setActiveSheet?.(activeSheetId);
        }
        eventApi.addEvent?.(eventApi.Event?.CellClicked, (params) => {
          const eventWorkbook = workbookSnapshotFromApi(eventApi) ?? workbook;
          const worksheet = params.worksheet as { getSheetId?: () => string; getName?: () => string } | undefined;
          const sheetId = resolveWorkbookSheetId(
            eventWorkbook,
            stringOrNull(worksheet?.getSheetId?.()) ?? stringOrNull(worksheet?.getName?.()),
          );
          const row = numberOrNull(params.row);
          const column = numberOrNull(params.column);
          if (sheetId && row !== null && column !== null) {
            onSelectRef.current({ sheetId, row, col: column });
          }
        });
        eventApi.addEvent?.(eventApi.Event?.BeforeSheetEditStart, (params) => {
          const eventWorkbook = workbookSnapshotFromApi(eventApi) ?? workbook;
          const worksheet = params.worksheet as { getSheetId?: () => string; getName?: () => string } | undefined;
          const sheetId = resolveWorkbookSheetId(
            eventWorkbook,
            stringOrNull(worksheet?.getSheetId?.()) ?? stringOrNull(worksheet?.getName?.()),
          );
          const row = numberOrNull(params.row);
          const column = numberOrNull(params.column);
          if (sheetId && row !== null && column !== null) {
            onSelectRef.current({ sheetId, row, col: column });
          }
        });
        eventApi.addEvent?.(eventApi.Event?.BeforeSheetEditEnd, (params) => {
          const eventWorkbook = workbookSnapshotFromApi(eventApi) ?? workbook;
          const worksheet = params.worksheet as { getSheetId?: () => string; getName?: () => string } | undefined;
          const sheetId = resolveWorkbookSheetId(
            eventWorkbook,
            stringOrNull(worksheet?.getSheetId?.()) ?? stringOrNull(worksheet?.getName?.()),
          );
          const row = numberOrNull(params.row);
          const column = numberOrNull(params.column);
          if (sheetId && row !== null && column !== null) {
            onSelectRef.current({ sheetId, row, col: column });
          }
          const editEvent =
            sheetId && row !== null && column !== null
              ? workbookEditEventFromUniverEnd(
                  workbook.sheets?.[sheetId] ? workbook : eventWorkbook,
                  { sheetId, row, column },
                  editedValueFromEvent(params),
                )
              : null;
          if (editEvent && editEvent.oldValue !== editEvent.newValue) {
            void Promise.resolve(onCommitEditRef.current(editEvent));
          }
        });
        eventApi.addEvent?.(eventApi.Event?.SheetEditEnded, (params) => {
          const eventWorkbook = workbookSnapshotFromApi(eventApi) ?? workbook;
          const worksheet = params.worksheet as { getSheetId?: () => string; getName?: () => string } | undefined;
          const sheetId = resolveWorkbookSheetId(
            eventWorkbook,
            stringOrNull(worksheet?.getSheetId?.()) ?? stringOrNull(worksheet?.getName?.()),
          );
          const row = numberOrNull(params.row);
          const column = numberOrNull(params.column);
          if (sheetId && row !== null && column !== null) {
            onSelectRef.current({ sheetId, row, col: column });
          }
        });
        dispose = () => eventApi.dispose();
        setUniverState("ready");
        paintTimer = window.setTimeout(() => {
          if (disposed || !containerRef.current) return;
          setPaintState(containerRef.current.querySelector("canvas") ? "painted" : "blank");
        }, 1600);
      } catch {
        if (!disposed) setUniverState("fallback");
      }
    }

    void bootUniver();
    return () => {
      disposed = true;
      if (paintTimer !== undefined) window.clearTimeout(paintTimer);
      dispose?.();
    };
  }, [preparedWorkbook, workbook]);

  const startEdit = (selection: WorkbookSelection, cell?: WorkbookCellPayload) => {
    setEditing(selection);
    setEditValue(displayValue(cell));
  };

  const commitEdit = async (cell?: WorkbookCellPayload) => {
    if (!activeSheet || !editing) return;
    const currentEditing = editing;
    const nextValue = editValue.trim();
    const editEvent = workbookEditEventFromCell(
      workbook,
      activeSheet,
      { row: currentEditing.row, column: currentEditing.col },
      cell,
      nextValue,
    );
    if (editEvent && editEvent.oldValue !== editEvent.newValue) {
      await onCommitEdit(editEvent);
    }
    setEditing(null);
    setEditValue("");
  };

  if (!activeSheet) {
    return <div className="p-4 text-[13px] text-[#818EA0]">No active sheet.</div>;
  }

  return (
    <div className="relative h-full min-h-[640px] bg-[#F7F8FA]">
      <div className="h-full min-h-[640px] w-full" ref={containerRef} data-testid="univer-workbook-host" />
      {univerState === "loading" && (
        <div className="absolute inset-x-4 top-4 flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-[12px] text-[#4F546B] shadow-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading spreadsheet engine
        </div>
      )}
      {univerState === "ready" && paintState === "blank" && (
        <div className="absolute left-4 top-4 max-w-sm rounded-md border bg-white px-3 py-2 text-[12px] text-[#4F546B] shadow-sm">
          The spreadsheet engine loaded, but the workbook canvas did not paint. Refresh the page or use the fallback grid.
        </div>
      )}
      <div className={univerState === "fallback" ? "absolute inset-0 overflow-auto bg-[#F7F8FA] p-4" : "sr-only"}>
        <table
          role="grid"
          aria-label={`${activeSheet.name} workbook editor`}
          className="w-full table-fixed border-collapse bg-white text-[12px]"
          style={{ minWidth: 40 + shape.cols * 108, boxShadow: "0 1px 2px rgba(15,23,42,0.08)" }}
        >
          <colgroup>
            <col style={{ width: 40 }} />
            {Array.from({ length: shape.cols }, (_, col) => (
              <col key={col} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 h-7 w-10 border bg-[#F7F8FA]" />
              {Array.from({ length: shape.cols }, (_, col) => (
                <th key={col} className="sticky top-0 z-10 h-7 min-w-[108px] border bg-[#F7F8FA] px-2 font-semibold text-[#818EA0]">
                  {columnName(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: shape.rows }, (_, row) => (
              <tr key={row}>
                <th className="sticky left-0 z-10 h-8 border bg-[#F7F8FA] px-2 text-right font-medium text-[#818EA0]">
                  {row + 1}
                </th>
                {Array.from({ length: shape.cols }, (_, col) => {
                  const cell = getCell(activeSheet, row, col);
                  const address = `${columnName(col)}${row + 1}`;
                  const active = selected.sheetId === activeSheetId && selected.row === row && selected.col === col;
                  const commentKey = `${activeSheet.name}!${address}`;
                  const hasOpenComment = commentIndicators.has(commentKey);
                  const editingCell =
                    editing !== null && editing.sheetId === activeSheetId && editing.row === row && editing.col === col;
                  const formula = !!cell?.f || !!cell?.diagnosis?.formula;
                  const hasDiagnosis = !!cell?.diagnosis;
                  const tone = diagnosisCellTone({
                    formula,
                    status: cell?.diagnosis?.status,
                    confidence: cell?.diagnosis?.confidence,
                    hasWarning: isActionableWarningSet(cell?.diagnosis?.warnings),
                  });
                  const style = cellToneStyle(tone, { active, hasDiagnosis, formula });
                  return (
                    <td
                      key={col}
                      role="gridcell"
                      aria-label={`${address} ${displayValue(cell)}`}
                      onClick={() => onSelect({ sheetId: activeSheetId ?? activeSheet.id ?? activeSheet.name, row, col })}
                      onDoubleClick={() => startEdit({ sheetId: activeSheetId ?? activeSheet.id ?? activeSheet.name, row, col }, cell)}
                      className="relative h-8 truncate border px-2"
                      style={{
                        borderColor: style.borderColor,
                        outline: active ? "2px solid #7B68EE" : undefined,
                        outlineOffset: -1,
                        background: style.background,
                        color: style.color,
                        textAlign: typeof cell?.v === "number" ? "right" : "left",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {hasOpenComment ? (
                        <span
                          aria-label={`${address} has open comments`}
                          className="absolute right-1 top-1 flex h-3 w-3 items-center justify-center rounded-full bg-[#7B68EE] text-white"
                        >
                          <MessageSquare className="h-2 w-2" aria-hidden="true" />
                        </span>
                      ) : null}
                      {editingCell ? (
                        <input
                          value={editValue}
                          onChange={(event) => setEditValue(event.target.value)}
                          onKeyDown={(event) => {
                            if (
                              shouldCommitCellDraftOnKey({
                                key: event.key,
                                draftValue: editValue,
                                editable: true,
                                pending: commitPending,
                              })
                            ) {
                              event.preventDefault();
                              void commitEdit(cell);
                            }
                          }}
                          className="absolute inset-0 bg-white px-2 text-right outline-none"
                          style={{ border: "1px solid #7B68EE", color: "#292D34" }}
                          autoFocus
                        />
                      ) : (
                        displayValue(cell)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function buildWorkbookCellIndex(workbook: WorkbookPayload) {
  const cells = new Map<string, IndexedCell>();
  for (const sheetId of workbook.sheetOrder ?? Object.keys(workbook.sheets ?? {})) {
    const sheet = workbook.sheets?.[sheetId];
    if (!sheet) continue;
    for (const [rowKey, row] of Object.entries(sheet.cellData ?? {})) {
      for (const [colKey, cell] of Object.entries(row)) {
        const rowIndex = Number(rowKey);
        const colIndex = Number(colKey);
        const address = columnName(colIndex) + String(rowIndex + 1);
        cells.set(cellKey(sheet.name, address), {
          sheetId,
          sheetName: sheet.name,
          row: rowIndex,
          col: colIndex,
          address,
          cell,
          meta: cell.diagnosis,
        });
      }
    }
  }
  return cells;
}

export function prepareWorkbookForUniver(workbook: WorkbookPayload): WorkbookPayload {
  const prepared: WorkbookPayload = {
    id: workbook.id,
    name: workbook.name,
    appVersion: workbook.appVersion,
    locale: workbook.locale,
    resources: Array.isArray(workbook.resources) ? workbook.resources : [],
    sheetOrder: [...(workbook.sheetOrder ?? [])],
    styles: { ...(isRecord(workbook.styles) ? workbook.styles : {}) },
    sheets: {},
  };
  const styles = prepared.styles as Record<string, unknown>;
  for (const [sheetId, sheet] of Object.entries(workbook.sheets ?? {})) {
    prepared.sheets![sheetId] = {
      ...sheet,
      defaultColumnWidth: readableDefaultColumnWidth(sheet.defaultColumnWidth),
      defaultRowHeight: readableDefaultRowHeight(sheet.defaultRowHeight),
      columnData: readableColumnData(sheet),
      rowData: readableRowData(sheet),
      cellData: styledCellData(sheet.cellData, styles),
    };
  }
  return prepared;
}

export function resolveWorkbookSheetId(
  workbook: WorkbookPayload,
  sheetIdentity: string | null | undefined,
) {
  if (!sheetIdentity) return null;
  if (workbook.sheets?.[sheetIdentity]) return sheetIdentity;
  const match = Object.entries(workbook.sheets ?? {}).find(([, sheet]) => sheet.name === sheetIdentity);
  return match?.[0] ?? null;
}

export function workbookCellFromUniverPosition(
  workbook: WorkbookPayload,
  position: { sheetId: string; row: number; column: number },
) {
  const sheet = workbook.sheets?.[position.sheetId];
  if (!sheet) return null;
  const cell = getCell(sheet, position.row, position.column);
  if (!cell) return null;
  return {
    sheetId: position.sheetId,
    sheetName: sheet.name,
    row: position.row,
    col: position.column,
    address: columnName(position.column) + String(position.row + 1),
    cell,
    meta: cell.diagnosis,
  };
}

export function workbookEditEventFromUniverEnd(
  workbook: WorkbookPayload,
  position: { sheetId: string; row: number; column: number },
  newValue: unknown,
): WorkbookEditEvent | null {
  const resolved = workbookCellFromUniverPosition(workbook, position);
  const sheet = workbook.sheets?.[position.sheetId];
  if (!sheet) return null;
  const nextValue = workbookEditValueToString(newValue);
  const oldCell = resolved?.cell;
  const oldValue = displayValue(oldCell);
  if (oldValue === nextValue) return null;
  const nextCell = workbookCellPayloadFromDraft(oldCell, nextValue);
  return buildWorkbookEditEvent({
    workbook: updateWorkbookCell(workbook, {
      sheetId: position.sheetId,
      row: position.row,
      column: position.column,
      cell: nextCell,
    }),
    sheetId: position.sheetId,
    sheetName: sheet.name,
    address: columnName(position.column) + String(position.row + 1),
    fieldId: oldCell?.diagnosis?.fieldId ?? null,
    oldCell: oldCell ?? null,
    newCell: nextCell,
    oldValue,
    newValue: nextValue,
  });
}

export function cellKey(sheetName: string, address: string) {
  return `${sheetName}!${address}`.toLowerCase();
}

function styledCellData(
  cellData: Record<string, Record<string, WorkbookCellPayload>> | undefined,
  styles: Record<string, unknown>,
) {
  const next: Record<string, Record<string, WorkbookCellPayload>> = {};
  for (const [rowKey, row] of Object.entries(cellData ?? {})) {
    next[rowKey] = {};
    for (const [colKey, cell] of Object.entries(row)) {
      const formula = !!cell.f || !!cell.diagnosis?.formula;
      const tone = diagnosisCellTone({
        formula,
        status: cell.diagnosis?.status,
        confidence: cell.diagnosis?.confidence,
        hasWarning: isActionableWarningSet(cell.diagnosis?.warnings),
      });
      const styleId = styleIdForTone(tone, formula, !!cell.diagnosis);
      const preparedCell: WorkbookCellPayload = {
        ...cell,
        ...(typeof cell.f === "string" ? { f: normalizeFormula(cell.f) } : {}),
        ...(styleId ? { s: ensureToneStyle(styles, styleId, tone, formula) } : {}),
      };
      if (formula) {
        delete preparedCell.v;
      }
      next[rowKey][colKey] = preparedCell;
    }
  }
  return next;
}

function normalizeFormula(formula: string) {
  return formula.startsWith("=") ? formula : `=${formula}`;
}

function readableDefaultColumnWidth(width: unknown) {
  return Math.max(numberOrNull(width) ?? MIN_COLUMN_WIDTH, MIN_COLUMN_WIDTH);
}

function readableDefaultRowHeight(height: unknown) {
  return Math.max(numberOrNull(height) ?? MIN_ROW_HEIGHT, MIN_ROW_HEIGHT);
}

function readableColumnData(sheet: WorkbookSheetPayload) {
  const next: Record<string, { w?: number; hd?: number; [key: string]: unknown }> = {};
  const inferredWidths = inferColumnWidths(sheet);
  const columnCount = Math.max(sheet.columnCount ?? 0, inferredWidths.size);
  for (let col = 0; col < columnCount; col += 1) {
    const existing = sheet.columnData?.[String(col)] ?? {};
    const existingWidth = numberOrNull(existing.w);
    const inferredWidth = inferredWidths.get(col) ?? MIN_COLUMN_WIDTH;
    next[String(col)] = {
      ...existing,
      w: clampWidth(Math.max(existingWidth ?? 0, inferredWidth, MIN_COLUMN_WIDTH)),
    };
  }
  for (const [col, existing] of Object.entries(sheet.columnData ?? {})) {
    if (next[col]) continue;
    next[col] = {
      ...existing,
      w: clampWidth(Math.max(numberOrNull(existing.w) ?? 0, MIN_COLUMN_WIDTH)),
    };
  }
  return next;
}

function readableRowData(sheet: WorkbookSheetPayload) {
  const next: Record<string, { h?: number; hd?: number; [key: string]: unknown }> = {};
  for (const [row, existing] of Object.entries(sheet.rowData ?? {})) {
    next[row] = {
      ...existing,
      h: Math.max(numberOrNull(existing.h) ?? MIN_ROW_HEIGHT, MIN_ROW_HEIGHT),
    };
  }
  return next;
}

function inferColumnWidths(sheet: WorkbookSheetPayload) {
  const widths = new Map<number, number>();
  for (const row of Object.values(sheet.cellData ?? {})) {
    for (const [colKey, cell] of Object.entries(row)) {
      const col = Number(colKey);
      if (!Number.isFinite(col)) continue;
      const text = displayValue(cell);
      if (!text) continue;
      const contentWidth = Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, text.length * 7 + 32));
      widths.set(col, Math.max(widths.get(col) ?? 0, contentWidth));
    }
  }
  return widths;
}

function clampWidth(width: number) {
  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, width));
}

function styleIdForTone(tone: DiagnosisTone, formula: boolean, hasDiagnosis: boolean) {
  if (tone === "candidate") return "diagnosis-candidate";
  if (tone === "low-confidence") return "diagnosis-low-confidence";
  if (tone === "edited") return "diagnosis-edited";
  if (tone === "formula" || formula) return "diagnosis-formula";
  if (hasDiagnosis) return "diagnosis-default";
  return null;
}

function ensureToneStyle(
  styles: Record<string, unknown>,
  styleId: string,
  tone: DiagnosisTone,
  formula: boolean,
) {
  if (!styles[styleId]) {
    const style = cellToneStyle(tone, { active: false, hasDiagnosis: true, formula });
    styles[styleId] = { bg: { rgb: style.background }, cl: { rgb: style.color } };
  }
  return styleId;
}

function sheetShape(sheet?: WorkbookSheetPayload) {
  if (!sheet) return { rows: 0, cols: 0 };
  let maxRow = Math.min(sheet.rowCount ?? MAX_VISIBLE_ROWS, MAX_VISIBLE_ROWS);
  let maxCol = Math.min(sheet.columnCount ?? MAX_VISIBLE_COLS, MAX_VISIBLE_COLS);
  for (const [rowKey, row] of Object.entries(sheet.cellData ?? {})) {
    maxRow = Math.min(Math.max(maxRow, Number(rowKey) + 1), MAX_VISIBLE_ROWS);
    for (const colKey of Object.keys(row)) {
      maxCol = Math.min(Math.max(maxCol, Number(colKey) + 1), MAX_VISIBLE_COLS);
    }
  }
  return { rows: Math.max(maxRow, 20), cols: Math.max(maxCol, 8) };
}

function getCell(sheet: WorkbookSheetPayload, row: number, col: number): WorkbookCellPayload | undefined {
  return sheet.cellData?.[String(row)]?.[String(col)];
}

function workbookEditEventFromCell(
  workbook: WorkbookPayload,
  sheet: WorkbookSheetPayload,
  position: { row: number; column: number },
  cell: WorkbookCellPayload | undefined,
  newValue: string,
): WorkbookEditEvent | null {
  const sheetId = sheet.id ?? sheet.name;
  const address = columnName(position.column) + String(position.row + 1);
  const oldValue = displayValue(cell);
  if (oldValue === newValue) {
    return null;
  }
  const nextCell = workbookCellPayloadFromDraft(cell, newValue);
  return buildWorkbookEditEvent({
    workbook: updateWorkbookCell(workbook, { sheetId, row: position.row, column: position.column, cell: nextCell }),
    sheetId,
    sheetName: sheet.name,
    address,
    fieldId: cell?.diagnosis?.fieldId ?? null,
    oldCell: cell ?? null,
    newCell: nextCell,
    oldValue,
    newValue,
  });
}

function buildWorkbookEditEvent({
  workbook,
  sheetId,
  sheetName,
  address,
  fieldId,
  oldCell,
  newCell,
  oldValue,
  newValue,
}: {
  workbook: WorkbookPayload;
  sheetId: string;
  sheetName: string;
  address: string;
  fieldId?: string | null;
  oldCell?: WorkbookCellPayload | null;
  newCell?: WorkbookCellPayload | null;
  oldValue: string;
  newValue: string;
}): WorkbookEditEvent {
  return {
    workbook,
    sheetId,
    sheetName,
    address,
    fieldId,
    oldCell,
    newCell,
    oldValue,
    newValue,
    note: "Saved from workbook editor.",
  };
}

function isBackendReviewCell(cell?: WorkbookCellPayload) {
  return !!cell?.diagnosis?.fieldId && cell.diagnosis.editable !== false && !cell.f && !cell.diagnosis.formula;
}

function isNumericReviewEdit(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("=")) return false;
  const cleaned = trimmed
    .replace(/[−–—]/g, "-")
    .replace(/,/g, "")
    .replace(/^\((.*)\)$/, "-$1")
    .replace(/%$/, "");
  return cleaned !== "" && cleaned !== "-" && Number.isFinite(Number(cleaned));
}

function workbookCellPayloadFromDraft(
  cell: WorkbookCellPayload | undefined,
  draftValue: string,
): WorkbookCellPayload {
  const next: WorkbookCellPayload = { ...(cell ?? {}) };
  if (draftValue.startsWith("=")) {
    next.f = draftValue;
    next.v = null;
  } else {
    delete next.f;
    next.v = numericCellValue(draftValue) ?? draftValue;
  }
  return next;
}

function updateWorkbookCell(
  workbook: WorkbookPayload,
  update: { sheetId: string; row: number; column: number; cell: WorkbookCellPayload },
): WorkbookPayload {
  const next = structuredCloneSafe(workbook);
  const sheet = next.sheets?.[update.sheetId];
  if (!sheet) return next;
  sheet.cellData = sheet.cellData ?? {};
  sheet.cellData[String(update.row)] = sheet.cellData[String(update.row)] ?? {};
  sheet.cellData[String(update.row)][String(update.column)] = update.cell;
  return next;
}

function numericCellValue(value: string): number | null {
  if (!isNumericReviewEdit(value)) return null;
  const cleaned = value
    .replace(/[−–—]/g, "-")
    .replace(/,/g, "")
    .replace(/^\((.*)\)$/, "-$1")
    .replace(/%$/, "");
  return Number(cleaned);
}

function structuredCloneSafe<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function displayValue(cell?: WorkbookCellPayload) {
  if (!cell) return "";
  const value = cell.v;
  if (value === null || value === undefined) {
    return cell.f ? (cell.f.startsWith("=") ? cell.f : `=${cell.f}`) : "";
  }
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

function workbookEditValueToString(value: unknown): string {
  const scalar = scalarWorkbookEditValue(value);
  const text = typeof scalar === "string" ? scalar : String(scalar ?? "");
  return stripUniverDocumentMarkers(text).trim();
}

function scalarWorkbookEditValue(value: unknown): unknown {
  if (!isRecord(value)) return value;
  if (typeof value.toPlainText === "function") {
    return value.toPlainText();
  }
  if (typeof value.getData === "function") {
    return dataStreamFromDocumentData(value.getData());
  }
  const dataStream = dataStreamFromDocumentData(value);
  if (dataStream !== null) return dataStream;
  if ("v" in value) return value.v;
  if ("value" in value) return value.value;
  if ("rawValue" in value) return value.rawValue;
  if ("text" in value) return value.text;
  return "";
}

function dataStreamFromDocumentData(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const body = value.body;
  if (!isRecord(body)) return null;
  return typeof body.dataStream === "string" ? body.dataStream : null;
}

function stripUniverDocumentMarkers(value: string) {
  return value.replace(/[\r\n\0]+$/g, "");
}

function columnName(index: number) {
  let name = "";
  let current = index + 1;
  while (current > 0) {
    const mod = (current - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    current = Math.floor((current - mod) / 26);
  }
  return name;
}

function cellToneStyle(
  tone: DiagnosisTone,
  flags: { active: boolean; hasDiagnosis: boolean; formula: boolean },
) {
  if (flags.active) {
    return { background: "#F5F3FF", color: "#292D34", borderColor: "#7B68EE" };
  }
  if (tone === "candidate") {
    return { background: "#FFF5F5", color: "#991B1B", borderColor: "#FCA5A5" };
  }
  if (tone === "low-confidence") {
    return { background: "#FFFBEB", color: "#92400E", borderColor: "#FCD34D" };
  }
  if (tone === "edited") {
    return { background: "#EFF6FF", color: "#1D4ED8", borderColor: "#93C5FD" };
  }
  if (tone === "formula" || flags.formula) {
    return { background: "#F9FAFB", color: "#374151", borderColor: "#E5E7EB" };
  }
  return {
    background: flags.hasDiagnosis ? "#F8FBFF" : "#fff",
    color: flags.hasDiagnosis ? "#1D4ED8" : "#4F546B",
    borderColor: "#E3E6EA",
  };
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function editedValueFromEvent(params: Record<string, unknown>) {
  if ("value" in params) return params.value;
  if ("newValue" in params) return params.newValue;
  if ("text" in params) return params.text;
  if ("rawValue" in params) return params.rawValue;
  return "";
}

function workbookSnapshotFromApi(api: {
  getActiveWorkbook?: () => {
    save?: () => WorkbookPayload;
    getSnapshot?: () => WorkbookPayload;
  };
}) {
  const activeWorkbook = api.getActiveWorkbook?.();
  return activeWorkbook?.save?.() ?? activeWorkbook?.getSnapshot?.() ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
