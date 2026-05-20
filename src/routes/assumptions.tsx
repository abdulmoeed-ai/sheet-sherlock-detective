import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Badge } from "@/components/PageShell";
import { Button } from "@/components/Button";
import { Link2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/assumptions")({
  head: () => ({
    meta: [
      { title: "Assumptions — Sheet Sherlock" },
      { name: "description", content: "Auto-generated, source-cited assumptions sheet with live two-way model linkage." },
    ],
  }),
  component: Assumptions,
});

const rows = [
  { name: "SBP Policy Rate", value: "21.50%", cell: "Macro!B8", source: "SBP · MPC May 2026", date: "2026-05-12", conf: 0.99, sens: "High" },
  { name: "Coal CIF", value: "USD 158/t", cell: "Macro!B14", source: "WSJ Commodities", date: "2026-05-19", conf: 0.96, sens: "High" },
  { name: "PKR/USD", value: "284.20", cell: "Macro!B22", source: "Bloomberg FX", date: "2026-05-19", conf: 0.98, sens: "High" },
  { name: "Cement domestic despatch", value: "4.12 Mt", cell: "Sector!E6", source: "APCMA Apr 2026", date: "2026-05-08", conf: 0.95, sens: "Medium" },
  { name: "Construction GDP growth", value: "+4.8%", cell: "Macro!C4", source: "PBS · QER 2026 Q1", date: "2026-05-15", conf: 0.94, sens: "Medium" },
  { name: "NEPRA industrial tariff", value: "PKR 38.4/kWh", cell: "Macro!B19", source: "NEPRA notice 04-2026", date: "2026-04-30", conf: 0.97, sens: "Medium" },
  { name: "Sales growth (Lucky)", value: "+7.2%", cell: "IS!C12", source: "PSX · LUCK AR 2025", date: "2026-04-22", conf: 0.97, sens: "Low" },
  { name: "Inventory days", value: "42", cell: "BS!D42", source: "PSX · LUCK AR 2025 p.74", date: "2026-04-22", conf: 0.71, sens: "Low" },
];

function Assumptions() {
  return (
    <PageShell
      title="Assumptions Sheet"
      subtitle="Auto-generated post-ingestion · live two-way link to model input cells"
      actions={
        <>
          <Button variant="secondary">Edit</Button>
          <Button>Submit to Manager</Button>
        </>
      }
    >
      <div className="mb-4 flex items-center gap-3 rounded-lg border p-3" style={{ borderColor: "var(--color-accent-green)", background: "var(--color-tag-bg)" }}>
        <Sparkles className="h-4 w-4 text-[var(--color-accent-sparkle)]" />
        <div className="text-[13px] text-[var(--color-text-secondary)]">
          Generated in <span className="font-semibold text-[var(--color-text-primary)] tnum">22s</span> from the ingestion log · 47 assumptions linked to model cells. Sensitivity ranks derived from historical volatility.
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: "var(--color-border-default)" }}>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              <th className="bg-[var(--color-table-header)] px-4 py-2.5">Assumption</th>
              <th className="bg-[var(--color-table-header)] px-4 py-2.5 text-right">Value</th>
              <th className="bg-[var(--color-table-header)] px-4 py-2.5">Linked cell</th>
              <th className="bg-[var(--color-table-header)] px-4 py-2.5">Source</th>
              <th className="bg-[var(--color-table-header)] px-4 py-2.5">Published</th>
              <th className="bg-[var(--color-table-header)] px-4 py-2.5 text-right">Conf.</th>
              <th className="bg-[var(--color-table-header)] px-4 py-2.5">Sensitivity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.name}
                className="border-b last:border-0"
                style={{ borderColor: "var(--color-border-default)", background: i % 2 ? "var(--color-table-row-alt)" : undefined }}
              >
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="num px-4 py-3 font-semibold tnum">{r.value}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 font-mono text-[12px] text-[var(--color-accent-sparkle)]">
                    <Link2 className="h-3 w-3" /> {r.cell}
                  </span>
                </td>
                <td className="px-4 py-3 text-[12px] text-[var(--color-text-secondary)]">{r.source}</td>
                <td className="num px-4 py-3 text-[12px] text-[var(--color-text-muted)]">{r.date}</td>
                <td
                  className="num px-4 py-3 font-semibold"
                  style={{ color: r.conf > 0.95 ? "var(--color-success)" : r.conf > 0.85 ? "var(--color-warning)" : "var(--color-danger)" }}
                >
                  {(r.conf * 100).toFixed(0)}%
                </td>
                <td className="px-4 py-3">
                  <Badge tone={r.sens === "High" ? "danger" : r.sens === "Medium" ? "warning" : "neutral"}>{r.sens}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
