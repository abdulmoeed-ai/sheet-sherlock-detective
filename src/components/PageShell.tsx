import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { CycleProgress } from "./CycleProgress";
import { ProductWordmark } from "./ProductWordmark";

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  hideProgress?: boolean;
}

export function PageShell({ title, subtitle, actions, children, hideProgress }: Props) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-page)]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <header
          className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-white px-8"
          style={{ borderColor: "var(--color-border-default)" }}
        >
          <div className="flex items-center leading-tight">
            <ProductWordmark
              className="text-[22px] font-bold tracking-normal text-[var(--color-text-primary)]"
              aiClassName="text-[var(--color-brand)]"
            />
          </div>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
        <div className="px-8 py-7 pr-20">
          <div className="mb-6">
            <h1
              className="text-[22px] font-bold tracking-tight"
              style={{ color: "var(--color-text-primary)" }}
            >
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1 text-[14px]" style={{ color: "var(--color-text-secondary)" }}>
                {subtitle}
              </p>
            ) : null}
          </div>
          {!hideProgress && <CycleProgress />}
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
    success: { bg: "var(--color-success-bg)", fg: "var(--color-success-fg)" },
    danger: { bg: "var(--color-danger-bg)", fg: "var(--color-danger-fg)" },
    warning: { bg: "var(--color-warning-bg)", fg: "var(--color-warning-fg)" },
    info: { bg: "var(--color-info-bg)", fg: "#0E7FB0" },
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
