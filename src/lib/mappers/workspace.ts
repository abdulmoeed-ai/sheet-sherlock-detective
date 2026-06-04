import type { WorkspaceResponse } from "@/lib/api/types";

type LooseRecord = Record<string, unknown>;

export interface ReviewRow {
  fieldId: string;
  cell: string;
  sheet: string;
  field: string;
  oldValue: string;
  newValue: string;
  source: string;
  confidence: number;
  status: string;
  raw: LooseRecord;
}

export interface WorkbookSheet {
  name: string;
  rows: unknown[];
}

export interface AuditRow {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  payload?: LooseRecord;
}

export interface DashboardMetric {
  label: string;
  value: string;
  delta?: string;
}

export function reviewRows(workspace?: Partial<WorkspaceResponse> | null): ReviewRow[] {
  const review = recordOrEmpty(workspace?.review);
  const candidates = firstArray(
    review.rows,
    review.cells,
    review.reviewCells,
    review.diffRows,
    review.changes,
    review.items,
  );
  return candidates.map((row, index) => ({
    fieldId: stringValue(row.fieldId ?? row.id, `row-${index}`),
    cell: stringValue(row.templateCell ?? row.cell ?? row.cellRef ?? row.address, "n/a"),
    sheet: stringValue(row.sheetName ?? row.sheet ?? row.statement, "Model"),
    field: stringValue(row.label ?? row.field ?? row.name, "Field"),
    oldValue: stringValue(
      row.oldValue ?? row.previousValue ?? row.originalValue ?? row.valueBefore,
      "-",
    ),
    newValue: stringValue(row.newValue ?? row.value ?? row.normalizedValue ?? row.valueAfter, "-"),
    source: stringValue(row.sourceName ?? row.source ?? row.documentName, "Backend"),
    confidence: numberValue(row.confidence ?? row.confidenceScore, 0),
    status: stringValue(row.status ?? row.reviewStatus, "pending"),
    raw: row,
  }));
}

export function workbookSheets(workspace?: Partial<WorkspaceResponse> | null): WorkbookSheet[] {
  const preview = recordOrEmpty(workspace?.exportPreview);
  const workbookData = preview.workbookData ?? preview.workbook ?? preview.sheets;
  if (Array.isArray(workbookData)) {
    return workbookData.map((sheet, index) => {
      const sheetRecord = recordOrEmpty(sheet);
      return {
        name: stringValue(sheetRecord.name ?? sheetRecord.sheetName, `Sheet ${index + 1}`),
        rows: Array.isArray(sheetRecord.rows)
          ? sheetRecord.rows
          : Array.isArray(sheetRecord.data)
            ? sheetRecord.data
            : [],
      };
    });
  }
  if (workbookData && typeof workbookData === "object") {
    return Object.entries(workbookData).map(([name, rows]) => ({
      name,
      rows: Array.isArray(rows) ? rows : [],
    }));
  }
  return [];
}

export function auditRows(workspace?: Partial<WorkspaceResponse> | null): AuditRow[] {
  return (workspace?.auditEvents ?? []).map((event, index) => ({
    id: stringValue(event.id, `event-${index}`),
    timestamp: stringValue(event.createdAt ?? event.timestamp ?? event.t, ""),
    actor: stringValue(event.actor ?? event.user ?? event.actorName, "system"),
    action: stringValue(event.action ?? event.message ?? event.description, "Event recorded"),
    payload: isRecord(event.payload) ? event.payload : undefined,
  }));
}

export function dashboardMetrics(workspace?: Partial<WorkspaceResponse> | null): DashboardMetric[] {
  const dashboard = recordOrEmpty(workspace?.dashboard);
  const candidates = firstArray(
    dashboard.metrics,
    dashboard.kpis,
    dashboard.cards,
    dashboard.summary,
  );
  return candidates.map((metric, index) => ({
    label: stringValue(metric.label ?? metric.name ?? metric.title, `Metric ${index + 1}`),
    value: stringValue(metric.value ?? metric.amount ?? metric.current, "-"),
    delta: metric.delta === undefined ? undefined : stringValue(metric.delta, undefined),
  }));
}

function firstArray(...values: unknown[]): LooseRecord[] {
  for (const value of values) {
    if (Array.isArray(value)) return value.filter(isRecord);
  }
  return [];
}

function stringValue(value: unknown, fallback: string): string;
function stringValue(value: unknown, fallback: undefined): string | undefined;
function stringValue(value: unknown, fallback: string | undefined): string | undefined {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function numberValue(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function recordOrEmpty(value: unknown): LooseRecord {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is LooseRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
