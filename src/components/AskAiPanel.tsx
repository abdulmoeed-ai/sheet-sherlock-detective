import { Sparkles, Pencil, X, Send, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";

export type Citation =
  | { kind: "web"; name: string; date: string; url: string; excerpt: string }
  | { kind: "model"; cell: string; sheet: string; value: string; lastWrittenBy: string }
  | { kind: "ingestion"; doc: string; page: number; timestamp: string };

interface Message {
  role: "user" | "ai";
  content: ReactNode;
  citations?: Citation[];
  expandCitations?: boolean;
}

function CitationCard({ c }: { c: Citation }) {
  if (c.kind === "web") {
    return (
      <a
        href={c.url}
        target="_blank"
        rel="noreferrer"
        className="flex h-[64px] w-[240px] flex-shrink-0 flex-col justify-between rounded-md border bg-white px-2.5 py-1.5 hover:bg-[var(--color-tag-bg)]"
        style={{ borderColor: "var(--color-border-default)" }}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="truncate text-[11px] font-bold" style={{ color: "var(--color-text-primary)" }}>{c.name}</span>
          <ExternalLink className="h-3 w-3 flex-shrink-0" style={{ color: "var(--color-text-muted)" }} />
        </div>
        <div className="line-clamp-2 text-[10px] leading-snug" style={{ color: "var(--color-text-muted)" }}>
          {c.excerpt}
        </div>
        <div className="text-[9px]" style={{ color: "var(--color-text-muted)" }}>{c.date}</div>
      </a>
    );
  }
  if (c.kind === "model") {
    return (
      <div
        className="flex h-[64px] w-[200px] flex-shrink-0 flex-col justify-between rounded-md border-2 bg-white px-2.5 py-1.5"
        style={{ borderColor: "var(--color-brand)" }}
      >
        <div className="text-[11px] font-bold" style={{ color: "var(--color-brand)" }}>
          {c.sheet}!{c.cell}
        </div>
        <div className="truncate text-[11px] font-semibold tnum" style={{ color: "var(--color-text-primary)" }}>{c.value}</div>
        <div className="truncate text-[9px]" style={{ color: "var(--color-text-muted)" }}>last: {c.lastWrittenBy}</div>
      </div>
    );
  }
  return (
    <div
      className="flex h-[64px] w-[220px] flex-shrink-0 flex-col justify-between rounded-md border bg-white px-2.5 py-1.5"
      style={{ borderColor: "var(--color-border-default)" }}
    >
      <div className="truncate text-[11px] font-bold" style={{ color: "var(--color-text-primary)" }}>{c.doc}</div>
      <div className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Page {c.page}</div>
      <div className="text-[9px]" style={{ color: "var(--color-text-muted)" }}>ingested {c.timestamp}</div>
    </div>
  );
}

function MessageBubble({ m }: { m: Message }) {
  const [open, setOpen] = useState<boolean>(!!m.expandCitations);
  const hasCitations = m.role === "ai" && m.citations && m.citations.length > 0;
  return (
    <div className={m.role === "user" ? "flex justify-end" : ""}>
      <div className={m.role === "user" ? "max-w-[90%]" : "max-w-[95%]"}>
        <div
          className="rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed"
          style={
            m.role === "user"
              ? { background: "var(--color-brand)", color: "#fff", borderRadius: "12px 12px 2px 12px" }
              : { background: "#fff", color: "var(--color-text-primary)", border: "1px solid var(--color-border-default)", borderRadius: "12px 12px 12px 2px" }
          }
        >
          {m.content}
        </div>
        {hasCitations && (
          <div className="mt-1.5">
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-1 text-[10px] font-semibold"
              style={{ color: "var(--color-text-muted)" }}
            >
              {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Sources used ({m.citations!.length})
            </button>
            {open && (
              <div className="mt-1 flex gap-1.5 overflow-x-auto pb-1">
                {m.citations!.map((c, i) => (
                  <CitationCard key={i} c={c} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
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
      <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: "var(--color-border-default)" }}>
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
          <MessageBubble key={i} m={m} />
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
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: "var(--color-border-strong)" }}>
          <input
            placeholder="Ask about any cell, source or assumption…"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--color-text-muted)]"
          />
          <button className="flex h-7 w-7 items-center justify-center rounded-md text-white" style={{ background: "var(--color-brand)" }}>
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
