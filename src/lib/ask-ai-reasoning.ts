export type StreamActivityEvent =
  | { type: "status"; message: string; stage: string; percent: number }
  | { type: "source"; message: string; kind: string; count: number; items?: Array<Record<string, unknown>> };

export type ReasoningGroup = {
  title: string;
  items: string[];
};

export type AskAiReasoningSummary = {
  state: "streaming" | "complete";
  activeLabel: string;
  compactLabel: string;
  chips: string[];
  groups: ReasoningGroup[];
  warnings: string[];
};

export function buildAskAiReasoningSummary(input: {
  activity: StreamActivityEvent[];
  approaches: string[];
  done: boolean;
  final?: { sourcesUsed?: Array<unknown>; warnings?: string[] };
}): AskAiReasoningSummary {
  const pdfCount = latestSourceCount(input.activity, "uploaded_pdf");
  const matchedEvidenceCount = latestSourceMessageCount(input.activity, "Matched project evidence");
  const citationCount = input.final?.sourcesUsed?.length ?? 0;
  const state = input.done ? "complete" : "streaming";
  const activeLabel = state === "complete" ? "Answer ready with citations" : activeReasoningLabel(input.activity);
  const chips = compactChips(input.activity).slice(-3);
  const compactLabel =
    state === "complete"
      ? completedCompactLabel({ pdfCount, matchedEvidenceCount, citationCount })
      : activeLabel;

  return {
    state,
    activeLabel,
    compactLabel,
    chips,
    groups: reasoningGroups(input.activity, input.approaches),
    warnings: input.final?.warnings ?? [],
  };
}

function activeReasoningLabel(activity: StreamActivityEvent[]): string {
  const latestStatus = [...activity].reverse().find((event) => event.type === "status");
  if (!latestStatus || latestStatus.type !== "status") return "Preparing financial context";
  if (latestStatus.stage === "context") return "Reading project context";
  if (latestStatus.stage === "retrieval") return "Matching workbook and PDF evidence";
  if (latestStatus.stage === "web") return "Checking approved web sources";
  if (latestStatus.stage === "llm") return "Drafting cited answer";
  if (latestStatus.stage === "finalizing") return "Finalizing citations";
  return humanizeEventMessage(latestStatus.message);
}

function completedCompactLabel(input: { pdfCount: number; matchedEvidenceCount: number; citationCount: number }): string {
  const parts = [];
  if (input.pdfCount > 0) parts.push(`Reviewed ${input.pdfCount} PDF${input.pdfCount === 1 ? "" : "s"}`);
  if (input.matchedEvidenceCount > 0) {
    parts.push(`Matched ${input.matchedEvidenceCount} evidence point${input.matchedEvidenceCount === 1 ? "" : "s"}`);
  }
  if (input.citationCount > 0) parts.push(`${input.citationCount} citation${input.citationCount === 1 ? "" : "s"}`);
  return parts.length ? parts.join(" · ") : "Answer ready";
}

function compactChips(activity: StreamActivityEvent[]): string[] {
  const chips: string[] = [];
  for (const event of activity) {
    if (event.type !== "source" || event.count <= 0) continue;
    const label = sourceChipLabel(event);
    if (label && !chips.includes(label)) chips.push(label);
  }
  return chips;
}

function sourceChipLabel(event: Extract<StreamActivityEvent, { type: "source" }>): string {
  if (event.kind === "uploaded_pdf") return event.count === 1 ? "PDF found" : `${event.count} PDFs`;
  if (event.message === "Using current screen context") return "Screen context";
  if (event.message === "Matched project evidence") return `${event.count} evidence match${event.count === 1 ? "" : "es"}`;
  if (event.kind === "model") return `${event.count} model field${event.count === 1 ? "" : "s"}`;
  if (event.kind === "source_registry") return "Source registry";
  if (event.kind === "web") return `${event.count} web source${event.count === 1 ? "" : "s"}`;
  return humanizeEventMessage(event.message);
}

function reasoningGroups(activity: StreamActivityEvent[], approaches: string[]): ReasoningGroup[] {
  const context = activity
    .filter((event) => event.type === "source" && ["uploaded_pdf", "uploaded_sheet", "model"].includes(event.kind))
    .map(describeSourceEvent)
    .filter(Boolean);
  const retrieval = activity
    .filter((event) => event.type === "source" && ["source_registry", "web"].includes(event.kind))
    .map(describeSourceEvent)
    .filter(Boolean);
  const evidence = activity
    .filter((event) => event.type === "source" && event.message === "Matched project evidence")
    .map(describeSourceEvent)
    .filter(Boolean);
  const answering = approaches.length ? approaches : [activeReasoningLabel(activity)];

  return [
    { title: "Context", items: unique(context) },
    { title: "Retrieval", items: unique(retrieval) },
    { title: "Evidence", items: unique(evidence) },
    { title: "Answer", items: unique(answering.map(humanizeEventMessage)) },
  ].filter((group) => group.items.length > 0);
}

function describeSourceEvent(event: StreamActivityEvent): string {
  if (event.type !== "source") return "";
  if (event.kind === "uploaded_pdf") return event.count > 0 ? `${event.count} uploaded PDF${event.count === 1 ? "" : "s"} available` : "";
  if (event.message === "Using current screen context") return "Current screen context included";
  if (event.message === "Matched project evidence") {
    return event.count > 0 ? `${event.count} project evidence match${event.count === 1 ? "" : "es"}` : "";
  }
  if (event.kind === "model") return event.count > 0 ? `${event.count} accepted model field${event.count === 1 ? "" : "s"}` : "";
  if (event.kind === "source_registry") return event.count > 0 ? `${event.count} source-registry field${event.count === 1 ? "" : "s"}` : "";
  if (event.kind === "web") return event.count > 0 ? `${event.count} approved web source${event.count === 1 ? "" : "s"}` : "";
  return event.count > 0 ? humanizeEventMessage(event.message) : "";
}

function latestSourceCount(activity: StreamActivityEvent[], kind: string): number {
  const event = [...activity].reverse().find((item) => item.type === "source" && item.kind === kind);
  return event?.type === "source" ? event.count : 0;
}

function latestSourceMessageCount(activity: StreamActivityEvent[], message: string): number {
  const event = [...activity].reverse().find((item) => item.type === "source" && item.message === message);
  return event?.type === "source" ? event.count : 0;
}

function humanizeEventMessage(message: string): string {
  return message
    .replace(/^Found /i, "")
    .replace(/^Using /i, "")
    .replace(/^Calling Gemini$/i, "Drafting cited answer")
    .trim();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
