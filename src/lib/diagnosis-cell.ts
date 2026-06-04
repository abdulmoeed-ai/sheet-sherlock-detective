export type DiagnosisTone = "candidate" | "low-confidence" | "edited" | "formula" | "normal";
export type RuleTooltipMetadata = {
  code?: unknown;
  title?: unknown;
  category?: unknown;
  severity?: unknown;
  description?: unknown;
};

export function diagnosisCellTone({
  formula,
  status,
  confidence,
  hasWarning = false,
}: {
  formula: boolean;
  status?: string | null;
  confidence?: number | null;
  hasWarning?: boolean;
}): DiagnosisTone {
  if (hasWarning) return "candidate";
  if (formula) return "formula";
  if ((status ?? "").toLowerCase() === "edited") return "edited";
  if (typeof confidence === "number" && confidence > 0 && confidence < 70) return "low-confidence";
  return "normal";
}

export function historyValue(entry: Record<string, unknown>): string {
  const value = entry.value ?? entry.newValue;
  return value === null || value === undefined ? "" : String(value);
}

export function warningDetails(warning: string) {
  if (warning === "comparative_year") {
    return {
      label: "Comparative-year source column",
      description: "This value was extracted from the prior-year/comparative column in the PDF table. It is informational, not an error.",
      actionable: false,
    };
  }

  return {
    label: humanizeKey(warning),
    description: "Review this extraction warning before sign-off.",
    actionable: true,
  };
}

export function isActionableWarningSet(warnings: string[] | undefined | null): boolean {
  return (warnings ?? []).some((warning) => warningDetails(warning).actionable);
}

export function sheetNeedsAttention(
  cells: Array<{ diagnosis?: { warnings?: string[] | null } | null }>,
): boolean {
  return cells.some((cell) => isActionableWarningSet(cell.diagnosis?.warnings));
}

export function ruleTooltipDetails(
  code: string,
  rulesByCode: Record<string, RuleTooltipMetadata | undefined>,
) {
  const rule = rulesByCode[code];
  if (!rule) {
    return {
      code,
      title: "Rule metadata unavailable",
      category: "-",
      severity: "-",
      description: "This rule code was attached to the cell, but the current mapping-rule manifest did not include details for it.",
      missing: true,
    };
  }

  return {
    code,
    title: stringValue(rule.title, "Untitled rule"),
    category: stringValue(rule.category, "-"),
    severity: stringValue(rule.severity, "-"),
    description: stringValue(rule.description, "No rule description available."),
    missing: false,
  };
}

export function orderedHistoryEntries<T extends Record<string, unknown>>(entries: T[]): T[] {
  return [...entries].sort((left, right) => {
    const leftSource = String(left.action ?? "").toLowerCase() === "source";
    const rightSource = String(right.action ?? "").toLowerCase() === "source";
    if (leftSource !== rightSource) return leftSource ? 1 : -1;
    return historyTime(right.createdAt) - historyTime(left.createdAt);
  });
}

export function shouldCommitCellDraftOnKey({
  key,
  draftValue,
  editable,
  pending,
}: {
  key: string;
  draftValue: string;
  editable: boolean;
  pending: boolean;
}) {
  return key === "Enter" && editable && !pending && draftValue.trim() !== "";
}

type HistoryFormatContext = {
  currentUser?: { id?: string | null; name?: string | null } | null;
};

export function formatHistoryEntry(entry: Record<string, unknown>, context: HistoryFormatContext = {}) {
  const action = stringValue(entry.action, "updated").toLowerCase();
  const actor = historyActorName(entry, context);
  const oldValue = readableHistoryValue(entry.oldValue);
  const newValue = readableHistoryValue(entry.newValue ?? entry.value);
  const note = stringValue(entry.note, "");
  const meta = formatHistoryTimestamp(entry.createdAt);

  if (action === "source") {
    return { title: `Source extraction: ${readableHistoryValue(entry.value ?? entry.newValue)}`, meta, note };
  }

  if (action === "revert") {
    return { title: `${actor} reverted ${oldValue} -> ${newValue}`, meta, note };
  }

  if (action === "edit") {
    return { title: `${actor} changed ${oldValue} -> ${newValue}`, meta, note };
  }

  return { title: `${actor} ${action} ${oldValue} -> ${newValue}`, meta, note };
}

function historyActorName(entry: Record<string, unknown>, context: HistoryFormatContext): string {
  const displayName = stringValue(entry.actorDisplayName, "");
  if (displayName) return displayName;

  const actor = stringValue(entry.actor, "");
  if (actor && actor === context.currentUser?.id && context.currentUser?.name) {
    return context.currentUser.name;
  }

  return actor && !looksLikeUuid(actor) ? actor : "Analyst";
}

export function formatHistoryTimestamp(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function readableHistoryValue(value: unknown): string {
  const text = stringValue(value, "-").trim();
  const match = text.match(/^\((.+)\)$/);
  return match ? `-${match[1]}` : text;
}

function stringValue(value: unknown, fallback: string): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function humanizeKey(value: string): string {
  const text = value.replace(/[_-]+/g, " ").trim();
  if (!text) return "Warning";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function historyTime(value: unknown): number {
  if (typeof value !== "string" || !value.trim()) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
