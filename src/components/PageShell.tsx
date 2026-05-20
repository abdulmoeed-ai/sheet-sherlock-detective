import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function PageShell({ title, subtitle, actions, children }: Props) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-page)]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <header
          className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-white px-8"
          style={{ borderColor: "var(--color-border-default)" }}
        >
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
              Sheet Sherlock
            </span>
            <span className="text-[14px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
              {title}
            </span>
          </div>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
        <div className="px-8 py-7">
          <div className="mb-6">
            <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1 text-[14px]" style={{ color: "var(--color-text-secondary)" }}>
                {subtitle}
              </p>
            ) : null}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border bg-white p-5 ${className}`}
      style={{ borderColor: "var(--color-border-default)" }}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "danger" | "warning" | "info" | "ai";
}) {
  const tones: Record<string, { bg: string; fg: string }> = {
    neutral: { bg: "#F3F4F6", fg: "#4B5563" },
    success: { bg: "var(--color-success-bg)", fg: "#15803D" },
    danger: { bg: "var(--color-danger-bg)", fg: "#B91C1C" },
    warning: { bg: "var(--color-warning-bg)", fg: "#B45309" },
    info: { bg: "var(--color-info-bg)", fg: "#1D4ED8" },
    ai: { bg: "var(--color-tag-bg)", fg: "var(--color-accent-sparkle)" },
  };
  const t = tones[tone];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
      style={{ background: t.bg, color: t.fg }}
    >
      {children}
    </span>
  );
}
