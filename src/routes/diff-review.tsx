import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell } from "@/components/PageShell";
import { cycleStore, useCycle } from "@/lib/cycle-store";
import { Lock, Check, X } from "lucide-react";

export const Route = createFileRoute("/diff-review")({
  head: () => ({
    meta: [
      { title: "Diff Review — Sheet Sherlock" },
      { name: "description", content: "Review cell-level diffs with materiality tiering before applying to your live model." },
    ],
  }),
  component: DiffReview,
});

type Tier = "auto" | "confirm" | "block";
interface Diff {
  cell: string;
  sheet: string;
  field: string;
  old: string;
  next: string;
  source: string;
  conf: number;
  tier: Tier;
  /** sheet cell coords (row, col) in model preview for flash highlight */
  preview: [number, number];
}

const DIFFS: Diff[] = [
  { cell: "C12", sheet: "IS",    field: "Revenue FY2025", old: "PKR 48.7B",  next: "PKR 54.8B",  source: "PSX", conf: 97, tier: "auto",    preview: [1, 2] },
  { cell: "C18", sheet: "IS",    field: "EBITDA",         old: "PKR 10.4B",  next: "PKR 12.9B",  source: "PSX", conf: 94, tier: "auto",    preview: [2, 2] },
  { cell: "D14", sheet: "BS",    field: "Total Assets",   old: "PKR 98.2B",  next: "PKR 112.4B", source: "OCR", conf: 76, tier: "confirm", preview: [4, 3] },
  { cell: "D22", sheet: "BS",    field: "Net Debt",       old: "PKR 18.4B",  next: "PKR 22.1B",  source: "SBP", conf: 91, tier: "confirm", preview: [6, 3] },
  { cell: "F18", sheet: "BS",    field: "Cash & equiv",   old: "PKR 4.2B",   next: "PKR 3.1B",   source: "OCR", conf: 68, tier: "block",   preview: [5, 5] },
  { cell: "D42", sheet: "BS",    field: "Inventory",      old: "PKR 12.1B",  next: "PKR 19.8B",  source: "OCR", conf: 71, tier: "block",   preview: [7, 3] },
];

function DiffReview() {
  const navigate = useNavigate();
  const cycle = useCycle();
  const [resolved, setResolved] = useState<Record<number, boolean>>({
    0: true, // auto-approved start resolved
    1: true,
  });
  const [justifying, setJustifying] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [flashCell, setFlashCell] = useState<string | null>(null);

  const total = DIFFS.length;
  const doneCount = Object.values(resolved).filter(Boolean).length;
  const pct = (doneCount / total) * 100;
  const allDone = doneCount === total;

  const approveRow = (i: number) => {
    setResolved((r) => ({ ...r, [i]: true }));
    const d = DIFFS[i];
    const key = `${d.preview[0]}-${d.preview[1]}`;
    setFlashCell(key);
    setTimeout(() => setFlashCell(null), 1000);
  };

  return (
    <PageShell
      title={`Diff Review — ${cycle.period} · ${cycle.company}`}
      subtitle="Approve cell-level changes before they apply to your live model"
    >
      <div className="grid grid-cols-[55fr_45fr] gap-5">
        {/* LEFT — diff queue */}
        <div
          className="overflow-hidden rounded-xl border bg-white"
          style={{ borderColor: "var(--color-border-default)" }}
        >
          <div className="border-b px-5 py-4" style={{ borderColor: "var(--color-border-default)" }}>
            <div className="flex items-center justify-between">
              <div className="text-[14px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                {total} changes detected
              </div>
              <div className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>
                {doneCount} of {total} resolved
              </div>
            </div>
            <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full" style={{ background: "var(--color-border-default)" }}>
              <div className="h-full transition-all" style={{ width: `${pct}%`, background: "var(--color-brand)" }} />
            </div>
          </div>

          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[10px] uppercase" style={{ color: "var(--color-text-muted)", background: "var(--color-table-header)" }}>
                <th className="px-3 py-2">Cell</th>
                <th className="px-2 py-2">Sheet</th>
                <th className="px-2 py-2">Field</th>
                <th className="px-2 py-2 text-right">Old</th>
                <th className="px-2 py-2 text-right">New</th>
                <th className="px-2 py-2">Src</th>
                <th className="px-2 py-2 text-right">Conf</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {DIFFS.map((d, i) => {
                const isResolved = !!resolved[i];
                const blocked = d.tier === "block";
                return (
                  <Row key={i}>
                    <tr
                      className="border-b"
                      style={{
                        borderColor: "var(--color-border-default)",
                        background: blocked && !isResolved ? "#FEF9F0" : "#fff",
                        opacity: isResolved && d.tier === "auto" ? 0.55 : 1,
                      }}
                    >
                      <td
                        className="px-3 py-2.5 font-mono"
                        style={{
                          borderLeft: blocked && !isResolved ? "3px solid var(--color-warning)" : undefined,
                          paddingLeft: blocked && !isResolved ? 10 : undefined,
                        }}
                      >
                        {d.cell}
                      </td>
                      <td className="px-2 py-2.5 text-[var(--color-text-muted)]">{d.sheet}</td>
                      <td className="px-2 py-2.5">{d.field}</td>
                      <td className="px-2 py-2.5 text-right tnum line-through" style={{ color: "var(--color-text-muted)" }}>
                        {d.old}
                      </td>
                      <td className="px-2 py-2.5 text-right tnum font-semibold" style={{ color: blocked && !isResolved ? "var(--color-warning-fg)" : "var(--color-brand)" }}>
                        {d.next}
                      </td>
                      <td className="px-2 py-2.5 text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                        {d.source}
                      </td>
                      <td
                        className="px-2 py-2.5 text-right tnum font-semibold"
                        style={{
                          color: d.conf >= 90 ? "var(--color-success-fg)" : d.conf >= 80 ? "var(--color-warning-fg)" : "var(--color-danger-fg)",
                        }}
                      >
                        {d.conf}%
                      </td>
                      <td className="px-2 py-2.5">
                        <StatusPill tier={d.tier} resolved={isResolved} />
                      </td>
                      <td className="px-2 py-2.5">
                        {d.tier === "auto" || isResolved ? (
                          <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                            —
                          </span>
                        ) : d.tier === "confirm" ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => approveRow(i)}
                              className="flex h-6 items-center gap-1 rounded border px-1.5 text-[10px] font-semibold"
                              style={{ borderColor: "var(--color-success)", color: "var(--color-success-fg)" }}
                            >
                              <Check className="h-3 w-3" /> Approve
                            </button>
                            <button className="rounded border p-1" style={{ borderColor: "var(--color-border-default)" }}>
                              <X className="h-3 w-3" style={{ color: "var(--color-text-muted)" }} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setJustifying(i)}
                            className="h-6 rounded px-2 text-[10px] font-semibold text-white"
                            style={{ background: "var(--color-brand)" }}
                          >
                            Justify & approve
                          </button>
                        )}
                      </td>
                    </tr>
                    {justifying === i && !isResolved && (
                      <tr style={{ background: "#FEF9F0" }}>
                        <td colSpan={9} className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <input
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                              placeholder="Justification (e.g. matches signed audited statement, p.71)"
                              className="flex-1 rounded-md border px-3 py-1.5 text-[12px]"
                              style={{ borderColor: "var(--color-border-strong)" }}
                            />
                            <button
                              disabled={!reason.trim()}
                              onClick={() => {
                                approveRow(i);
                                setJustifying(null);
                                setReason("");
                              }}
                              className="h-8 rounded-md px-3 text-[12px] font-semibold text-white disabled:opacity-50"
                              style={{ background: "var(--color-brand)" }}
                            >
                              Submit
                            </button>
                            <button
                              onClick={() => setJustifying(null)}
                              className="h-8 rounded-md px-3 text-[12px] font-semibold"
                              style={{ color: "var(--color-text-secondary)" }}
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Row>
                );
              })}
            </tbody>
          </table>

          <div className="border-t p-4" style={{ borderColor: "var(--color-border-default)" }}>
            <button
              disabled={!allDone}
              onClick={() => {
                cycleStore.setStatus("diagnosis");
                navigate({ to: "/diagnosis" });
              }}
              className="h-11 w-full rounded-lg text-[13px] font-semibold text-white transition-opacity disabled:opacity-40"
              style={{ background: "var(--color-brand)" }}
            >
              Apply to model →
            </button>
          </div>
        </div>

        {/* RIGHT — model preview */}
        <ModelPreview flashCell={flashCell} resolved={resolved} />
      </div>
    </PageShell>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function StatusPill({ tier, resolved }: { tier: Tier; resolved: boolean }) {
  if (tier === "auto" || resolved) {
    return (
      <span
        className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
        style={{ background: "var(--color-success-bg)", color: "var(--color-success-fg)" }}
      >
        {tier === "auto" ? "Auto-approved" : "Approved"}
      </span>
    );
  }
  if (tier === "confirm") {
    return (
      <span
        className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
        style={{ background: "var(--color-warning-bg)", color: "var(--color-warning-fg)" }}
      >
        Confirm?
      </span>
    );
  }
  return (
    <span
      className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
      style={{ background: "var(--color-danger-bg)", color: "var(--color-danger-fg)" }}
    >
      Blocked
    </span>
  );
}

function ModelPreview({ flashCell, resolved }: { flashCell: string | null; resolved: Record<number, boolean> }) {
  // 12 rows × 7 columns
  const rowLabels = [
    "Revenue",
    "EBITDA",
    "Gross Profit",
    "Op. Expenses",
    "Total Assets",
    "Cash & equiv",
    "Net Debt",
    "Inventory",
    "Equity",
    "Liabilities",
    "Op. Cash Flow",
    "Free Cash Flow",
  ];
  const cols = ["A", "B", "C", "D", "E", "F", "G"];

  // Compute which cells are "blocked" (red lock) using diff state
  const blockedCells = new Set<string>();
  DIFFS.forEach((d, i) => {
    if (d.tier === "block" && !resolved[i]) blockedCells.add(`${d.preview[0]}-${d.preview[1]}`);
  });

  return (
    <div
      className="overflow-hidden rounded-xl border bg-white"
      style={{ borderColor: "var(--color-border-default)" }}
    >
      <div className="flex items-center justify-between border-b px-5 py-3.5" style={{ borderColor: "var(--color-border-default)" }}>
        <div className="text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
          Live model preview
        </div>
        <div className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
          Updates in real time as diffs are approved
        </div>
      </div>

      <div
        className="grid font-mono"
        style={{
          gridTemplateColumns: "160px repeat(7, 1fr)",
        }}
      >
        {/* Header row */}
        <div className="px-3 py-2 text-[11px]" style={{ background: "#F9FAFB", color: "var(--color-text-muted)" }}>
          {/* corner */}
        </div>
        {cols.map((c) => (
          <div
            key={c}
            className="px-2 py-2 text-center text-[11px]"
            style={{ background: "#F9FAFB", color: "var(--color-text-muted)" }}
          >
            {c}
          </div>
        ))}

        {/* Data rows */}
        {rowLabels.map((label, r) => (
          <Row key={r}>
            <div className="px-3 py-1.5 text-[13px]" style={{ color: "#374151", borderTop: "1px solid #F3F4F6" }}>
              {label}
            </div>
            {cols.map((_, c) => {
              const key = `${r}-${c}`;
              const value = mockValue(r, c);
              const blocked = blockedCells.has(key);
              const flash = flashCell === key;
              return (
                <div
                  key={c}
                  className={`relative px-2 py-1.5 text-right text-[12px] tnum ${flash ? "flash-success" : ""}`}
                  style={{
                    color: "var(--color-text-primary)",
                    borderTop: "1px solid #F3F4F6",
                    background: blocked ? "#FEF2F2" : undefined,
                  }}
                >
                  {value}
                  {blocked && (
                    <Lock
                      className="absolute right-1 top-1/2 h-3 w-3 -translate-y-1/2"
                      style={{ color: "var(--color-danger)" }}
                    />
                  )}
                </div>
              );
            })}
          </Row>
        ))}
      </div>
    </div>
  );
}

function mockValue(r: number, c: number) {
  const base = [54.8, 12.9, 20.4, 18.7, 112.4, 3.1, 22.1, 19.8, 78.2, 34.2, 8.2, 4.3];
  const v = base[r] * (0.85 + c * 0.05);
  return v.toFixed(1);
}
