import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Badge } from "@/components/PageShell";
import { Button } from "@/components/Button";
import { Check, AlertTriangle, Lock, Sparkles, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/diff-review")({
  head: () => ({
    meta: [
      { title: "Diff Review — Sheet Sherlock" },
      { name: "description", content: "Cell-level diff of newly ingested values vs prior model, with materiality tiering." },
    ],
  }),
  component: DiffReview,
});

type Tier = "auto" | "flag" | "block";
const diffs: {
  cell: string;
  field: string;
  prior: string;
  next: string;
  delta: string;
  source: string;
  conf: number;
  tier: Tier;
}[] = [
  { cell: "IS!C12", field: "Net sales — Q4 2025", prior: "PKR 28,412M", next: "PKR 28,640M", delta: "+0.8%", source: "PSX · LUCK AR 2025 p.42", conf: 0.97, tier: "auto" },
  { cell: "BS!D27", field: "Trade receivables", prior: "PKR 4,210M", next: "PKR 5,118M", delta: "+21.6%", source: "PSX · LUCK AR 2025 p.71", conf: 0.92, tier: "flag" },
  { cell: "Macro!B8", field: "SBP policy rate", prior: "22.00%", next: "21.50%", delta: "−50 bps", source: "SBP · MPC May 2026", conf: 0.99, tier: "auto" },
  { cell: "BS!D42", field: "Inventory — finished goods", prior: "PKR 1,840M", next: "PKR 6,040M", delta: "+228.3%", source: "PSX · LUCK AR 2025 p.74", conf: 0.71, tier: "block" },
  { cell: "Macro!B14", field: "Coal price (CIF)", prior: "USD 142/t", next: "USD 158/t", delta: "+11.3%", source: "WSJ Commodities · 2026-05-19", conf: 0.96, tier: "auto" },
  { cell: "Sector!E6", field: "Cement despatch — domestic", prior: "3.84 Mt", next: "4.12 Mt", delta: "+7.3%", source: "APCMA · April 2026", conf: 0.95, tier: "flag" },
];

function DiffReview() {
  return (
    <PageShell
      title="Verification & Diff Review"
      subtitle="Human-in-loop checkpoint #1 · 18 changes detected · 3 flagged · 1 blocked"
      actions={
        <>
          <Button variant="secondary">Reject all blocked</Button>
          <Button>
            <Check className="h-4 w-4" /> Approve verified
          </Button>
        </>
      }
    >
      <div className="mb-4 grid grid-cols-3 gap-3">
        <TierCard tone="success" label="Auto-approved" count={14} desc="Within materiality &amp; confidence thresholds" />
        <TierCard tone="warning" label="Flagged" count={3} desc="Requires analyst confirmation" />
        <TierCard tone="danger" label="Hard-blocked" count={1} desc="Requires written justification" />
      </div>

      <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: "var(--color-border-default)" }}>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              <th className="bg-[var(--color-table-header)] px-4 py-2.5">Cell</th>
              <th className="bg-[var(--color-table-header)] px-4 py-2.5">Field</th>
              <th className="bg-[var(--color-table-header)] px-4 py-2.5 text-right">Prior</th>
              <th className="bg-[var(--color-table-header)] px-4 py-2.5"></th>
              <th className="bg-[var(--color-table-header)] px-4 py-2.5 text-right">New</th>
              <th className="bg-[var(--color-table-header)] px-4 py-2.5 text-right">Δ</th>
              <th className="bg-[var(--color-table-header)] px-4 py-2.5">Source</th>
              <th className="bg-[var(--color-table-header)] px-4 py-2.5 text-right">Conf.</th>
              <th className="bg-[var(--color-table-header)] px-4 py-2.5">Action</th>
            </tr>
          </thead>
          <tbody>
            {diffs.map((d, i) => (
              <tr
                key={d.cell}
                className="border-b transition-colors hover:bg-[var(--color-table-row-alt)]"
                style={{ borderColor: "var(--color-border-default)", background: i % 2 ? "var(--color-table-row-alt)" : undefined }}
              >
                <td
                  className="px-4 py-3 font-mono text-[12px] font-semibold"
                  style={{ borderLeft: "3px solid var(--color-accent-mid)", paddingLeft: 13 }}
                >
                  {d.cell}
                </td>
                <td className="px-4 py-3">{d.field}</td>
                <td className="num px-4 py-3 text-[var(--color-text-muted)] line-through">{d.prior}</td>
                <td className="px-2 py-3 text-[var(--color-text-muted)]">
                  <ArrowRight className="h-3 w-3" />
                </td>
                <td className="num px-4 py-3 font-semibold">{d.next}</td>
                <td
                  className="num px-4 py-3 font-semibold"
                  style={{ color: d.delta.startsWith("+") ? "var(--color-success)" : "var(--color-danger)" }}
                >
                  {d.delta}
                </td>
                <td className="px-4 py-3 text-[12px] text-[var(--color-text-secondary)]">
                  <Sparkles className="-mt-0.5 mr-1 inline h-3 w-3 text-[var(--color-accent-mid)]" />
                  {d.source}
                </td>
                <td
                  className="num px-4 py-3 font-semibold"
                  style={{ color: d.conf > 0.95 ? "var(--color-success)" : d.conf > 0.85 ? "var(--color-warning)" : "var(--color-danger)" }}
                >
                  {(d.conf * 100).toFixed(0)}%
                </td>
                <td className="px-4 py-3">
                  <TierAction tier={d.tier} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

function TierCard({ tone, label, count, desc }: { tone: "success" | "warning" | "danger"; label: string; count: number; desc: string }) {
  const colors = {
    success: { bg: "var(--color-success-bg)", fg: "var(--color-success)", icon: <Check className="h-4 w-4" /> },
    warning: { bg: "var(--color-warning-bg)", fg: "var(--color-warning)", icon: <AlertTriangle className="h-4 w-4" /> },
    danger: { bg: "var(--color-danger-bg)", fg: "var(--color-danger)", icon: <Lock className="h-4 w-4" /> },
  }[tone];
  return (
    <div className="rounded-xl border bg-white p-4" style={{ borderColor: "var(--color-border-default)" }}>
      <div className="flex items-center gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: colors.bg, color: colors.fg }}
        >
          {colors.icon}
        </div>
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">{label}</div>
          <div className="num !text-left text-[20px] font-bold leading-none tnum">{count}</div>
        </div>
      </div>
      <div className="mt-2 text-[12px] text-[var(--color-text-muted)]">{desc}</div>
    </div>
  );
}

function TierAction({ tier }: { tier: Tier }) {
  if (tier === "auto") return <Badge tone="success">Auto</Badge>;
  if (tier === "flag")
    return (
      <button className="rounded-md border bg-white px-2.5 py-1 text-[12px] font-semibold text-[var(--color-warning)] hover:bg-[var(--color-warning-bg)]" style={{ borderColor: "var(--color-warning)" }}>
        Confirm
      </button>
    );
  return (
    <button className="rounded-md px-2.5 py-1 text-[12px] font-semibold text-white" style={{ background: "var(--color-danger)" }}>
      Justify
    </button>
  );
}
