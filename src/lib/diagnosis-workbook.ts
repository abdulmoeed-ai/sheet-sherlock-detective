import type { SourceBoundingBox } from "@/components/DiagnosisSourcePreviewModal";
import type { ReviewCommentResponse } from "@/lib/api/types";
import { commentTargetKey, type CommentTarget } from "@/lib/comments";

export type CellPayload = {
  v?: unknown;
  f?: string;
  diagnosis?: DiagnosisMeta;
};

export type SheetPayload = {
  id?: string;
  name: string;
  rowCount?: number;
  columnCount?: number;
  cellData?: Record<string, Record<string, CellPayload>>;
};

export type WorkbookPayload = {
  workbookName?: string;
  templateName?: string;
  templatePath?: string;
  sheetOrder?: string[];
  sheets?: Record<string, SheetPayload>;
  summary?: Record<string, number>;
  exportWarnings?: {
    unresolvedIssues?: number;
    lowConfidence?: number;
    blocked?: number;
    missing?: number;
    actionableWarnings?: number;
  };
};

export type DiagnosisMeta = {
  sheetName?: string;
  address?: string;
  value?: string;
  formula?: boolean;
  editable?: boolean;
  fieldId?: string;
  label?: string;
  period?: string;
  noteReference?: string | null;
  sourceDocumentId?: string | null;
  documentFilename?: string | null;
  pdfPageIndex?: number | null;
  printedPageNumber?: number | null;
  sourceText?: string | null;
  boundingBox?: SourceBoundingBox | null;
  confidence?: number | null;
  confidenceScore?: string | null;
  confidenceLevel?: string | null;
  confidenceReasonCodes?: string[];
  confidenceReasons?: string[];
  matchMethod?: string | null;
  status?: string;
  ruleIds?: string[];
  warnings?: string[];
  llmReview?: Record<string, unknown> | null;
  termStandardization?: Record<string, unknown> | null;
  history?: Array<Record<string, unknown>>;
  commentsSummary?: { total?: number; open?: number; comments?: ReviewCommentResponse[] };
  diagnosisCandidates?: Array<Record<string, unknown>>;
  templateCell?: string;
};

export type Selection = { sheetId: string; row: number; col: number };

export type OptimisticCellUpdate = {
  fieldId: string;
  displayValue: string;
  workbookValue: string | number;
  history: Array<Record<string, unknown>>;
};

const MAX_VISIBLE_ROWS = 90;
const MAX_VISIBLE_COLS = 14;

export function workbookPayload(value: unknown): WorkbookPayload | null {
  if (!isRecord(value)) return null;
  const workbook = isRecord(value.workbookData) ? value.workbookData : value;
  if (!isRecord(workbook.sheets)) return null;
  return workbook as WorkbookPayload;
}

export function resolveSelection(
  selection: Selection | null,
  sheetId: string | undefined,
  sheet?: SheetPayload,
): Selection {
  if (!sheetId || !sheet) return { sheetId: sheetId ?? "", row: 0, col: 0 };
  if (selection?.sheetId === sheetId) return selection;
  const shape = sheetShape(sheet);
  for (let row = 0; row < shape.rows; row++) {
    for (let col = 0; col < shape.cols; col++) {
      if (getCell(sheet, row, col)?.diagnosis) return { sheetId, row, col };
    }
  }
  return { sheetId, row: 0, col: 0 };
}

export function sheetShape(sheet?: SheetPayload) {
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

export function getCell(sheet: SheetPayload, row: number, col: number): CellPayload | undefined {
  return sheet.cellData?.[String(row)]?.[String(col)];
}

export function sheetCells(sheet?: SheetPayload): CellPayload[] {
  return Object.values(sheet?.cellData ?? {}).flatMap((row) => Object.values(row));
}

export function buildFieldIdCellKeys(workbook: WorkbookPayload | null) {
  const keys = new Map<string, string>();
  const duplicateFieldIds = new Set<string>();
  for (const sheetId of workbook?.sheetOrder ?? Object.keys(workbook?.sheets ?? {})) {
    const sheet = workbook?.sheets?.[sheetId];
    if (!sheet) continue;
    for (const [rowKey, row] of Object.entries(sheet.cellData ?? {})) {
      const rowIndex = Number(rowKey);
      if (!Number.isFinite(rowIndex)) continue;
      for (const [colKey, cell] of Object.entries(row)) {
        const colIndex = Number(colKey);
        const fieldId = cell.diagnosis?.fieldId;
        if (!fieldId || !Number.isFinite(colIndex)) continue;
        const address = `${columnName(colIndex)}${rowIndex + 1}`;
        const key = commentTargetKey(sheet.name, address);
        if (keys.has(fieldId) && keys.get(fieldId) !== key) {
          duplicateFieldIds.add(fieldId);
          keys.delete(fieldId);
          continue;
        }
        if (!duplicateFieldIds.has(fieldId)) {
          keys.set(fieldId, key);
        }
      }
    }
  }
  return keys;
}

export function firstSheetWithDiagnosis(workbook: WorkbookPayload | null, sheetIds: string[]) {
  for (const sheetId of sheetIds) {
    if (sheetCells(workbook?.sheets?.[sheetId]).some((cell) => !!cell.diagnosis)) {
      return sheetId;
    }
  }
  return null;
}

export function displayValue(cell?: CellPayload) {
  if (!cell) return "";
  const value = cell.v;
  if (value === null || value === undefined) return cell.f ? `=${cell.f}` : "";
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

export function optimisticCell(
  cell: CellPayload | undefined,
  optimisticCells: Record<string, OptimisticCellUpdate>,
): CellPayload | undefined {
  const fieldId = cell?.diagnosis?.fieldId;
  const update = fieldId ? optimisticCells[fieldId] : undefined;
  if (!cell || !update) return cell;
  return {
    ...cell,
    v: update.workbookValue,
    diagnosis: {
      ...cell.diagnosis,
      value: update.displayValue,
      status: "edited",
      history: update.history,
    },
  };
}

export function buildOptimisticCellUpdate({
  fieldId,
  draftValue,
  oldValue,
  existingHistory,
  currentUser,
}: {
  fieldId: string;
  draftValue: string;
  oldValue: string;
  existingHistory?: Array<Record<string, unknown>>;
  currentUser?: { id?: string | null; name?: string | null } | null;
}): OptimisticCellUpdate {
  return {
    fieldId,
    displayValue: draftValue,
    workbookValue: workbookValueFromDraft(draftValue),
    history: [
      {
        id: `${fieldId}-optimistic-${Date.now()}`,
        action: "edit",
        actor: currentUser?.id ?? "optimistic",
        actorDisplayName: currentUser?.name ?? "Analyst",
        oldValue,
        newValue: draftValue,
        oldStatus: "pending",
        newStatus: "edited",
        note: "Saved from Diagnosis draft.",
        createdAt: new Date().toISOString(),
      },
      ...(existingHistory ?? []),
    ],
  };
}

export function buildConfirmedCellUpdate(
  fieldId: string,
  response: Record<string, unknown>,
  fallback: OptimisticCellUpdate,
): OptimisticCellUpdate {
  const history = Array.isArray(response.history)
    ? response.history.filter((entry): entry is Record<string, unknown> => isRecord(entry))
    : fallback.history;
  const displayValue =
    response.value === null || response.value === undefined ? fallback.displayValue : String(response.value);

  return {
    fieldId,
    displayValue,
    workbookValue: workbookValueFromDraft(displayValue),
    history,
  };
}

export function workbookValueFromDraft(value: string) {
  const trimmed = value.trim();
  const accountingNegative = trimmed.startsWith("(") && trimmed.endsWith(")");
  const normalized = trimmed.replace(/[(),]/g, "");
  const numeric = Number(normalized);
  if (!Number.isNaN(numeric) && normalized !== "") {
    return accountingNegative ? -numeric : numeric;
  }
  return trimmed;
}

export function isNumericDraft(value: string) {
  return typeof workbookValueFromDraft(value) === "number";
}

export function removeOptimisticCell(
  updates: Record<string, OptimisticCellUpdate>,
  fieldId: string,
) {
  const next = { ...updates };
  delete next[fieldId];
  return next;
}

export function buildCommentTarget({
  meta,
  sheetName,
  selectedCellAddress,
}: {
  meta?: DiagnosisMeta;
  sheetName?: string;
  selectedCellAddress: string;
}): CommentTarget {
  return {
    fieldId: meta?.fieldId ?? null,
    sheetName: sheetName ?? meta?.sheetName ?? null,
    templateCell: meta?.templateCell ?? meta?.address ?? selectedCellAddress,
  };
}

export function commentTargetFromComment(comment: ReviewCommentResponse): CommentTarget {
  return {
    fieldId: comment.fieldId,
    sheetName: comment.sheetName,
    templateCell: comment.templateCell,
  };
}

export function formatCommentDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

export function stringValue(value: unknown, fallback: string) {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
