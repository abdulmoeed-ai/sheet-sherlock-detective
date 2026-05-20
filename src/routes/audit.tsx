import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Card, Badge } from "@/components/PageShell";
import { Button } from "@/components/Button";
import { Download, Sparkles, User, FileCheck, GitCompare, Stethoscope } from "lucide-react";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Audit Trail — Sheet Sherlock" },
      { name: "description", content: "Immutable audit log of every system and human action with full data lineage." },
    ],
  }),
  component: Audit,
});

const log = [
  { t: "2026-05-20 10:54:02", actor: "Sherlock AI · Assumptions", action: "Auto-generated assumptions sheet (47 rows)", icon: <Sparkles className="h-4 w-4" />, tone: "ai" as const },
  { t: "2026-05-20 10:38:11", actor: "Sherlock AI · Prediction", action: "Generated 5-yr cement forecast (Base/Bull/Bear)", icon: <Sparkles className="h-4 w-4" />, tone: "ai" as const },
  { t: "2026-05-20 10:14:47", actor: "Ayesha S. (Analyst)", action: "Accepted correction at BS!D42: 6,040M → 1,840M", icon: <User className="h-4 w-4" />, tone: "info" as const, reason: "OCR digit transposition (p.74)" },
  { t: "2026-05-20 10:12:33", actor: "Sherlock AI · Diagnosis", action: "Identified BS!D42 as causal cell (imbalance 4.2B)", icon: <Stethoscope className="h-4 w-4" />, tone: "ai" as const },
  { t: "2026-05-20 09:58:01", actor: "Ayesha S. (Analyst)", action: "Approved 14 auto-verified cells; confirmed 3 flagged", icon: <User className="h-4 w-4" />, tone: "info" as const },
  { t: "2026-05-20 09:51:18", actor: "Verification Agent", action: "Generated diff (18 changes; 3 flagged; 1 hard-blocked)", icon: <GitCompare className="h-4 w-4" />, tone: "ai" as const },
  { t: "2026-05-20 09:42:00", actor: "OCR Ingestion Agent", action: "Extracted 312 cells from PSX_AnnualReport_LUCK_2025.pdf", icon: <Sparkles className="h-4 w-4" />, tone: "ai" as const },
  { t: "2026-05-20 09:30:00", actor: "Ayesha S. (Analyst)", action: "Initiated ingestion cycle (sector: Cement)", icon: <FileCheck className="h-4 w-4" />, tone: "info" as const },
];

function Audit() {
  return (
    <PageShell
      title="Audit Trail · Cycle 2026-Q1"
      subtitle="Immutable log · every system and human action is recorded with source, timestamp, and signatory"
      actions={
        <>
          <Button variant="secondary">Export JSON</Button>
          <Button>
            <Download className="h-4 w-4" /> Signed PDF
          </Button>
        </>
      }
    >
      <div className="mb-5 grid grid-cols-4 gap-4">
        {[
          ["Total events", "47"],
          ["Agent actions", "31"],
          ["Human actions", "16"],
          ["Overrides", "2"],
        ].map(([k, v]) => (
          <Card key={k}>
            <div className="text-[12px] uppercase tracking-wider text-[var(--color-text-secondary)]">{k}</div>
            <div className="num !text-left mt-2 text-[24px] font-bold tnum">{v}</div>
          </Card>
        ))}
      </div>

      <Card>
        <h3 className="text-[15px] font-semibold">Event log</h3>
        <ol className="mt-4 relative ml-3 border-l-2" style={{ borderColor: "var(--color-border-default)" }}>
          {log.map((e, i) => (
            <li key={i} className="relative pl-6 pb-5 last:pb-0">
              <span
                className="absolute -left-[13px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white"
                style={{
                  border: "2px solid var(--color-accent-green)",
                  color: e.tone === "ai" ? "var(--color-accent-sparkle)" : "var(--color-brand)",
                }}
              >
                {e.icon}
              </span>
              <div className="flex items-baseline gap-3">
                <span className="num !text-left text-[12px] font-mono text-[var(--color-text-muted)]">{e.t}</span>
                <Badge tone={e.tone}>{e.tone === "ai" ? "AI" : "Human"}</Badge>
                <span className="text-[13px] font-semibold">{e.actor}</span>
              </div>
              <div className="mt-1 text-[13px] text-[var(--color-text-secondary)]">{e.action}</div>
              {e.reason ? (
                <div className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                  Reason: <span className="italic">{e.reason}</span>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      </Card>
    </PageShell>
  );
}
