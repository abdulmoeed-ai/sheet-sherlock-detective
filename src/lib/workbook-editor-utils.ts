import {
  diagnosisCellTone,
  isActionableWarningSet,
  type DiagnosisTone,
} from "@/lib/diagnosis-cell";
import type { CellCommentIndicator } from "@/lib/comments";

export type WorkbookCellMeta = {
  sheetName?: string;
  address?: string;
  editable?: boolean;
  formula?: boolean;
  fieldId?: string;
  status?: string;
  confidence?: number | null;
  confidenceLevel?: string | null;
  templateCell?: string;
  warnings?: string[];
  value?: unknown;
  [key: string]: unknown;
};

export type WorkbookCellPayload = {
  v?: unknown;
  cachedV?: unknown;
  f?: string;
  formulaValueStatus?: string;
  diagnosis?: WorkbookCellMeta;
  s?: string;
  markers?: Record<string, unknown>;
};

export type WorkbookSheetPayload = {
  id?: string;
  name: string;
  rowCount?: number;
  columnCount?: number;
  showGridlines?: number;
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
const FINANCE_NUMBER_FORMAT = "#,##0;(#,##0);0";
const COMMENT_MARKER_COLOR = "#7B68EE";
const COMMENT_MARKER_SIZE = 8;
const EMPTY_COMMENT_INDICATORS = new Map<string, CellCommentIndicator>();

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

export function prepareWorkbookForUniver(
  workbook: WorkbookPayload,
  commentIndicators: Map<string, CellCommentIndicator> = EMPTY_COMMENT_INDICATORS,
): WorkbookPayload {
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
      showGridlines: 1,
      defaultColumnWidth: readableDefaultColumnWidth(sheet.defaultColumnWidth),
      defaultRowHeight: readableDefaultRowHeight(sheet.defaultRowHeight),
      columnData: readableColumnData(sheet),
      rowData: readableRowData(sheet),
      cellData: styledCellData(sheet.cellData, styles, sheet.name, commentIndicators),
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
  const match = Object.entries(workbook.sheets ?? {}).find(
    ([, sheet]) => sheet.name === sheetIdentity,
  );
  return match?.[0] ?? null;
}

export function selectionFromUniverSelectionEvent(
  workbook: WorkbookPayload,
  params: Record<string, unknown>,
): WorkbookSelection | null {
  const worksheet = params.worksheet as
    | { getSheetId?: () => string; getName?: () => string }
    | undefined;
  const sheetId = resolveWorkbookSheetId(
    workbook,
    stringOrNull(worksheet?.getSheetId?.()) ?? stringOrNull(worksheet?.getName?.()),
  );
  const selections = Array.isArray(params.selections) ? params.selections : [];
  const firstSelection = selections[0];
  if (!sheetId || !isRecord(firstSelection)) return null;
  const row = numberOrNull(firstSelection.startRow);
  const column = numberOrNull(firstSelection.startColumn);
  if (row === null || column === null) return null;
  return { sheetId, row, col: column };
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

export function sheetShape(sheet?: WorkbookSheetPayload) {
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

export function getCell(
  sheet: WorkbookSheetPayload,
  row: number,
  col: number,
): WorkbookCellPayload | undefined {
  return sheet.cellData?.[String(row)]?.[String(col)];
}

export function workbookEditEventFromCell(
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
    workbook: updateWorkbookCell(workbook, {
      sheetId,
      row: position.row,
      column: position.column,
      cell: nextCell,
    }),
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

export function displayValue(cell?: WorkbookCellPayload) {
  if (!cell) return "";
  const value = cell.v;
  if (value === null || value === undefined) {
    return cell.f ? (cell.f.startsWith("=") ? cell.f : `=${cell.f}`) : "";
  }
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

export function columnName(index: number) {
  let name = "";
  let current = index + 1;
  while (current > 0) {
    const mod = (current - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    current = Math.floor((current - mod) / 26);
  }
  return name;
}

export function cellToneStyle(
  tone: DiagnosisTone,
  flags: { active: boolean; hasDiagnosis: boolean; formula: boolean },
) {
  if (flags.active) {
    return { background: "#F5F3FF", color: "#292D34", borderColor: "#7B68EE" };
  }
  if (tone === "candidate") {
    return { background: "#FFF5F5", color: "#991B1B", borderColor: "#FCA5A5" };
  }
  if (tone === "high-confidence") {
    return { background: "#F0FDF4", color: "#166534", borderColor: "#86EFAC" };
  }
  if (tone === "medium-confidence") {
    return { background: "#FFFBEB", color: "#92400E", borderColor: "#FCD34D" };
  }
  if (tone === "low-confidence") {
    return { background: "#FEF2F2", color: "#991B1B", borderColor: "#FCA5A5" };
  }
  if (tone === "blocked-confidence") {
    return { background: "#F3F4F6", color: "#374151", borderColor: "#9CA3AF" };
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

export function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

export function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function editedValueFromEvent(params: Record<string, unknown>) {
  if ("value" in params) return params.value;
  if ("newValue" in params) return params.newValue;
  if ("text" in params) return params.text;
  if ("rawValue" in params) return params.rawValue;
  return "";
}

export function workbookSnapshotFromApi(api: {
  getActiveWorkbook?: () => {
    save?: () => WorkbookPayload;
    getSnapshot?: () => WorkbookPayload;
  };
}) {
  const activeWorkbook = api.getActiveWorkbook?.();
  return activeWorkbook?.save?.() ?? activeWorkbook?.getSnapshot?.() ?? null;
}

function styledCellData(
  cellData: Record<string, Record<string, WorkbookCellPayload>> | undefined,
  styles: Record<string, unknown>,
  sheetName: string,
  commentIndicators: Map<string, CellCommentIndicator>,
) {
  const next: Record<string, Record<string, WorkbookCellPayload>> = {};
  for (const [rowKey, row] of Object.entries(cellData ?? {})) {
    next[rowKey] = {};
    for (const [colKey, cell] of Object.entries(row)) {
      const rowIndex = Number(rowKey);
      const colIndex = Number(colKey);
      const address =
        Number.isFinite(rowIndex) && Number.isFinite(colIndex)
          ? `${columnName(colIndex)}${rowIndex + 1}`
          : "";
      const hasCommentIndicator = !!address && commentIndicators.has(`${sheetName}!${address}`);
      const formula = !!cell.f || !!cell.diagnosis?.formula;
      const tone = diagnosisCellTone({
        formula,
        status: cell.diagnosis?.status,
        confidence: cell.diagnosis?.confidence,
        confidenceLevel: cell.diagnosis?.confidenceLevel,
        hasWarning: isActionableWarningSet(cell.diagnosis?.warnings),
      });
      const styleId = styleIdForTone(tone, formula, !!cell.diagnosis);
      const preparedCell: WorkbookCellPayload = {
        ...cell,
        ...(typeof cell.f === "string" ? { f: normalizeFormula(cell.f) } : {}),
        ...(styleId ? { s: ensureToneStyle(styles, styleId, tone, formula) } : {}),
        ...(hasCommentIndicator
          ? {
              markers: {
                ...(isRecord(cell.markers) ? cell.markers : {}),
                tr: {
                  color: COMMENT_MARKER_COLOR,
                  size: COMMENT_MARKER_SIZE,
                },
                tl: {
                  color: COMMENT_MARKER_COLOR,
                  size: COMMENT_MARKER_SIZE,
                },
              },
            }
          : {}),
      };
      if (
        formula &&
        cell.diagnosis &&
        "value" in cell.diagnosis &&
        cell.formulaValueStatus !== "blank_precedents"
      ) {
        preparedCell.v = workbookDisplayValue(cell.diagnosis.value);
      }
      next[rowKey][colKey] = preparedCell;
    }
  }
  return next;
}

function workbookDisplayValue(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  const normalized = trimmed.replace(/[−–—]/g, "-").replace(/,/g, "");
  const accountingNegative = normalized.match(/^\(([-+]?\d+(?:\.\d+)?)\)$/);
  const numericText = accountingNegative ? `-${accountingNegative[1]}` : normalized;
  const numericValue = Number(numericText);
  return Number.isFinite(numericValue) ? numericValue : value;
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
      const contentWidth = Math.min(
        MAX_COLUMN_WIDTH,
        Math.max(MIN_COLUMN_WIDTH, text.length * 7 + 32),
      );
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
  if (tone === "high-confidence") return "diagnosis-high-confidence";
  if (tone === "medium-confidence") return "diagnosis-medium-confidence";
  if (tone === "blocked-confidence") return "diagnosis-blocked-confidence";
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
  const existingStyle = styles[styleId];
  if (isRecord(existingStyle)) {
    styles[styleId] = {
      ...existingStyle,
      n: { pattern: FINANCE_NUMBER_FORMAT },
    };
  } else {
    const style = cellToneStyle(tone, { active: false, hasDiagnosis: true, formula });
    styles[styleId] = {
      bg: { rgb: style.background },
      cl: { rgb: style.color },
      n: { pattern: FINANCE_NUMBER_FORMAT },
    };
  }
  return styleId;
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

function structuredCloneSafe<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
