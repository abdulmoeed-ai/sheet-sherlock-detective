import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Card, Badge } from "@/components/PageShell";
import { Button } from "@/components/Button";
import { Upload, FileText, CheckCircle2, Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/ingestion")({
  head: () => ({
    meta: [
      { title: "Ingestion — Sheet Sherlock" },
      { name: "description", content: "OCR-driven ingestion from PSX, SBP, ADB, NEPRA and 8+ portals with per-field confidence scores." },
    ],
  }),
  component: Ingestion,
});

const sources = [
  { name: "PSX", desc: "Pakistan Stock Exchange · filings", status: "complete", cells: 412, conf: 0.97 },
  { name: "SBP", desc: "State Bank · macro & rates", status: "complete", cells: 188, conf: 0.99 },
  { name: "ADB", desc: "Asian Development Bank · outlook", status: "running", cells: 91, conf: 0.92 },
  { name: "PBS", desc: "Pakistan Bureau of Statistics · CPI", status: "complete", cells: 142, conf: 0.95 },
  { name: "APCMA", desc: "Cement Manufacturers · despatch", status: "complete", cells: 64, conf: 0.94 },
  { name: "NEPRA", desc: "Tariff & generation mix", status: "queued", cells: 0, conf: 0 },
  { name: "WSJ", desc: "Commodities · coal, oil", status: "complete", cells: 38, conf: 0.96 },
  { name: "Bloomberg", desc: "FX, sovereign yields", status: "complete", cells: 211, conf: 0.98 },
];

function Ingestion() {
  return (
    <PageShell
      title="Ingestion Run · 2026-05-20 09:30"
      subtitle="OCR Pipeline Agent ingesting from 8 sources · review-gate after extraction"
      actions={
        <>
          <Button variant="secondary">Pause run</Button>
          <Button>
            <Sparkles className="h-4 w-4" /> Trigger new run
          </Button>
        </>
      }
    >
      <div
        className="mb-6 rounded-xl border-2 border-dashed bg-white p-10 text-center"
        style={{ borderColor: "var(--color-accent-green)" }}
      >
        <Upload className="mx-auto h-8 w-8" style={{ color: "var(--color-accent-green)" }} />
        <div className="mt-3 text-[14px]">
          <span className="font-bold text-[var(--color-brand)]">Click to upload</span>
          <span className="text-[var(--color-text-secondary)]"> or drag and drop additional source PDFs</span>
        </div>
        <div className="mt-1 text-[12px] text-[var(--color-text-muted)]">PDF, XLSX, CSV (max 50MB)</div>
      </div>

      <div className="mb-6 flex items-center gap-3 rounded-lg border bg-white p-4" style={{ borderColor: "var(--color-border-default)" }}>
        <FileText className="h-8 w-8 rounded-md bg-[var(--color-danger-bg)] p-1.5 text-[var(--color-danger)]" />
        <div className="flex-1">
          <div className="text-[14px] font-semibold">PSX_AnnualReport_LUCK_2025.pdf</div>
          <div className="text-[12px] text-[var(--color-text-muted)]">12.4 MB · 184 pages · OCR completed in 3m 18s</div>
        </div>
        <Badge tone="ai">
          <Sparkles className="h-3 w-3" /> AI extracted
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {sources.map((s) => (
          <Card key={s.name}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[12px] font-bold text-white"
                    style={{ background: "var(--color-brand)" }}
                  >
                    {s.name.slice(0, 2)}
                  </div>
                  <div>
                    <div className="text-[14px] font-semibold">{s.name}</div>
                    <div className="text-[12px] text-[var(--color-text-secondary)]">{s.desc}</div>
                  </div>
                </div>
              </div>
              <StatusPill status={s.status} />
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Cells ingested</div>
                <div className="num !text-left text-[20px] font-bold tnum">{s.cells.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Avg confidence</div>
                <div
                  className="text-[14px] font-semibold tnum"
                  style={{ color: s.conf > 0.95 ? "var(--color-success)" : s.conf > 0.9 ? "var(--color-warning)" : "var(--color-text-muted)" }}
                >
                  {s.conf > 0 ? `${(s.conf * 100).toFixed(1)}%` : "—"}
                </div>
              </div>
            </div>
            {s.status === "running" ? (
              <div className="mt-4 space-y-1.5">
                <div className="skeleton-bar w-[65%]" />
                <div className="skeleton-bar w-[45%]" />
                <div className="skeleton-bar w-[30%]" />
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </PageShell>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "complete")
    return (
      <Badge tone="success">
        <CheckCircle2 className="h-3 w-3" /> Complete
      </Badge>
    );
  if (status === "running")
    return (
      <Badge tone="info">
        <Loader2 className="h-3 w-3 animate-spin" /> Extracting
      </Badge>
    );
  return <Badge tone="neutral">Queued</Badge>;
}
