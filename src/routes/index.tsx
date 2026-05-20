import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, Card, Badge } from "@/components/PageShell";
import { Button } from "@/components/Button";
import {
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Download,
  GitCompare,
  Stethoscope,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Sheet Sherlock" },
      { name: "description", content: "FP&A cycle command center: open models, AI agents, and approval queue." },
    ],
  }),
  component: Dashboard,
});

const kpis = [
  { label: "Cycle time", value: "1h 47m", delta: "−27.1h vs manual", tone: "success" as const },
  { label: "Cells ingested", value: "1,284", delta: "98.4% auto-verified", tone: "success" as const },
  { label: "Avg. OCR confidence", value: "94.2%", delta: "+1.8 vs last run", tone: "info" as const },
  { label: "Open review items", value: "7", delta: "2 hard-blocked", tone: "warning" as const },
];

const activity = [
  { time: "09:42", agent: "OCR Ingestion Agent", note: "Ingested 312 cells from PSX_AnnualReport_LUCK_2025.pdf", confidence: 0.97 },
  { time: "09:51", agent: "Verification Agent", note: "Generated diff — 18 changes (3 flagged, 1 blocked)", confidence: 0.93 },
  { time: "10:12", agent: "Sherlock AI · Diagnosis", note: "BS imbalance traced to Inventory!D42 (PKR 4.2M)", confidence: 0.91 },
  { time: "10:38", agent: "Prediction Agent", note: "5-yr cement sector forecast generated (Base/Bull/Bear)", confidence: 0.88 },
  { time: "10:54", agent: "Assumptions Generator", note: "Auto-linked 47 assumption rows to model inputs", confidence: 0.99 },
];

function Dashboard() {
  return (
    <PageShell
      title="Cycle 2026-Q1 · Lucky Cement"
      subtitle="Active model · sector: Cement · 47 input cells changed since last approved version"
      actions={
        <>
          <Button variant="secondary">Export audit PDF</Button>
          <Button>
            <Sparkles className="h-4 w-4" /> New ingestion cycle
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className="!p-5">
            <div className="text-[12px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
              {k.label}
            </div>
            <div className="mt-3 num text-[28px] font-bold leading-none text-[var(--color-text-primary)] text-left">
              {k.value}
            </div>
            <div className="mt-3">
              <Badge tone={k.tone}>{k.delta}</Badge>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <Card className="col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">Agent activity — current cycle</h2>
            <span className="text-[12px] text-[var(--color-text-muted)]">Last 60 min</span>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                <th className="bg-[var(--color-table-header)] px-4 py-2.5">Time</th>
                <th className="bg-[var(--color-table-header)] px-4 py-2.5">Agent</th>
                <th className="bg-[var(--color-table-header)] px-4 py-2.5">Event</th>
                <th className="bg-[var(--color-table-header)] px-4 py-2.5 text-right">Conf.</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((a) => (
                <tr key={a.time} className="border-b last:border-0" style={{ borderColor: "var(--color-border-default)" }}>
                  <td className="num !text-left px-4 py-3 text-[var(--color-text-muted)]">{a.time}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--color-accent-mid)" }} />
                      <span className="font-medium">{a.agent}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{a.note}</td>
                  <td className="num px-4 py-3 font-semibold">{(a.confidence * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="space-y-4">
          <Card>
            <h3 className="text-[15px] font-semibold">Approval queue</h3>
            <div className="mt-3 space-y-2">
              <QueueRow icon={<AlertTriangle className="h-4 w-4 text-[var(--color-warning)]" />} label="Diff review" count={3} to="/diff-review" />
              <QueueRow icon={<Stethoscope className="h-4 w-4 text-[var(--color-danger)]" />} label="BS diagnosis" count={1} to="/diagnosis" />
              <QueueRow icon={<CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" />} label="Manager sign-off" count={0} to="/audit" />
            </div>
          </Card>
          <Card>
            <h3 className="text-[15px] font-semibold">Jump to</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Tile to="/ingestion" icon={<Download className="h-4 w-4" />} label="Ingestion" />
              <Tile to="/diff-review" icon={<GitCompare className="h-4 w-4" />} label="Diff Review" />
              <Tile to="/diagnosis" icon={<Stethoscope className="h-4 w-4" />} label="Diagnosis" />
              <Tile to="/forecast" icon={<ArrowUpRight className="h-4 w-4" />} label="Forecast" />
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[var(--color-accent-sparkle)]" />
            <h3 className="text-[15px] font-semibold">Time replaced</h3>
          </div>
          <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">
            This cycle replaced <span className="font-semibold text-[var(--color-text-primary)]">27.1 hours</span> of manual analyst work across OCR transcription, cell entry, and BS tracing.
          </p>
        </Card>
        <Card>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--color-accent-sparkle)]" />
            <h3 className="text-[15px] font-semibold">Data lineage</h3>
          </div>
          <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">
            Every cell is traceable to its source document, publication date and confidence in &lt;30 seconds.
          </p>
        </Card>
        <Card>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" />
            <h3 className="text-[15px] font-semibold">Controls</h3>
          </div>
          <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">
            Maker-checker enforced. Formula cells protected. Version locks after Manager submission.
          </p>
        </Card>
      </div>
    </PageShell>
  );
}

function QueueRow({ icon, label, count, to }: { icon: React.ReactNode; label: string; count: number; to: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between rounded-lg border bg-white px-3 py-2.5 transition-colors hover:border-[var(--color-accent-green)] hover:bg-[var(--color-tag-bg)]"
      style={{ borderColor: "var(--color-border-default)" }}
    >
      <div className="flex items-center gap-2.5">
        {icon}
        <span className="text-[13px] font-medium">{label}</span>
      </div>
      <span
        className="rounded-md px-2 py-0.5 text-[12px] font-semibold tnum"
        style={{ background: count > 0 ? "var(--color-warning-bg)" : "var(--color-success-bg)", color: count > 0 ? "#B45309" : "#15803D" }}
      >
        {count}
      </span>
    </Link>
  );
}

function Tile({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2.5 text-[13px] font-medium transition-colors hover:border-[var(--color-accent-green)] hover:bg-[var(--color-tag-bg)]"
      style={{ borderColor: "var(--color-border-default)" }}
    >
      <span className="text-[var(--color-accent-sparkle)]">{icon}</span>
      {label}
    </Link>
  );
}
