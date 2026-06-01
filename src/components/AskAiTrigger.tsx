import { useState, useEffect, useRef, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Sparkles,
  X,
  Send,
  Check,
  Loader2,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Copy,
  Paperclip,
  FileText as FileIcon,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useCycle } from "@/lib/cycle-store";
import { useSelectedProjectId } from "@/lib/project-store";
import { useAskAiStream } from "@/hooks/use-ask-ai-stream";
import { useWorkspace } from "@/hooks/use-projects";
import { MarkdownContent } from "@/components/MarkdownContent";
import { ASK_AI_PROMPT_MIN_HEIGHT, getAskAiPromptKeyAction, getAskAiPromptTextareaLayout } from "@/lib/ask-ai-input";
import { buildNoProjectAskAiResponse } from "@/lib/ask-ai-empty-context";
import { getAskAiCitationTitle } from "@/lib/ask-ai-citations";
import {
  buildAskAiReasoningSummary,
  type AskAiReasoningSummary,
  type StreamActivityEvent,
} from "@/lib/ask-ai-reasoning";
import type {
  AskAiFinalResponse,
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
  | { id: string; role: "ai"; kind: "clarify" }
  | { id: string; role: "ai"; kind: "status"; steps: string[] }
  | { id: string; role: "ai"; kind: "pdf-parsed"; name: string; pages: number; entities: string[] }
  | { id: string; role: "ai"; kind: "prediction" };

const SUGGESTIONS = [
  "📈 Analyse Millat Tractors' financial strength for the next 5 years",
  "⚖️  Why doesn't my balance sheet balance?",
  "📊 What are the key assumptions driving the FY2025 forecast?",
];

export function AskAiTrigger() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const cycle = useCycle();
  const navigate = useNavigate();
  const routePath = useRouterState({ select: (s) => s.location.pathname });
  const projectId = useSelectedProjectId();
  const askAi = useAskAiStream(projectId);
  const workspace = useWorkspace(projectId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const chatSessionIdRef = useRef(`chat-${Date.now()}`);

  const abortStream = () => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
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

  const onPickFile = (file: File) => {
    const sizeKB = (file.size / 1024).toFixed(0);
    const userMsg: Msg = {
      id: `u-${Date.now()}`,
      role: "user",
      text: "Parse this annual report and surface key figures.",
      attachment: { name: file.name, size: `${sizeKB} KB` },
    };
    setMessages((m) => [...m, userMsg]);
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          id: `s-${Date.now()}`,
          role: "ai",
          kind: "status",
          steps: [
            "Uploading PDF to Sherlock",
            "OCR + table extraction",
            "Mapping to Banking / Industrials rule pack",
            "Cross-checking against ingestion manifest",
          ],
        },
      ]);
      setTimeout(() => {
        setMessages((m) => [
          ...m,
          {
            id: `pdf-${Date.now()}`,
            role: "ai",
            kind: "pdf-parsed",
            name: file.name,
            pages: 142,
            entities: [
              "Revenue PKR 54.8B (p.12)",
              "EBITDA PKR 12.9B (p.14)",
              "Tractor units 47,210 (p.31)",
              "KIBOR avg 18.5% (p.88)",
            ],
          },
        ]);
      }, 3400);
    }, 300);
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
        { id: `a-${Date.now()}`, role: "ai", kind: "text", text: buildNoProjectAskAiResponse(text) },
      ]);
      return;
    }

    if (/financial strength|next 5 years|predict|forecast/i.test(text)) {
      setTimeout(() => {
        setMessages((m) => [...m, { id: `c-${Date.now()}`, role: "ai", kind: "clarify" }]);
      }, 400);
      return;
    }

    setAsking(true);
    const aiId = `a-${Date.now()}`;
    const controller = new AbortController();
    streamAbortRef.current = controller;
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
          includeExternalSources: false,
        },
        {
          onStatus: (event) => updateStreamMessage(aiId, { type: "status", event }),
          onSource: (event) => updateStreamMessage(aiId, { type: "source", event }),
          onApproach: (event) => updateStreamMessage(aiId, { type: "approach", summary: event.summary }),
          onToken: (event) => updateStreamMessage(aiId, { type: "token", delta: event.delta }),
          onFinal: (event) => updateStreamMessage(aiId, { type: "final", final: event }),
          onError: (event) => {
            streamError = true;
            updateStreamMessage(aiId, { type: "error", message: event.message });
          },
        },
        { signal: controller.signal },
      );
      if (!final && !streamError && !controller.signal.aborted) {
        updateStreamMessage(aiId, { type: "error", message: "Ask AI did not return a final answer." });
      }
    } finally {
      if (streamAbortRef.current === controller) {
        streamAbortRef.current = null;
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

  const runPrediction = () => {
    const steps = [
      "Pulling 5yr historical from PSX",
      "Fetching ADB macro outlook",
      "Running time-series model",
      "Generating Base / Bull / Bear",
    ];
    setMessages((m) => [...m, { id: `s-${Date.now()}`, role: "ai", kind: "status", steps }]);
    setTimeout(() => {
      setMessages((m) => [...m, { id: `p-${Date.now()}`, role: "ai", kind: "prediction" }]);
    }, steps.length * 800 + 400);
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open Ask AI"
          className="group fixed right-0 top-1/2 z-40 flex flex-col items-center justify-center gap-2"
          style={{
            transform: "translateY(-50%)",
            width: 36,
            height: 96,
            background: "var(--color-brand)",
            borderRadius: "8px 0 0 8px",
            boxShadow: "0 4px 16px -4px rgba(123,104,238,0.5)",
          }}
        >
          <Sparkles className="h-4 w-4 text-white" />
          <span
            className="text-[11px] font-semibold text-white"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            Ask AI
          </span>
        </button>
      )}

      {open && (
        <aside
          className={`fixed right-0 top-0 z-50 flex h-screen max-w-full flex-col bg-white slide-in-right ${
            expanded ? "w-[min(760px,calc(100vw-24px))]" : "w-[380px]"
          }`}
          style={{ borderLeft: "1px solid var(--color-border-default)", boxShadow: "-12px 0 32px -16px rgba(0,0,0,0.1)" }}
        >
          <div
            className="flex h-14 items-center justify-between border-b px-5"
            style={{ borderColor: "var(--color-border-default)" }}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" style={{ color: "var(--color-accent-sparkle)" }} />
              <span className="text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Ask Sherlock
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setExpanded((value) => !value)}
                className="rounded-md p-1 hover:bg-[var(--color-tag-bg)]"
                aria-label={expanded ? "Collapse chat" : "Expand chat"}
                title={expanded ? "Collapse chat" : "Expand chat"}
              >
                {expanded ? (
                  <Minimize2 className="h-[18px] w-[18px]" style={{ color: "var(--color-text-muted)" }} />
                ) : (
                  <Maximize2 className="h-[18px] w-[18px]" style={{ color: "var(--color-text-muted)" }} />
                )}
              </button>
              <button
                onClick={() => {
                  abortStream();
                  setOpen(false);
                }}
                className="rounded-md p-1 hover:bg-[var(--color-tag-bg)]"
                aria-label="Close"
                title="Close"
              >
                <X className="h-[18px] w-[18px]" style={{ color: "var(--color-text-muted)" }} />
              </button>
            </div>
          </div>

          <div className="mx-4 mt-3 shrink-0">
            <div
              className="truncate rounded-lg px-3 py-2 text-[12px] font-medium"
              style={{
                background: "var(--color-tag-bg)",
                border: "1px solid var(--color-brand-light)",
                color: "var(--color-accent-sparkle)",
              }}
            >
              📊 Context: {context}
            </div>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-4 py-4">
            {messages.length === 0 && (
              <div className="space-y-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void send(s)}
                    disabled={asking}
                    className="block w-full rounded-lg border px-3.5 py-2.5 text-left text-[13px] transition-colors hover:bg-[var(--color-tag-bg)] disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      borderColor: "var(--color-border-default)",
                      color: "var(--color-text-secondary)",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--color-brand)")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--color-border-default)")}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m) => {
              if (m.role === "user") {
                return (
                  <div key={m.id} className="flex justify-end">
                    <div className="group flex max-w-[85%] flex-col items-end gap-1">
                      <div
                        className="rounded-xl px-3.5 py-2.5 text-[13px] text-white"
                        style={{
                          background: "var(--color-brand)",
                          borderRadius: "12px 12px 2px 12px",
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
                      <CopyButton text={m.text} className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100" />
                    </div>
                  </div>
                );
              }
              if (m.kind === "pdf-parsed") {
                return (
                  <AiBubble key={m.id}>
                    <div className="mb-2 flex items-center gap-2">
                      <FileIcon className="h-4 w-4 text-[var(--color-brand)]" />
                      <span className="text-[13px] font-semibold">{m.name}</span>
                      <span className="text-[11px] text-[var(--color-text-muted)]">· {m.pages} pages</span>
                    </div>
                    <p className="text-[12px] text-[var(--color-text-secondary)]">
                      Parsed and mapped to active sector pack. Extracted figures:
                    </p>
                    <ul className="mt-2 space-y-1 text-[12px]">
                      {m.entities.map((entity) => (
                        <li key={entity} className="flex items-start gap-1.5">
                          <Check className="mt-0.5 h-3 w-3 text-[var(--color-success-fg)]" />
                          <span>{entity}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => {
                        setOpen(false);
                        navigate({ to: "/diagnosis" });
                      }}
                      className="mt-3 h-8 w-full rounded-md text-[12px] font-semibold text-white"
                      style={{ background: "var(--color-brand)" }}
                    >
                      Send to Diagnosis →
                    </button>
                  </AiBubble>
                );
              }
              if (m.kind === "text") {
                return (
                  <AiBubble key={m.id} copyText={m.text}>
                    <MarkdownContent markdown={m.text} />
                  </AiBubble>
                );
              }
              if (m.kind === "stream") {
                return <StreamingAiBubble key={m.id} message={m} />;
              }
              if (m.kind === "clarify") {
                return (
                  <AiBubble key={m.id} copyText="I'll run a 5-year financial strength analysis.">
                    <div className="mb-3 text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                      I'll run a 5-year financial strength analysis. Please confirm the details:
                    </div>
                    {[
                      ["Company", `${cycle.company} (PSX: MTL)`],
                      ["Forecast horizon", "5 years (FY2026-FY2030)"],
                      ["Scenarios", "Base · Bull · Bear"],
                    ].map(([k, v], idx, arr) => (
                      <div
                        key={k}
                        className="flex items-center justify-between py-2"
                        style={{ borderBottom: idx < arr.length - 1 ? "1px solid #F3F4F6" : undefined }}
                      >
                        <span className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>
                          {k}
                        </span>
                        <span className="text-[13px] font-medium" style={{ color: "var(--color-text-primary)" }}>
                          {v}
                        </span>
                      </div>
                    ))}
                    <button
                      onClick={runPrediction}
                      className="mt-3 h-9 w-full rounded-lg text-[13px] font-semibold text-white"
                      style={{ background: "var(--color-brand)" }}
                    >
                      Run prediction →
                    </button>
                  </AiBubble>
                );
              }
              if (m.kind === "status") {
                return <StatusStream key={m.id} steps={m.steps} />;
              }
              if (m.kind === "prediction") {
                return (
                  <AiBubble
                    key={m.id}
                    copyText={`${cycle.company} is projected to grow revenue at 11.2% CAGR under the base case.`}
                  >
                    <p className="text-[13px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                      {cycle.company} is projected to grow revenue at <b>11.2% CAGR</b> under the base
                      case (PKR 54.8B → PKR 78.4B by FY2030), driven by sustained tractor unit growth
                      and improving plant utilisation.
                    </p>
                    <MiniChart />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {["KIBOR 18.5%", "CPI 11.2%", "Tractor units +5.6% CAGR"].map((p) => (
                        <span
                          key={p}
                          className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                          style={{
                            background: "var(--color-success-bg)",
                            border: "1px solid var(--color-success-border)",
                            color: "var(--color-success-fg)",
                          }}
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                    {[
                      "±1K tractor units = ±PKR 0.9B revenue impact",
                      "KIBOR at 22%+ compresses margin ~180bps",
                    ].map((r) => (
                      <div
                        key={r}
                        className="mt-2 flex items-start gap-1.5 rounded-r-md px-3 py-1.5 text-[12px]"
                        style={{
                          background: "#FFFBEB",
                          borderLeft: "3px solid var(--color-warning)",
                          color: "var(--color-warning-fg)",
                        }}
                      >
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>{r}</span>
                      </div>
                    ))}
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => {
                          setOpen(false);
                          navigate({ to: "/forecast" });
                        }}
                        className="flex-1 rounded-md border px-3 py-2 text-[12px] font-semibold"
                        style={{
                          borderColor: "var(--color-border-strong)",
                          color: "var(--color-text-secondary)",
                          background: "#fff",
                        }}
                      >
                        Open forecast →
                      </button>
                      <button
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent("sherlock-toast", { detail: "Added to Assumptions sheet" }));
                        }}
                        className="flex-1 rounded-md px-3 py-2 text-[12px] font-semibold text-white"
                        style={{ background: "var(--color-brand)" }}
                      >
                        + Assumptions
                      </button>
                    </div>
                  </AiBubble>
                );
              }
              return null;
            })}
          </div>

          <div
            className="flex items-end gap-2 border-t p-3"
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
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Attach PDF"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border hover:bg-[var(--color-tag-bg)]"
              style={{
                borderColor: "var(--color-border-default)",
                color: "var(--color-text-secondary)",
              }}
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <textarea
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
              placeholder="Ask anything about this model…"
              rows={1}
              className="max-h-[120px] min-h-11 flex-1 resize-none overflow-hidden rounded-lg border px-4 py-2.5 text-[13px] leading-5 outline-none transition-colors focus:border-[var(--color-brand)]"
              style={{ borderColor: "var(--color-border-default)", color: "var(--color-text-primary)" }}
            />
            <button
              onClick={() => void send(input)}
              disabled={!input.trim() || asking}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white disabled:opacity-40"
              style={{ background: "var(--color-brand)" }}
            >
              {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </aside>
      )}
    </>
  );
}

function AiBubble({ children, copyText, wide = false }: { children: ReactNode; copyText?: string; wide?: boolean }) {
  return (
    <div className="flex w-full min-w-0">
      <div className={`${wide ? "w-full sm:w-[92%]" : "max-w-[92%]"} group flex min-w-0 flex-col items-end gap-1`}>
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
          <CopyButton text={copyText} className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100" />
        )}
      </div>
    </div>
  );
}

function StreamingAiBubble({ message }: { message: Extract<Msg, { kind: "stream" }> }) {
  const citations = message.final?.sourcesUsed ?? [];
  const reasoning = buildAskAiReasoningSummary({
    activity: message.activity,
    approaches: message.approaches,
    done: message.done,
    final: message.final,
  });

  return (
    <AiBubble copyText={message.final?.answer ?? message.text} wide>
      <div className="min-w-0 space-y-3 overflow-hidden">
        <CurrentEventPanel summary={reasoning} message={message} />
        {(message.activity.length > 0 || message.approaches.length > 0) && <ReasoningCapsule summary={reasoning} />}
        {message.error ? (
          <div
            className="break-words rounded-md px-3 py-2 text-[12px]"
            style={{ background: "var(--color-danger-bg)", color: "var(--color-danger-fg)" }}
          >
            {message.error}
          </div>
        ) : null}

        {message.text || message.done ? (
          <div className="min-w-0 overflow-hidden break-words">
            <MarkdownContent markdown={message.text} />
          </div>
        ) : (
          <div className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>
            The answer will appear here as soon as the model starts streaming tokens.
          </div>
        )}

        {citations.length > 0 && (
          <div className="min-w-0 overflow-hidden border-t pt-2" style={{ borderColor: "var(--color-border-default)" }}>
            <div className="mb-1 text-[11px] font-semibold" style={{ color: "var(--color-text-muted)" }}>
              Sources used ({citations.length})
            </div>
            <div className="flex max-w-full gap-1.5 overflow-x-auto pb-1">
              {citations.slice(0, 4).map((citation, index) => (
                <div
                  key={index}
                  className="min-w-[180px] rounded-md border bg-white px-2.5 py-1.5 text-[11px]"
                  style={{ borderColor: "var(--color-border-default)", color: "var(--color-text-secondary)" }}
                >
                  <div className="truncate font-semibold" style={{ color: "var(--color-text-primary)" }}>
                    {getAskAiCitationTitle(citation)}
                  </div>
                  <div className="mt-1 line-clamp-2">{String(citation.excerpt ?? citation.currentValue ?? "")}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(message.final?.warnings?.length ?? 0) > 0 && (
          <div
            className="rounded-md px-2.5 py-1.5 text-[12px]"
            style={{ background: "#FFFBEB", color: "var(--color-warning-fg)" }}
          >
            {message.final!.warnings.join(" · ")}
          </div>
        )}
      </div>
    </AiBubble>
  );
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

  return (
    <div
      className="min-w-0 rounded-lg border px-3 py-2.5"
      style={{ borderColor: "rgba(123,104,238,0.22)", background: "#FAFBFF" }}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
            style={{
              background: message.done ? "var(--color-success-bg)" : "var(--color-tag-bg)",
              color: message.done ? "var(--color-success)" : "var(--color-brand)",
            }}
          >
            {message.done ? <Check className="h-3.5 w-3.5" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[12px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
              {current.title}
            </div>
            <div className="mt-0.5 break-words text-[12px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
              {current.message}
            </div>
          </div>
        </div>
        <span className="shrink-0 text-[11px] font-medium" style={{ color: "var(--color-text-muted)" }}>
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
  if (kind === "uploaded_pdf") return "Uploaded PDF evidence";
  if (kind === "uploaded_sheet") return "Uploaded spreadsheet context";
  if (kind === "model") return "Workbook model fields";
  if (kind === "source_registry") return "Source registry evidence";
  if (kind === "web") return "Approved web sources";
  return "Evidence source";
}

function ReasoningCapsule({ summary }: { summary: AskAiReasoningSummary }) {
  const isComplete = summary.state === "complete";
  return (
    <details
      className="group w-full min-w-0 overflow-hidden rounded-[10px] border bg-white/95 px-3 py-2 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all"
      style={{ borderColor: "rgba(123,104,238,0.18)" }}
    >
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-3 outline-none"
        aria-label="Toggle reasoning trail"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
            style={{
              background: isComplete ? "var(--color-success-bg)" : "var(--color-tag-bg)",
              color: isComplete ? "var(--color-success)" : "var(--color-brand)",
            }}
          >
            {isComplete ? <Check className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5 animate-ss-pulse" />}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[12px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
              {summary.compactLabel}
            </div>
            {!isComplete && summary.chips.length > 0 && (
              <div className="mt-1 flex max-w-full gap-1 overflow-x-auto pb-0.5">
                {summary.chips.map((chip) => (
                  <span
                    key={chip}
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{ background: "#F5F7FB", color: "var(--color-text-muted)" }}
                  >
                    {chip}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium" style={{ color: "var(--color-text-muted)" }}>
          Trail
          <ChevronRight className="h-3.5 w-3.5 details-closed-icon" />
          <ChevronDown className="hidden h-3.5 w-3.5 details-open-icon" />
        </span>
      </summary>

      <div
        className="mt-2 max-h-[160px] min-w-0 space-y-3 overflow-y-auto overflow-x-hidden rounded-lg border px-3 py-2.5"
        style={{ background: "#FAFBFF", borderColor: "var(--color-border-default)" }}
      >
        {summary.groups.map((group) => (
          <div key={group.title}>
            <div className="mb-1 text-[10px] font-semibold uppercase" style={{ color: "var(--color-text-muted)" }}>
              {group.title}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-2 text-[12px] leading-relaxed"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full" style={{ background: "var(--color-brand)" }} />
                  <span className="min-w-0 break-words">{item}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {summary.warnings.length > 0 && (
          <div className="rounded-md px-2.5 py-2 text-[12px]" style={{ background: "#FFFBEB", color: "var(--color-warning-fg)" }}>
            {summary.warnings.join(" · ")}
          </div>
        )}
      </div>
    </details>
  );
}

function CopyButton({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
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
                  <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "var(--color-brand)" }} />
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

function MiniChart() {
  const w = 280;
  const h = 100;
  const base = [54.8, 60.1, 65.4, 70.2, 74.3, 78.4];
  const bull = [54.8, 62.4, 70.8, 79.1, 87.0, 95.6];
  const bear = [54.8, 56.0, 57.8, 59.6, 61.0, 62.5];
  const min = 50;
  const max = 100;
  const xy = (vals: number[]) =>
    vals.map((v, i) => [
      (i * w) / (vals.length - 1),
      h - ((v - min) / (max - min)) * h,
    ]);
  const path = (vals: number[]) =>
    xy(vals)
      .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`)
      .join(" ");
  return (
    <div className="mt-3 -mx-1">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h}>
        <path d={path(base)} fill="none" stroke="#7B68EE" strokeWidth={2} />
        <path d={path(bull)} fill="none" stroke="#22C55E" strokeWidth={1.4} strokeDasharray="3 3" opacity={0.8} />
        <path d={path(bear)} fill="none" stroke="#F44336" strokeWidth={1.4} strokeDasharray="3 3" opacity={0.8} />
      </svg>
      <div className="mt-1 flex items-center gap-3 text-[10px]" style={{ color: "var(--color-text-muted)" }}>
        <TrendingUp className="h-3 w-3" /> Revenue FY26–30 (PKR B) · Base / Bull / Bear
      </div>
    </div>
  );
}

function screenNameForPath(path: string): string {
  const clean = path.replace(/^\/+/, "") || "Dashboard";
  return clean
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
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
