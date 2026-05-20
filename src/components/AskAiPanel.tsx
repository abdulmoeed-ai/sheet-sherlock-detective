import { Sparkles, Pencil, X, Send } from "lucide-react";
import type { ReactNode } from "react";

interface Message {
  role: "user" | "ai";
  content: ReactNode;
}

export function AskAiPanel({
  title = "Ask AI",
  messages,
  quickActions = ["Trace this cell", "Why imbalanced?", "Compare to Q3"],
}: {
  title?: string;
  messages: Message[];
  quickActions?: string[];
}) {
  return (
    <aside
      className="flex h-full w-[380px] flex-col rounded-xl border bg-white"
      style={{ borderColor: "var(--color-border-default)", borderTop: "3px solid var(--color-accent-green)" }}
    >
      <div
        className="flex items-center justify-between border-b px-5 py-3"
        style={{ borderColor: "var(--color-border-default)" }}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: "var(--color-accent-sparkle)" }} />
          <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-accent-sparkle)" }}>
            Sherlock AI
          </span>
        </div>
        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
          <Pencil className="h-[18px] w-[18px]" />
          <X className="h-[18px] w-[18px]" />
        </div>
      </div>

      <div className="border-b px-5 py-3" style={{ borderColor: "var(--color-border-default)" }}>
        <div className="text-[16px] font-bold text-[var(--color-text-primary)]">{title}</div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div
              className="max-w-[90%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed"
              style={
                m.role === "user"
                  ? { background: "var(--color-brand)", color: "#fff", borderRadius: "12px 12px 2px 12px" }
                  : { background: "#fff", color: "var(--color-text-primary)", border: "1px solid var(--color-border-default)", borderRadius: "12px 12px 12px 2px" }
              }
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 px-5 pb-2">
        {quickActions.map((q) => (
          <button
            key={q}
            className="flex items-center gap-1.5 rounded-md border bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent-green)] hover:bg-[var(--color-tag-bg)]"
            style={{ borderColor: "var(--color-border-default)" }}
          >
            <Sparkles className="h-3 w-3" style={{ color: "var(--color-accent-mid)" }} />
            {q}
          </button>
        ))}
      </div>

      <div className="border-t p-3" style={{ borderColor: "var(--color-border-default)" }}>
        <div
          className="flex items-center gap-2 rounded-lg border px-3 py-2"
          style={{ borderColor: "var(--color-border-strong)" }}
        >
          <input
            placeholder="Ask about any cell, source or assumption…"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--color-text-muted)]"
          />
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md text-white"
            style={{ background: "var(--color-brand)" }}
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
