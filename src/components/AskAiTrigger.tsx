import { useState, useEffect, useRef } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Sparkles,
  X,
  Send,
  Check,
  Loader2,
  TrendingUp,
  AlertTriangle,
  Paperclip,
  FileText as FileIcon,
} from "lucide-react";
import { useCycle } from "@/lib/cycle-store";

type Msg =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "ai"; kind: "text"; text: string }
  | { id: string; role: "ai"; kind: "clarify" }
  | { id: string; role: "ai"; kind: "status"; steps: string[] }
  | { id: string; role: "ai"; kind: "prediction" };

const SUGGESTIONS = [
  "📈 Analyse Millat Tractors' financial strength for the next 5 years",
  "⚖️  Why doesn't my balance sheet balance?",
  "📊 What are the key assumptions driving the FY2025 forecast?",
];

export function AskAiTrigger() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const cycle = useCycle();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  const send = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", text };
    setMessages((m) => [...m, userMsg]);
    setInput("");

    // Prediction flow trigger
    if (/financial strength|next 5 years|predict|forecast/i.test(text)) {
      setTimeout(() => {
        setMessages((m) => [...m, { id: `c-${Date.now()}`, role: "ai", kind: "clarify" }]);
      }, 400);
      return;
    }

    // Generic AI reply
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: "ai",
          kind: "text",
          text:
            /balance/i.test(text)
              ? "The most common cause of imbalance is a missing credit entry. Sherlock traced your current cycle's imbalance to BS!D42 (Inventory). Open the Diagnosis tab to review the proposed correction."
              : "Here's a summary of the key assumptions: KIBOR 18.5% (SBP), CPI 11.2% YoY (PBS), Tractor unit sales CAGR +5.6% (PAMA). All cited and editable in the Assumptions sheet.",
        },
      ]);
    }, 800);
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
      {/* Trigger */}
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

      {/* Panel */}
      {open && (
        <aside
          className="fixed right-0 top-0 z-50 flex h-screen w-[380px] flex-col bg-white slide-in-right"
          style={{ borderLeft: "1px solid var(--color-border-default)", boxShadow: "-12px 0 32px -16px rgba(0,0,0,0.1)" }}
        >
          {/* Header */}
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
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1 hover:bg-[var(--color-tag-bg)]"
              aria-label="Close"
            >
              <X className="h-[18px] w-[18px]" style={{ color: "var(--color-text-muted)" }} />
            </button>
          </div>

          {/* Context pill */}
          <div className="mx-4 mt-3">
            <div
              className="rounded-lg px-3 py-2 text-[12px] font-medium"
              style={{
                background: "var(--color-tag-bg)",
                border: "1px solid var(--color-brand-light)",
                color: "var(--color-accent-sparkle)",
              }}
            >
              📊 Context: {cycle.period} · {cycle.company} · {cycle.sector} sector
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="space-y-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="block w-full rounded-lg border px-3.5 py-2.5 text-left text-[13px] transition-colors hover:bg-[var(--color-tag-bg)]"
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
                    <div
                      className="max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] text-white"
                      style={{
                        background: "var(--color-brand)",
                        borderRadius: "12px 12px 2px 12px",
                      }}
                    >
                      {m.text}
                    </div>
                  </div>
                );
              }
              if (m.kind === "text") {
                return <AiBubble key={m.id}>{m.text}</AiBubble>;
              }
              if (m.kind === "clarify") {
                return (
                  <AiBubble key={m.id}>
                    <div className="mb-3 text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                      I'll run a 5-year financial strength analysis. Please confirm the details:
                    </div>
                    {[
                      ["Company", `${cycle.company} (PSX: MTL)`],
                      ["Forecast horizon", "5 years (FY2026–FY2030)"],
                      ["Scenarios", "Base · Bull · Bear"],
                    ].map(([k, v], idx, arr) => (
                      <div
                        key={k}
                        className="flex items-center justify-between py-2"
                        style={{
                          borderBottom: idx < arr.length - 1 ? "1px solid #F3F4F6" : undefined,
                        }}
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
                  <AiBubble key={m.id}>
                    <p className="text-[13px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                      {cycle.company} is projected to grow revenue at <b>11.2% CAGR</b> under the base case
                      (PKR 54.8B → PKR 78.4B by FY2030), driven by sustained tractor unit growth and
                      improving plant utilisation.
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

          {/* Input */}
          <div
            className="flex items-center gap-2 border-t p-3"
            style={{ borderColor: "var(--color-border-default)" }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send(input);
              }}
              placeholder="Ask anything about this model…"
              className="flex-1 rounded-lg border px-3.5 py-2 text-[13px] outline-none transition-colors focus:border-[var(--color-brand)]"
              style={{ borderColor: "var(--color-border-default)", color: "var(--color-text-primary)" }}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white disabled:opacity-40"
              style={{ background: "var(--color-brand)" }}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </aside>
      )}
    </>
  );
}

function AiBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <div
        className="max-w-[92%] rounded-xl border bg-white px-3.5 py-3 text-[13px]"
        style={{
          borderColor: "var(--color-border-default)",
          borderRadius: "12px 12px 12px 2px",
          color: "var(--color-text-primary)",
        }}
      >
        {children}
      </div>
    </div>
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

// Listen for cross-component toasts triggered from any page
export function useGlobalToast() {
  const routerLoc = useRouterState({ select: (s) => s.location.pathname });
  return routerLoc;
}
