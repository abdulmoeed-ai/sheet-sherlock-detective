import { useState, useEffect, useRef, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  Bot,
  Sparkles,
  X,
  Send,
  Check,
  Loader2,
  ChevronDown,
  ChevronRight,
  Copy,
  Paperclip,
  FileText as FileIcon,
  FileSearch,
  Maximize2,
  Minimize2,
  Database,
  Wrench,
  ArrowUpRight,
} from "lucide-react";
import { useCycle } from "@/lib/cycle-store";
import { useSelectedProjectId } from "@/lib/project-store";
import { SIDEBAR_WIDTH, useSidebarCollapsed } from "@/lib/sidebar-store";
import { useAskAiStream } from "@/hooks/use-ask-ai-stream";
import { useWorkspace } from "@/hooks/use-projects";
import { MarkdownContent } from "@/components/MarkdownContent";
import {
  DiagnosisSourcePreviewModal,
  type DiagnosisSourcePreview,
} from "@/components/DiagnosisSourcePreviewModal";
import {
  ASK_AI_PROMPT_MIN_HEIGHT,
  getAskAiPromptKeyAction,
  getAskAiPromptTextareaLayout,
} from "@/lib/ask-ai-input";
import { buildNoProjectAskAiResponse } from "@/lib/ask-ai-empty-context";
import {
  getAskAiCitationPillLabel,
  getAskAiCitationPreview,
  getAskAiCitationTitle,
  type AskAiCitationPreview,
} from "@/lib/ask-ai-citations";
import {
  buildAskAiReasoningSummary,
  type StreamActivityEvent,
} from "@/lib/ask-ai-reasoning";
import { normalizeForecastVisuals } from "@/lib/ask-ai-forecast";
import { userFacingAskAiWarnings } from "@/lib/ask-ai-warnings";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type {
  AskAiClaimSourceGroup,
  AskAiFinalResponse,
  AskAiForecastVisuals,
  AskAiSourceEvent,
  AskAiStatusEvent,
} from "@/lib/api/ask-ai-stream";

type Msg =
  | { id: string; role: "user"; text: string; attachment?: { name: string; size: string } }
  | { id: string; role: "ai"; kind: "text"; text: string }
  | {
      id: string;
      role: "ai";
      kind: "stream";
      text: string;
      activity: StreamActivityEvent[];
      approaches: string[];
      final?: AskAiFinalResponse;
      done: boolean;
      error?: string | null;
    }
  | { id: string; role: "ai"; kind: "status"; steps: string[] };

const SUGGESTIONS = [
  "Analyse Millat Tractors' financial strength for the next 5 years",
  "Why doesn't my balance sheet balance?",
  "What are the key assumptions driving the FY2025 forecast?",
];

export function AskAiTrigger() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const [previewSource, setPreviewSource] = useState<DiagnosisSourcePreview | null>(null);
  const cycle = useCycle();
  const routePath = useRouterState({ select: (s) => s.location.pathname });
  const projectId = useSelectedProjectId();
  const sidebarCollapsed = useSidebarCollapsed();
  const askAi = useAskAiStream(projectId);
  const workspace = useWorkspace(projectId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activeStreamIdRef = useRef<string | null>(null);
  const chatSessionIdRef = useRef(`chat-${Date.now()}`);

  const abortStream = () => {
    activeStreamIdRef.current = null;
    setAsking(false);
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = `${ASK_AI_PROMPT_MIN_HEIGHT}px`;
    const layout = getAskAiPromptTextareaLayout(textarea.scrollHeight);
    textarea.style.height = `${layout.height}px`;
    textarea.style.overflowY = layout.overflowY;
  }, [input, open]);

  useEffect(() => () => abortStream(), []);

  const context = projectContextLabel({
    company: workspace.data?.project.companyName ?? cycle.company,
    period: workspace.data?.project.fiscalYear ?? cycle.period,
    sector: workspace.data?.project.sector ?? cycle.sector,
    documentCount: workspace.data?.documents.length,
  });
  const expandedLeft = sidebarCollapsed ? 0 : SIDEBAR_WIDTH;

  const onPickFile = (file: File) => {
    const sizeKB = (file.size / 1024).toFixed(0);
    setMessages((m) => [
      ...m,
      {
        id: `u-${Date.now()}`,
        role: "user",
        text: "Use this PDF as project evidence.",
        attachment: { name: file.name, size: `${sizeKB} KB` },
      },
      {
        id: `a-${Date.now()}`,
        role: "ai",
        kind: "text",
        text:
          "PDF uploads are handled by the project upload flow. Once the document is indexed, Ask Sherlock will cite it from the backend evidence stream.",
      },
    ]);
  };

  const send = async (text: string) => {
    if (!text.trim()) return;
    abortStream();
    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", text };
    setMessages((m) => [...m, userMsg]);
    setInput("");

    if (!projectId) {
      setMessages((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: "ai",
          kind: "text",
          text: buildNoProjectAskAiResponse(text),
        },
      ]);
      return;
    }

    setAsking(true);
    const aiId = `a-${Date.now()}`;
    activeStreamIdRef.current = aiId;
    setMessages((m) => [
      ...m,
      { id: aiId, role: "ai", kind: "stream", text: "", activity: [], approaches: [], done: false },
    ]);

    try {
      let streamError = false;
      const final = await askAi.sendQuestion(
        {
          question: text,
          sessionId: chatSessionIdRef.current,
          routePath,
          screenName: screenNameForPath(routePath),
          documentIds: cycle.documentIds,
          filters: { cycleStatus: cycle.status, period: cycle.period, company: cycle.company },
          includeExternalSources: shouldUseExternalSources(text),
        },
        {
          onStatus: (event) => updateStreamMessage(aiId, { type: "status", event }),
          onSource: (event) => updateStreamMessage(aiId, { type: "source", event }),
          onApproach: (event) =>
            updateStreamMessage(aiId, { type: "approach", summary: event.summary }),
          onToken: (event) => updateStreamMessage(aiId, { type: "token", delta: event.delta }),
          onFinal: (event) => updateStreamMessage(aiId, { type: "final", final: event }),
          onError: (event) => {
            streamError = true;
            updateStreamMessage(aiId, { type: "error", message: event.message });
          },
        },
      );
      if (!final && !streamError && activeStreamIdRef.current === aiId) {
        updateStreamMessage(aiId, {
          type: "error",
          message: "Ask AI did not return a final answer.",
        });
      }
    } finally {
      if (activeStreamIdRef.current === aiId) {
        activeStreamIdRef.current = null;
        setAsking(false);
      }
    }
  };

  const updateStreamMessage = (
    id: string,
    update:
      | { type: "status"; event: AskAiStatusEvent }
      | { type: "source"; event: AskAiSourceEvent }
      | { type: "approach"; summary: string }
      | { type: "token"; delta: string }
      | { type: "final"; final: AskAiFinalResponse }
      | { type: "error"; message: string },
  ) => {
    setMessages((messages) =>
      messages.map((message) => {
        if (message.id !== id || message.role !== "ai" || message.kind !== "stream") {
          return message;
        }
        if (activeStreamIdRef.current !== id && !message.done && update.type !== "final") {
          return message;
        }
        if (update.type === "status") {
          return {
            ...message,
            activity: [
              ...message.activity,
              {
                type: "status",
                stage: update.event.stage,
                message: update.event.message,
                percent: update.event.percent,
              },
            ],
          };
        }
        if (update.type === "source") {
          return {
            ...message,
            activity: [
              ...message.activity,
              {
                type: "source",
                kind: update.event.kind,
                message: update.event.message,
                count: update.event.count,
                items: update.event.items,
                queries: update.event.queries,
              },
            ],
          };
        }
        if (update.type === "approach") {
          return { ...message, approaches: [...message.approaches, update.summary] };
        }
        if (update.type === "token") {
          return { ...message, text: `${message.text}${update.delta}` };
        }
        if (update.type === "error") {
          return { ...message, error: update.message, done: true };
        }
        return { ...message, text: update.final.answer, final: update.final, done: true };
      }),
    );
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open Ask AI"
          className="group fixed right-4 top-1/2 z-40 flex h-12 items-center gap-2 rounded-full border bg-white/95 px-3 shadow-[0_18px_45px_-22px_rgba(31,41,55,0.75)] backdrop-blur transition hover:-translate-y-0.5 hover:border-[var(--color-brand)] hover:shadow-[0_20px_48px_-20px_rgba(123,104,238,0.55)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] focus:ring-offset-2"
          style={{
            transform: "translateY(-50%)",
            borderColor: "var(--color-border-default)",
          }}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-(--color-brand) text-white">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <span className="text-[12px] font-semibold text-[var(--color-text-primary)]">Ask AI</span>
        </button>
      )}

      {open && (
        <aside
          className={`fixed right-0 top-0 z-50 flex h-screen max-w-full flex-col overflow-hidden bg-[var(--color-page)] slide-in-right ${
            expanded ? "" : "w-[430px]"
          }`}
          style={{
            left: expanded ? expandedLeft : undefined,
            width: expanded ? `calc(100vw - ${expandedLeft}px)` : undefined,
            borderLeft: "1px solid var(--color-border-default)",
            boxShadow: "-24px 0 64px -32px rgba(17,24,39,0.45)",
          }}
        >
          <div
            className="flex min-h-16 items-center justify-between border-b bg-white/95 px-5 backdrop-blur"
            style={{ borderColor: "var(--color-border-default)" }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand)] text-white shadow-[0_10px_24px_-14px_rgba(123,104,238,0.9)]">
                <Bot className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-semibold text-[var(--color-text-primary)]">
                    Ask Sherlock
                  </span>
                  <span
                    className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-success-fg)]"
                    style={{
                      borderColor: "var(--color-success-border)",
                      background: "var(--color-success-bg)",
                    }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
                    Live
                  </span>
                </div>
                <div className="truncate text-[11px] text-[var(--color-text-muted)]">
                  Financial model Q&A with cited evidence
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setExpanded((value) => !value)}
                className="cursor-pointer rounded-md p-1.5 transition hover:bg-[var(--color-tag-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                aria-label={expanded ? "Collapse chat" : "Expand chat"}
                title={expanded ? "Collapse chat" : "Expand chat"}
              >
                {expanded ? (
                  <Minimize2
                    className="h-[18px] w-[18px]"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                ) : (
                  <Maximize2
                    className="h-[18px] w-[18px]"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                )}
              </button>
              <button
                onClick={() => {
                  abortStream();
                  setOpen(false);
                }}
                className="cursor-pointer rounded-md p-1.5 transition hover:bg-[var(--color-tag-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                aria-label="Close"
                title="Close"
              >
                <X className="h-[18px] w-[18px]" style={{ color: "var(--color-text-muted)" }} />
              </button>
            </div>
          </div>

          <div className="mx-4 mt-3 shrink-0">
            <ContextSummary context={context} />
          </div>

          <div
            ref={scrollRef}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-4 py-4"
          >
            {messages.length === 0 && (
              <div className={`mx-auto w-full space-y-3 ${expanded ? "max-w-[80%]" : ""}`}>
                <div
                  className="rounded-xl border bg-white p-4 shadow-sm"
                  style={{ borderColor: "var(--color-border-default)" }}
                >
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--color-text-primary)]">
                    <Sparkles className="h-4 w-4 text-[var(--color-brand)]" />
                    Start with a model-aware prompt
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
                    Ask about uploaded PDFs, accepted cells, source-ingestion fields, or the screen
                    you are reviewing.
                  </p>
                </div>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void send(s)}
                    disabled={asking}
                    className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border bg-white px-3.5 py-3 text-left text-[13px] shadow-sm transition hover:border-[var(--color-brand)] hover:bg-[var(--color-tag-bg)] disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      borderColor: "var(--color-border-default)",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    <span className="min-w-0">{s}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)] transition group-hover:text-[var(--color-brand)]" />
                  </button>
                ))}
              </div>
            )}

            {messages.map((m) => {
              if (m.role === "user") {
                return (
                  <div key={m.id} className="mx-auto flex w-full max-w-[1180px] justify-end">
                    <div
                      className={`group flex flex-col items-end gap-1 ${
                        expanded ? "max-w-[72%]" : "max-w-[86%]"
                      }`}
                    >
                      <div
                        className="rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed text-white shadow-[0_12px_28px_-18px_rgba(123,104,238,0.9)]"
                        style={{
                          background: "var(--color-brand)",
                          borderRadius: "16px 16px 4px 16px",
                        }}
                      >
                        {m.attachment && (
                          <div
                            className="mb-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px]"
                            style={{ background: "rgba(255,255,255,0.18)" }}
                          >
                            <FileIcon className="h-3.5 w-3.5" />
                            <span className="font-semibold">{m.attachment.name}</span>
                            <span className="opacity-70">· {m.attachment.size}</span>
                          </div>
                        )}
                        {m.text}
                      </div>
                      <CopyButton
                        text={m.text}
                        className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                      />
                    </div>
                  </div>
                );
              }
              if (m.kind === "text") {
                return (
                  <AiBubble key={m.id} copyText={m.text} expanded={expanded}>
                    <MarkdownContent markdown={m.text} />
                  </AiBubble>
                );
              }
              if (m.kind === "stream") {
                return (
                  <StreamingAiBubble
                    key={m.id}
                    message={m}
                    expanded={expanded}
                    projectId={projectId}
                    onPreviewSource={setPreviewSource}
                  />
                );
              }
              if (m.kind === "status") {
                return <StatusStream key={m.id} steps={m.steps} />;
              }
              return null;
            })}
          </div>

          <div
            className="border-t bg-white/95 p-3 backdrop-blur"
            style={{ borderColor: "var(--color-border-default)" }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onPickFile(file);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
            <div
              className={expanded ? "mx-auto max-w-[1180px]" : ""}
            >
            <div
              className="rounded-2xl border bg-white p-2 shadow-[0_12px_34px_-24px_rgba(17,24,39,0.55)] focus-within:border-[var(--color-brand)] focus-within:ring-2 focus-within:ring-[rgba(123,104,238,0.14)]"
              style={{ borderColor: "var(--color-border-default)" }}
            >
              <label htmlFor="ask-ai-input" className="sr-only">
                Ask AI prompt
              </label>
              <textarea
                id="ask-ai-input"
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  const action = getAskAiPromptKeyAction(e);
                  if (action === "submit") {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                placeholder="Ask about a PDF, cell, assumption, or source citation..."
                rows={1}
                className="max-h-[136px] min-h-11 w-full resize-none overflow-hidden bg-transparent px-2 py-2 text-[13px] leading-5 text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-placeholder)]"
              />
              <div
                className="mt-1 flex items-center justify-between gap-2 border-t pt-2"
                style={{ borderColor: "var(--color-border-default)" }}
              >
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach PDF"
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border text-[var(--color-text-secondary)] transition hover:bg-[var(--color-tag-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                    style={{ borderColor: "var(--color-border-default)" }}
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <span className="hidden text-[11px] text-[var(--color-text-muted)] sm:inline">
                    Enter to send · Shift+Enter for new line
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void send(input)}
                  disabled={!input.trim() || asking}
                  className="flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-lg px-2 text-white transition hover:bg-[var(--color-brand-hover)] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] focus:ring-offset-2"
                  style={{ background: "var(--color-brand)" }}
                  aria-label={asking ? "Ask AI is answering" : "Send Ask AI prompt"}
                >
                  {asking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            </div>
          </div>
        </aside>
      )}
      <DiagnosisSourcePreviewModal
        open={previewSource !== null}
        source={previewSource}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPreviewSource(null);
        }}
      />
    </>
  );
}

function AiBubble({
  children,
  copyText,
  wide = false,
  expanded = false,
}: {
  children: ReactNode;
  copyText?: string;
  wide?: boolean;
  expanded?: boolean;
}) {
  return (
    <div className={`mx-auto flex w-full min-w-0 ${expanded ? "max-w-[1180px]" : ""}`}>
      <div
        className={`${wide ? "w-full sm:w-[92%]" : "max-w-[92%]"} group flex min-w-0 flex-col items-end gap-1`}
      >
        <div
          className="w-full min-w-0 overflow-hidden rounded-xl border bg-white px-3.5 py-3 text-[13px]"
          style={{
            borderColor: "var(--color-border-default)",
            borderRadius: "12px 12px 12px 2px",
            color: "var(--color-text-primary)",
          }}
        >
          {children}
        </div>
        {copyText && (
          <CopyButton
            text={copyText}
            className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
          />
        )}
      </div>
    </div>
  );
}

function CollapsibleSection({
  icon,
  title,
  meta,
  summary,
  defaultOpen,
  children,
}: {
  icon: ReactNode;
  title: string;
  meta?: string;
  summary?: ReactNode;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      className="overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
      style={{ borderColor: open ? "rgba(123,104,238,0.22)" : "var(--color-border-default)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-[var(--color-table-header)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--color-brand)]"
        aria-expanded={open}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--color-tag-bg)]">
            {icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 text-[12px] font-semibold text-[var(--color-text-primary)]">
                {title}
              </span>
              {summary}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
          {meta && (
            <span className="rounded-full bg-[var(--color-tag-bg)] px-2 py-0.5 font-semibold text-[var(--color-brand)]">
              {meta}
            </span>
          )}
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </span>
      </button>
      {open && (
        <div className="border-t px-3 py-3" style={{ borderColor: "var(--color-border-default)" }}>
          {children}
        </div>
      )}
    </section>
  );
}

function SummaryChip({ label }: { label: string }) {
  return (
    <span className="max-w-[180px] truncate rounded-full bg-[var(--color-table-header)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)]">
      {label}
    </span>
  );
}

function ContextSummary({ context }: { context: string }) {
  const parts = context.split(" · ").filter(Boolean);
  return (
    <CollapsibleSection
      icon={<Database className="h-3.5 w-3.5 text-[var(--color-brand)]" />}
      title="Project context"
      meta={`${parts.length} signals`}
      defaultOpen={false}
      summary={
        <span className="truncate text-[12px] font-medium text-[var(--color-text-secondary)]">
          {context}
        </span>
      }
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {parts.map((part) => (
          <div
            key={part}
            className="rounded-lg border bg-white px-3 py-2 text-[11px] font-medium text-[var(--color-text-secondary)]"
            style={{ borderColor: "var(--color-border-default)" }}
          >
            {part}
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}

function StreamingAiBubble({
  message,
  expanded,
  projectId,
  onPreviewSource,
}: {
  message: Extract<Msg, { kind: "stream" }>;
  expanded: boolean;
  projectId: string | null;
  onPreviewSource: (source: DiagnosisSourcePreview) => void;
}) {
  const citations = message.final?.sourcesUsed ?? [];
  const answer = message.final?.answer || message.text;
  const warnings = userFacingAskAiWarnings(message.final?.warnings);
  const forecastVisuals = normalizeForecastVisuals(message.final?.forecastVisuals);
  const claimSourceGroups = message.final?.claimSourceGroups ?? [];
  const reasoning = buildAskAiReasoningSummary({
    activity: message.activity,
    approaches: message.approaches,
    done: message.done,
    final: message.final,
  });

  return (
    <AiBubble copyText={answer} wide expanded={expanded}>
      <div className="min-w-0 space-y-3 overflow-hidden">
        <CurrentEventPanel summary={reasoning} message={message} />
        {message.activity.length > 0 && <EvidenceStrip activity={message.activity} />}
        {forecastVisuals && <ForecastSnapshot visuals={forecastVisuals} />}
        {message.error ? (
          <div
            className="break-words rounded-md px-3 py-2 text-[12px]"
            style={{ background: "var(--color-danger-bg)", color: "var(--color-danger-fg)" }}
          >
            {message.error}
          </div>
        ) : null}

        {answer ? (
          <div className="min-w-0 overflow-visible break-words">
            <MarkdownContent
              markdown={answer}
              renderCitation={(index) => (
                <InlineCitationBadge
                  index={index}
                  citations={citations}
                  projectId={projectId}
                  onPreviewSource={onPreviewSource}
                />
              )}
            />
            {claimSourceGroups.length > 0 && (
              <GroupedSourcePills
                groups={claimSourceGroups}
                citations={citations}
                projectId={projectId}
                onPreviewSource={onPreviewSource}
              />
            )}
          </div>
        ) : (
          <div className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>
            The answer will appear here as soon as the model starts streaming tokens.
          </div>
        )}

        {warnings.length > 0 && (
          <div
            className="rounded-md px-2.5 py-1.5 text-[12px]"
            style={{ background: "#FFFBEB", color: "var(--color-warning-fg)" }}
          >
            {warnings.join(" · ")}
          </div>
        )}
      </div>
    </AiBubble>
  );
}

function ForecastSnapshot({ visuals }: { visuals: AskAiForecastVisuals }) {
  const charts = visuals.chartSeries.slice(0, 4);
  return (
    <section
      className="min-w-0 overflow-hidden rounded-xl border bg-white"
      style={{ borderColor: "var(--color-border-default)" }}
    >
      <div
        className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5"
        style={{ borderColor: "var(--color-border-default)", background: "#FAFBFF" }}
      >
        <div className="text-[12px] font-semibold text-[var(--color-text-primary)]">
          Forecast snapshot
        </div>
        {visuals.confidence && (
          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-[var(--color-brand)]">
            {visuals.confidence} confidence
          </span>
        )}
      </div>
      <div className="space-y-3 p-3">
        {charts.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {charts.map((series) => (
              <div
                key={series.id}
                className="min-w-0 rounded-lg border bg-white p-2"
                style={{ borderColor: "var(--color-border-default)" }}
              >
                <div className="mb-1 truncate text-[11px] font-semibold text-[var(--color-text-secondary)]">
                  {series.title}
                </div>
                <ChartContainer
                  className="h-[150px] min-h-[150px] w-full aspect-auto"
                  config={{ value: { label: series.title, color: "var(--color-brand)" } }}
                >
                  <LineChart data={series.points} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} width={36} />
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="var(--color-value)"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  </LineChart>
                </ChartContainer>
              </div>
            ))}
          </div>
        )}
        {visuals.assumptionPills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {visuals.assumptionPills.map((pill) => (
              <span
                key={pill}
                className="rounded-full bg-[var(--color-tag-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-brand)]"
              >
                {pill}
              </span>
            ))}
          </div>
        )}
        {visuals.riskCallouts.length > 0 && (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {visuals.riskCallouts.map((risk) => (
              <div
                key={`${risk.severity}-${risk.label}`}
                className="flex min-w-0 items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[11px]"
                style={{ background: riskBackground(risk.severity), color: riskColor(risk.severity) }}
              >
                <span className="min-w-0 truncate font-medium">{risk.label}</span>
                <span className="shrink-0 font-semibold">{risk.severity}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function GroupedSourcePills({
  groups,
  citations,
  projectId,
  onPreviewSource,
}: {
  groups: AskAiClaimSourceGroup[];
  citations: Array<Record<string, unknown>>;
  projectId: string | null;
  onPreviewSource: (source: DiagnosisSourcePreview) => void;
}) {
  const visibleGroups = groups.filter((group) => group.citationIndexes.length > 1);
  if (visibleGroups.length === 0) return null;
  return (
    <div className="mt-3 space-y-1.5 rounded-lg border bg-[#FAFBFF] px-2.5 py-2" style={{ borderColor: "var(--color-border-default)" }}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
        Cross-check sources
      </div>
      {visibleGroups.map((group) => (
        <div key={group.claimId} className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px]">
          <span className="max-w-[180px] truncate text-[var(--color-text-secondary)]">
            {formatClaimId(group.claimId)}
          </span>
          {group.citationIndexes.map((index) => (
            <InlineCitationBadge
              key={`${group.claimId}-${index}`}
              index={index}
              citations={citations}
              projectId={projectId}
              onPreviewSource={onPreviewSource}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function riskBackground(severity: string): string {
  if (severity === "High") return "var(--color-danger-bg)";
  if (severity === "Medium") return "var(--color-warning-bg)";
  return "var(--color-success-bg)";
}

function riskColor(severity: string): string {
  if (severity === "High") return "var(--color-danger-fg)";
  if (severity === "Medium") return "var(--color-warning-fg)";
  return "var(--color-success-fg)";
}

function formatClaimId(value: string): string {
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function InlineCitationBadge({
  index,
  citations,
  projectId,
  onPreviewSource,
}: {
  index: number;
  citations: Array<Record<string, unknown>>;
  projectId: string | null;
  onPreviewSource: (source: DiagnosisSourcePreview) => void;
}) {
  const citation = citations.find((item) => Number(item.index ?? 0) === index);
  const [open, setOpen] = useState(false);
  if (!citation) {
    return <span className="font-semibold text-[var(--color-brand)]">{index}</span>;
  }
  const title = getAskAiCitationTitle(citation);
  const preview = getAskAiCitationPreview(citation);
  const excerpt = String(citation.excerpt ?? citation.currentValue ?? citation.value ?? "");
  const meta = citationMeta(citation);

  return (
    <span className="relative inline-flex align-baseline">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="mx-0.5 inline-flex h-5 max-w-[220px] items-center rounded-full border px-1.5 text-[10px] font-semibold text-[var(--color-brand)] align-baseline transition hover:bg-[var(--color-tag-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
        style={{
          borderColor: "rgba(123,104,238,0.36)",
          background: open ? "var(--color-tag-bg)" : "#fff",
        }}
        aria-expanded={open}
        title={title}
      >
        {index}
      </button>
      {open && (
        <span
          className="absolute left-0 top-6 z-40 block w-[min(340px,calc(100vw-80px))] whitespace-normal rounded-lg border bg-white p-3 text-left text-[11px] leading-relaxed shadow-[0_18px_42px_-24px_rgba(17,24,39,0.55)]"
          style={{ borderColor: "var(--color-border-default)" }}
        >
          <span className="block text-[12px] font-semibold text-[var(--color-text-primary)]">
            {getAskAiCitationPillLabel(citation)}
          </span>
          {meta && <span className="mt-0.5 block text-[10px] text-[var(--color-text-muted)]">{meta}</span>}
          {excerpt && (
            <span className="mt-2 block line-clamp-5 text-[11px] text-[var(--color-text-secondary)]">
              {excerpt}
            </span>
          )}
          <span className="mt-2 flex flex-wrap gap-1.5">
            {preview?.type === "external_url" && (
              <a
                href={preview.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold text-[var(--color-brand)]"
                style={{ borderColor: "rgba(123,104,238,0.28)" }}
              >
                Open website
                <ArrowUpRight className="h-3 w-3" />
              </a>
            )}
            {preview?.type === "document_page" && projectId && (
              <button
                type="button"
                onClick={() => onPreviewSource(buildCitationPreviewSource({
                  citation,
                  preview,
                  projectId,
                  excerpt,
                }))}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold text-[var(--color-brand)]"
                style={{ borderColor: "rgba(123,104,238,0.28)" }}
              >
                Preview page
                <FileSearch className="h-3 w-3" />
              </button>
            )}
          </span>
        </span>
      )}
    </span>
  );
}

function EvidenceStrip({ activity }: { activity: StreamActivityEvent[] }) {
  const sourceEvents = activity.filter(
    (event): event is Extract<StreamActivityEvent, { type: "source" }> => event.type === "source",
  );
  const statusEvents = activity.filter(
    (event): event is Extract<StreamActivityEvent, { type: "status" }> => event.type === "status",
  );
  const latestStatus = statusEvents.at(-1);
  const pdfCount = latestSourceCount(activity, "uploaded_pdf");
  const evidenceCount = latestSourceMessageCount(activity, "Matched project evidence");
  const webCount = latestSourceCount(activity, "web");
  const webEvents = sourceEvents.filter((event) => event.kind === "web");

  if (sourceEvents.length === 0 && !latestStatus) return null;

  return (
    <div
      className="rounded-xl border px-3 py-2.5"
      style={{ borderColor: "var(--color-border-default)", background: "#FAFBFF" }}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-text-primary)]">
          <Wrench className="h-3.5 w-3.5 text-[var(--color-brand)]" />
          Evidence checked
        </span>
        {pdfCount > 0 && <EvidenceChip label={`${pdfCount} PDF${pdfCount === 1 ? "" : "s"}`} />}
        {evidenceCount > 0 && <EvidenceChip label={`${evidenceCount} evidence matches`} />}
        {webCount > 0 && <EvidenceChip label={`${webCount} approved web sources`} />}
        {latestStatus && (
          <span className="ml-auto shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-[var(--color-brand)]">
            {statusTitle(latestStatus.stage)} · {latestStatus.percent}%
          </span>
        )}
      </div>
      {latestStatus && (
        <div className="mt-1.5 text-[11px] text-[var(--color-text-secondary)]">
          {latestStatus.message}
        </div>
      )}
      {webEvents.length > 0 && <WebSearchTrace events={webEvents} />}
    </div>
  );
}

function WebSearchTrace({ events }: { events: Array<Extract<StreamActivityEvent, { type: "source" }>> }) {
  const queries = uniqueStrings(events.flatMap((event) => event.queries ?? []));
  const links = uniqueWebLinks(events.flatMap((event) => event.items ?? []));
  if (queries.length === 0 && links.length === 0) return null;

  return (
    <div className="mt-2 border-t pt-2" style={{ borderColor: "var(--color-border-default)" }}>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
        Web searches
      </div>
      {queries.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {queries.map((query) => (
            <span
              key={query}
              className="max-w-full truncate rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]"
              title={query}
            >
              {query}
            </span>
          ))}
        </div>
      )}
      {links.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {links.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-full items-center gap-1 rounded-md border bg-white px-2 py-1 text-[10px] font-semibold text-[var(--color-brand)]"
              style={{ borderColor: "rgba(123,104,238,0.28)" }}
              title={link.url}
            >
              <span className="truncate">{link.title}</span>
              <ArrowUpRight className="h-3 w-3 shrink-0" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function EvidenceChip({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)]">
      {label}
    </span>
  );
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function uniqueWebLinks(items: Array<Record<string, unknown>>): Array<{ title: string; url: string }> {
  const links: Array<{ title: string; url: string }> = [];
  const seen = new Set<string>();
  for (const item of items) {
    const url = typeof item.url === "string" ? item.url.trim() : "";
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const title = typeof item.title === "string" && item.title.trim() ? item.title.trim() : url;
    links.push({ title, url });
  }
  return links.slice(0, 6);
}

function latestSourceCount(activity: StreamActivityEvent[], kind: string): number {
  const event = [...activity].reverse().find((item) => item.type === "source" && item.kind === kind);
  return event?.type === "source" ? event.count : 0;
}

function latestSourceMessageCount(activity: StreamActivityEvent[], message: string): number {
  const event = [...activity].reverse().find((item) => item.type === "source" && item.message === message);
  return event?.type === "source" ? event.count : 0;
}

function citationMeta(citation: Record<string, unknown>): string {
  if (citation.kind === "uploaded_pdf") {
    const page = citation.pageNumber ?? citation.page ?? citation.pdfPageIndex;
    return [citation.filename, page ? `page ${String(page)}` : undefined]
      .filter(Boolean)
      .map(String)
      .join(" · ");
  }
  if (citation.kind === "model") {
    return [citation.sheetName, citation.cellReference, citation.period]
      .filter(Boolean)
      .map(String)
      .join(" · ");
  }
  return [citation.sourceName, citation.date, citation.url].filter(Boolean).map(String).join(" · ");
}

function buildCitationPreviewSource({
  citation,
  preview,
  projectId,
  excerpt,
}: {
  citation: Record<string, unknown>;
  preview: Extract<AskAiCitationPreview, { type: "document_page" }>;
  projectId: string;
  excerpt: string;
}): DiagnosisSourcePreview {
  return {
    projectId,
    documentId: preview.documentId,
    documentFilename: String(citation.filename ?? preview.title),
    pdfPageIndex: preview.pdfPageIndex,
    printedPageNumber: Number.parseInt(preview.pageLabel, 10) || preview.pdfPageIndex + 1,
    label: preview.title,
    value: String(citation.currentValue ?? citation.value ?? ""),
    sourceText: excerpt || null,
    boundingBox: null,
  };
}

function CurrentEventPanel({
  summary,
  message,
}: {
  summary: AskAiReasoningSummary;
  message: Extract<Msg, { kind: "stream" }>;
}) {
  const current = currentStreamEvent(message);
  const isAnswering = message.text.length > 0 || message.done;
  const displayTitle = message.done && !message.error ? summary.compactLabel : current.title;
  const displayMessage = message.done && !message.error ? "" : current.message;

  return (
    <div
      className="min-w-0 rounded-2xl border px-3 py-2.5"
      style={{
        borderColor: message.done ? "var(--color-border-default)" : "rgba(123,104,238,0.22)",
        background: message.done ? "#fff" : "#FAFBFF",
      }}
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
            style={{
              background: message.done ? "var(--color-success-bg)" : "var(--color-tag-bg)",
              color: message.done ? "var(--color-success)" : "var(--color-brand)",
            }}
          >
            {message.done ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
          </span>
          <div className="min-w-0">
            <div
              className="truncate text-[12px] font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              {displayTitle}
            </div>
            {displayMessage && (
              <div
                className="mt-0.5 break-words text-[12px] leading-relaxed"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {displayMessage}
              </div>
            )}
          </div>
        </div>
        <span
          className="shrink-0 text-[11px] font-medium"
          style={{ color: "var(--color-text-muted)" }}
        >
          {message.done ? "done" : current.percent !== null ? `${current.percent}%` : "live"}
        </span>
      </div>
      {!isAnswering && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {summary.chips.length > 0 ? (
            summary.chips.map((chip) => (
              <span
                key={chip}
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ background: "#F5F7FB", color: "var(--color-text-muted)" }}
              >
                {chip}
              </span>
            ))
          ) : (
            <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
              Waiting for backend context, retrieval, and model events...
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function currentStreamEvent(message: Extract<Msg, { kind: "stream" }>): {
  title: string;
  message: string;
  percent: number | null;
} {
  if (message.done) {
    return {
      title: message.error ? "Ask AI stopped" : "Answer ready",
      message: message.error ?? "The model finished generating the cited answer.",
      percent: 100,
    };
  }

  const latestApproach = message.approaches.at(-1);
  if (latestApproach) {
    return {
      title: "Planning answer",
      message: latestApproach,
      percent: latestStatusPercent(message.activity),
    };
  }

  const latest = message.activity.at(-1);
  if (!latest) {
    return {
      title: "Opening Ask AI stream",
      message: "Connecting to the backend and preparing project context.",
      percent: null,
    };
  }

  if (latest.type === "status") {
    return {
      title: statusTitle(latest.stage),
      message: latest.message,
      percent: latest.percent,
    };
  }

  return {
    title: `${sourceTitle(latest.kind)} (${latest.count})`,
    message: latest.message,
    percent: latestStatusPercent(message.activity),
  };
}

function latestStatusPercent(activity: StreamActivityEvent[]): number | null {
  const latest = [...activity].reverse().find((event) => event.type === "status");
  return latest?.type === "status" ? latest.percent : null;
}

function statusTitle(stage: string): string {
  if (stage === "context") return "Reading project context";
  if (stage === "retrieval") return "Matching workbook and PDF evidence";
  if (stage === "web") return "Checking approved external sources";
  if (stage === "llm") return "Asking the model";
  if (stage === "finalizing") return "Finalizing citations";
  return "Processing";
}

function sourceTitle(kind: string): string {
  if (kind === "uploaded_pdf") return "PDFs";
  if (kind === "uploaded_sheet") return "Screen context";
  if (kind === "model") return "Model fields";
  if (kind === "source_registry") return "Registered sources";
  if (kind === "web") return "Web results";
  return "Evidence source";
}

function CopyButton({ text, className = "" }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const value = text.trim();
    if (!value) return;
    await navigator.clipboard?.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1000);
  };
  return (
    <button
      type="button"
      onClick={() => void copy()}
      className={`copy-button relative flex h-6 w-6 shrink-0 items-center justify-center rounded-md border bg-white transition hover:bg-[var(--color-tag-bg)] ${className}`}
      style={{
        borderColor: "var(--color-border-default)",
        color: "var(--color-text-muted)",
      }}
      aria-label={copied ? "Copied" : "Copy message"}
      title={copied ? "Copied" : "Copy"}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      <span className="copy-tooltip pointer-events-none absolute bottom-full right-0 mb-1 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium opacity-0 shadow-sm">
        {copied ? "Copied" : "Copy"}
      </span>
    </button>
  );
}

function StatusStream({ steps }: { steps: string[] }) {
  const [done, setDone] = useState(0);
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= steps.length; i++) {
      timers.push(setTimeout(() => setDone(i), i * 800));
    }
    return () => timers.forEach(clearTimeout);
  }, [steps.length]);

  const durations = ["1.2s", "0.8s", "2.1s", "1.4s"];

  return (
    <AiBubble>
      <div className="space-y-2">
        {steps.map((s, i) => {
          const isDone = i < done;
          return (
            <div
              key={s}
              className="flex items-center justify-between py-1"
              style={{
                borderBottom: i < steps.length - 1 ? "1px solid #F3F4F6" : undefined,
                opacity: i <= done ? 1 : 0.35,
              }}
            >
              <div className="flex items-center gap-2">
                {isDone ? (
                  <Check className="h-3.5 w-3.5" style={{ color: "var(--color-success)" }} />
                ) : (
                  <Loader2
                    className="h-3.5 w-3.5 animate-spin"
                    style={{ color: "var(--color-brand)" }}
                  />
                )}
                <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                  {s}
                </span>
              </div>
              <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                {isDone ? `done · ${durations[i] ?? "1.0s"}` : "…"}
              </span>
            </div>
          );
        })}
      </div>
    </AiBubble>
  );
}

function screenNameForPath(path: string): string {
  const clean = path.replace(/^\/+/, "") || "Dashboard";
  return clean
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function shouldUseExternalSources(question: string): boolean {
  return /\b(forecast|forcast|predict|prediction|projection|outlook|sector|next\s+\d+\s+years?|market|macro)\b/i.test(
    question,
  );
}

function projectContextLabel(input: {
  company: string | null | undefined;
  period: string | null | undefined;
  sector: string | null | undefined;
  documentCount: number | undefined;
}): string {
  const parts = [
    input.period || "Current period",
    input.company || "Selected project",
    input.sector ? `${input.sector} sector` : "Sector not specified",
  ];
  if (typeof input.documentCount === "number") {
    parts.push(`${input.documentCount} PDF${input.documentCount === 1 ? "" : "s"}`);
  }
  return parts.join(" · ");
}

export function useGlobalToast() {
  const routerLoc = useRouterState({ select: (s) => s.location.pathname });
  return routerLoc;
}
