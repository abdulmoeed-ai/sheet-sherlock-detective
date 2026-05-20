import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Card, Badge } from "@/components/PageShell";
import { AskAiPanel } from "@/components/AskAiPanel";
import { Button } from "@/components/Button";
import { AlertTriangle, ArrowRight, Check, X } from "lucide-react";

export const Route = createFileRoute("/diagnosis")({
  head: () => ({
    meta: [
      { title: "Balance Sheet Diagnosis — Sheet Sherlock" },
      { name: "description", content: "AI-driven balance sheet imbalance diagnosis with exact cell-level correction proposals." },
    ],
  }),
  component: Diagnosis,
});

const rows = [
  { label: "Total Assets", value: "PKR 184,210M", weight: "total" as const },
  { label: "  Current Assets", value: "PKR 41,820M", weight: "sub" as const },
  { label: "    Inventory", value: "PKR 6,040M", weight: "leaf" as const, flag: true, cell: "BS!D42" },
  { label: "    Receivables", value: "PKR 5,118M", weight: "leaf" as const },
  { label: "  Non-current Assets", value: "PKR 142,390M", weight: "sub" as const },
  { label: "Total Equity + Liabilities", value: "PKR 180,010M", weight: "total" as const, flag: true },
  { label: "  Equity", value: "PKR 112,400M", weight: "sub" as const },
  { label: "  Liabilities", value: "PKR 67,610M", weight: "sub" as const },
];

function Diagnosis() {
  return (
    <PageShell
      title="Balance Sheet Diagnosis"
      subtitle="Human-in-loop checkpoint #2 · Imbalance of PKR 4,200M detected"
      actions={
        <>
          <Button variant="secondary">Override</Button>
          <Button>
            <Check className="h-4 w-4" /> Accept correction
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-[1fr_380px] gap-5">
        <div className="space-y-5">
          <Card>
            <div className="flex items-start gap-3 rounded-lg p-3" style={{ background: "var(--color-danger-bg)" }}>
              <AlertTriangle className="mt-0.5 h-5 w-5 text-[var(--color-danger)]" />
              <div>
                <div className="text-[14px] font-semibold text-[var(--color-danger)]">Balance sheet does not tie</div>
                <div className="mt-0.5 text-[13px] text-[var(--color-text-secondary)]">
                  Assets exceed Equity + Liabilities by <span className="font-semibold text-[var(--color-text-primary)] tnum">PKR 4,200M</span>. Causal cell identified.
                </div>
              </div>
            </div>

            <table className="mt-5 w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  <th className="bg-[var(--color-table-header)] px-4 py-2.5">Line item</th>
                  <th className="bg-[var(--color-table-header)] px-4 py-2.5 text-right">Value</th>
                  <th className="bg-[var(--color-table-header)] px-4 py-2.5">Cell</th>
                  <th className="bg-[var(--color-table-header)] px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.label}
                    className="border-b last:border-0"
                    style={{
                      borderColor: "var(--color-border-default)",
                      background: r.weight === "total" ? "var(--color-table-header)" : r.weight === "sub" ? "var(--color-table-row-alt)" : undefined,
                    }}
                  >
                    <td
                      className="px-4 py-2.5 whitespace-pre"
                      style={{
                        fontWeight: r.weight === "total" ? 700 : r.weight === "sub" ? 600 : 500,
                        fontSize: r.weight === "total" ? 14 : 13,
                      }}
                    >
                      {r.label}
                    </td>
                    <td className="num px-4 py-2.5" style={{ fontWeight: r.weight === "total" ? 700 : 500 }}>
                      {r.value}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[12px] text-[var(--color-text-muted)]">{r.cell ?? "—"}</td>
                    <td className="px-4 py-2.5">{r.flag ? <Badge tone="danger">Causal</Badge> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card>
            <h3 className="text-[15px] font-semibold">Correction proposal</h3>
            <p className="mt-1.5 text-[13px] text-[var(--color-text-secondary)]">
              Sherlock AI traced the imbalance to <span className="font-mono font-semibold text-[var(--color-text-primary)]">BS!D42</span> (Inventory — finished goods). The OCR-extracted value
              <span className="font-semibold text-[var(--color-text-primary)] tnum"> PKR 6,040M</span> appears to have transposed a digit from the source PDF.
            </p>

            <div className="mt-4 flex items-center gap-3 rounded-lg border p-4" style={{ borderColor: "var(--color-border-default)" }}>
              <div className="flex-1">
                <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Current (extracted)</div>
                <div className="num !text-left text-[18px] font-bold text-[var(--color-danger)] tnum">PKR 6,040M</div>
              </div>
              <ArrowRight className="h-5 w-5 text-[var(--color-text-muted)]" />
              <div className="flex-1">
                <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Proposed</div>
                <div className="num !text-left text-[18px] font-bold text-[var(--color-success)] tnum">PKR 1,840M</div>
              </div>
              <div className="ml-2 flex gap-2">
                <button className="flex h-9 w-9 items-center justify-center rounded-md text-white" style={{ background: "var(--color-brand)" }}>
                  <Check className="h-4 w-4" />
                </button>
                <button className="flex h-9 w-9 items-center justify-center rounded-md border text-[var(--color-text-secondary)]" style={{ borderColor: "var(--color-border-strong)" }}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-3 text-[12px] text-[var(--color-text-muted)]">
              Source: PSX · LUCK AR 2025 p.74 · OCR confidence 71% (below 85% threshold).
            </div>
          </Card>
        </div>

        <AskAiPanel
          title="Why is the BS off?"
          messages={[
            { role: "user", content: "Why is the balance sheet off by 4.2B?" },
            {
              role: "ai",
              content: (
                <>
                  <p className="font-semibold">Root cause located in <span className="font-mono">BS!D42</span>.</p>
                  <p className="mt-1.5">
                    Inventory jumped <span className="tnum font-semibold">+228%</span> QoQ — outside the historical band of ±18%. Cross-checked against
                    cash flow movements and source PDF (p.74), the likely correct value is <span className="tnum font-semibold">PKR 1,840M</span>.
                  </p>
                  <p className="mt-1.5 text-[var(--color-text-secondary)]">Suggested action: accept the corrected value and re-run cascade.</p>
                </>
              ),
            },
          ]}
          quickActions={["Show source snippet", "Run sensitivity", "Re-OCR p.74"]}
        />
      </div>
    </PageShell>
  );
}
