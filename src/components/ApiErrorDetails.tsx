import { AlertTriangle } from "lucide-react";
import { ApiError } from "@/lib/api/errors";

type JsonRecord = Record<string, unknown>;

export function ApiErrorDetails({
  error,
  fallback = "Request failed.",
}: {
  error: unknown;
  fallback?: string;
}) {
  const details = describeError(error, fallback);

  return (
    <div className="rounded-md bg-[var(--color-danger-bg)] px-3 py-2 text-[13px] text-[var(--color-danger-fg)]">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <div className="font-semibold">{details.message}</div>
          {details.rows.length > 0 ? (
            <dl className="mt-2 space-y-1 text-[12px]">
              {details.rows.map((row) => (
                <div key={row.label} className="grid grid-cols-[140px_1fr] gap-2">
                  <dt className="font-semibold text-[var(--color-danger-fg)]">{row.label}</dt>
                  <dd className="break-words">{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function describeError(error: unknown, fallback: string) {
  const payload = error instanceof ApiError ? error.payload : null;
  const detail = isRecord(payload) ? payload.detail : null;
  const message =
    stringValue(detail) ??
    (isRecord(detail) ? stringValue(detail.message) : undefined) ??
    (error instanceof Error ? error.message : undefined) ??
    fallback;
  const rows: Array<{ label: string; value: string }> = [];

  if (error instanceof ApiError) {
    rows.push({ label: "Status", value: String(error.status) });
  }

  if (isRecord(detail)) {
    appendRow(rows, "Workbook check", detail.threeStatementCheck ?? detail.three_statement_check);
    appendRow(rows, "Blocking cells", detail.blockingCells ?? detail.blocking_cells);
    appendRow(rows, "Rejected rows", detail.rejectedRows ?? detail.rejected_rows);
    appendRow(rows, "Rules hash", detail.rulesHash ?? detail.rules_hash);
    appendRow(rows, "Hint", detail.hint);
  }

  return { message, rows };
}

function appendRow(rows: Array<{ label: string; value: string }>, label: string, value: unknown) {
  const formatted = formatValue(value);
  if (formatted) rows.push({ label, value: formatted });
}

function formatValue(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => formatValue(item) ?? "").join(", ");
  return JSON.stringify(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
