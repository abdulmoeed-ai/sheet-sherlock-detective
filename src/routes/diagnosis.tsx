import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { PageShell } from "@/components/PageShell";
import { cycleStore, useCycle } from "@/lib/cycle-store";
import { CheckCircle2, AlertCircle, Loader2, Sparkles, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/diagnosis")({
  head: () => ({
    meta: [
      { title: "Diagnosis — Sheet Sherlock" },
      { name: "description", content: "AI-driven 3-statement reconciliation with cell-level imbalance diagnosis." },
    ],
  }),
  component: Diagnosis,
});

const OVERRIDE_REASONS = [
  "Sign error (positive/negative reversed)",
  "Wrong period (retrospective correction)",
  "Intercompany mismatch",
  "Other (free text)",
];

function Diagnosis() {
  const navigate = useNavigate();
  const cycle = useCycle();
  const [checking, setChecking] = useState(true);
  const [state, setState] = useState<"imbalance" | "clean">("imbalance");
  const [reason, setReason] = useState<string | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [reChecking, setReChecking] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setChecking(false), 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOverrideOpen(false);
      }
    };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const applyCorrection = () => {
    setReChecking(true);
    setTimeout(() => {
      setReChecking(false);
      setState("clean");
    }, 1000);
  };

  if (checking) {
    return (
      <PageShell title={`Diagnosis — ${cycle.period} · ${cycle.company}`} subtitle="Running 3-statement check">
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--color-brand)" }} />
          <p className="mt-3 text-[14px]" style={{ color: "var(--color-text-secondary)" }}>
            Running 3-statement check...
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title={`Diagnosis — ${cycle.period} · ${cycle.company}`} subtitle="3-statement reconciliation review">
      {state === "clean" ? (
        <>
          <div
            className="mb-5 flex items-center gap-3 rounded-[10px] border px-5 py-4"
            style={{ background: "var(--color-success-bg)", borderColor: "var(--color-success-border)" }}
          >
            <CheckCircle2 className="h-[22px] w-[22px]" style={{ color: "var(--color-success-fg)" }} />
            <div className="text-[14px] font-semibold" style={{ color: "var(--color-success-fg)" }}>
              Balance sheet is balanced. All three statements reconcile.
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <RatioCard label="EBITDA Margin" value="23.6%" delta="↑ 2.1 pts" />
            <RatioCard label="Debt / Equity" value="0.82x" delta="↓ improving" />
            <RatioCard label="Int. Cover" value="4.2x" delta="↑ improving" />
          </div>

          <StickyFooter
            right={
              <button
                onClick={() => {
                  cycleStore.setStatus("forecast");
                  navigate({ to: "/forecast" });
                }}
                className="h-10 rounded-lg px-5 text-[13px] font-semibold text-white"
                style={{ background: "var(--color-brand)" }}
              >
                Continue to forecast →
              </button>
            }
          />
        </>
      ) : (
        <>
          <div
            className="mb-5 flex items-center gap-3 rounded-[10px] border px-5 py-4"
            style={{ background: "var(--color-danger-bg)", borderColor: "#FECACA" }}
          >
            <AlertCircle className="h-[22px] w-[22px]" style={{ color: "var(--color-danger-fg)" }} />
            <div className="text-[14px] font-semibold" style={{ color: "var(--color-danger-fg)" }}>
              Balance sheet imbalance detected — PKR 4.2M unreconciled.
            </div>
          </div>

          {reChecking ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--color-brand)" }} />
              <p className="mt-3 text-[14px]" style={{ color: "var(--color-text-secondary)" }}>
                Applying correction & re-checking...
              </p>
            </div>
          ) : (
            <div className="rounded-xl border bg-white px-6 py-5" style={{ borderColor: "var(--color-border-default)" }}>
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--color-accent-sparkle)" }} />
                <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-accent-sparkle)" }}>
                  Sherlock AI · Diagnosis
                </span>
              </div>

              <div className="mt-4 divide-y" style={{ borderColor: "#F3F4F6" }}>
                {[
                  ["Causal cell", "Inventory!D42"],
                  ["Classification", "Missing credit entry (sign error)"],
                  ["Imbalance amount", "PKR 4.2M"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between py-2.5" style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <span className="text-[13px] font-medium" style={{ color: "#374151" }}>
                      {k}
                    </span>
                    <span className="text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                      {v}
                    </span>
                  </div>
                ))}
              </div>

              <div
                className="mt-4 rounded-lg px-4 py-3.5"
                style={{ background: "#F0FDF4" }}
              >
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                  Proposed corrective journal entry
                </div>
                <div className="space-y-1 font-mono text-[13px]" style={{ color: "var(--color-text-primary)" }}>
                  <div className="flex justify-between">
                    <span>Dr&nbsp;&nbsp;Cash &amp; Equivalents&nbsp;&nbsp;BS!F18</span>
                    <span className="font-semibold">+PKR 4.2M</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cr&nbsp;&nbsp;Inventory&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;BS!D42</span>
                    <span className="font-semibold">−PKR 4.2M</span>
                  </div>
                </div>
                <div className="mt-2 text-right text-[12px] font-medium" style={{ color: "var(--color-success-fg)" }}>
                  Confidence: High (91%)
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOverrideOpen((o) => !o);
                    }}
                    className="flex h-9 items-center gap-1.5 rounded-lg border px-3.5 text-[13px] font-semibold"
                    style={{
                      borderColor: "var(--color-border-strong)",
                      color: "var(--color-text-secondary)",
                      background: "#fff",
                    }}
                  >
                    {reason ?? "Override"} <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  {overrideOpen && (
                    <div
                      className="absolute right-0 top-11 z-10 min-w-[260px] rounded-lg border bg-white py-1 shadow-lg"
                      style={{ borderColor: "var(--color-border-default)" }}
                    >
                      {OVERRIDE_REASONS.map((r) => (
                        <button
                          key={r}
                          onClick={() => {
                            setReason(r);
                            setOverrideOpen(false);
                          }}
                          className="block w-full px-3 py-2 text-left text-[12px] hover:bg-[var(--color-tag-bg)]"
                          style={{ color: "var(--color-text-secondary)" }}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={applyCorrection}
                  className="h-9 rounded-lg px-4 text-[13px] font-semibold text-white"
                  style={{ background: "var(--color-brand)" }}
                >
                  Apply correction →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}

function RatioCard({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <div className="rounded-xl border bg-white px-5 py-4" style={{ borderColor: "var(--color-border-default)" }}>
      <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </div>
      <div className="mt-2 text-[26px] font-bold tnum" style={{ color: "var(--color-text-primary)" }}>
        {value}
      </div>
      <div className="mt-1 text-[12px] font-semibold" style={{ color: "var(--color-success-fg)" }}>
        {delta}
      </div>
    </div>
  );
}

function StickyFooter({ right }: { right: React.ReactNode }) {
  return (
    <div
      className="fixed bottom-0 left-[240px] right-0 z-20 flex h-16 items-center justify-end border-t bg-white px-8"
      style={{ borderColor: "var(--color-border-default)" }}
    >
      {right}
    </div>
  );
}
