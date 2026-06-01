import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell, Card, Badge } from "@/components/PageShell";
import { Button } from "@/components/Button";
import { cycleStore, useCycle } from "@/lib/cycle-store";
import { Lock, CheckCircle2, Sparkles, ShieldCheck, FileText } from "lucide-react";

export const Route = createFileRoute("/sign-off")({
  head: () => ({
    meta: [
      { title: "CFO Sign-Off — Sheet Sherlock" },
      { name: "description", content: "One-page executive brief and version-locked approval for the CFO." },
    ],
  }),
  component: SignOff,
});

function SignOff() {
  const cycle = useCycle();
  const navigate = useNavigate();
  const [signed, setSigned] = useState(false);

  const sign = () => {
    setSigned(true);
    cycleStore.setStatus("approved");
  };

  return (
    <PageShell
      title={`CFO Sign-Off · ${cycle.company || "MTL"} ${cycle.period || "FY2025"}`}
      subtitle="One-page executive brief. Sign-off is version-locked and recorded in the audit trail."
      hideProgress
      actions={
        signed ? (
          <Badge tone="success">
            <CheckCircle2 className="mr-1 inline h-3 w-3" /> Approved & locked
          </Badge>
        ) : (
          <Button onClick={sign}>
            <Lock className="h-4 w-4" /> Sign & lock version
          </Button>
        )
      }
    >
      {signed && (
        <div
          className="mb-5 flex items-center gap-3 rounded-[10px] border px-5 py-3.5"
          style={{ background: "var(--color-success-bg)", borderColor: "var(--color-success-border)" }}
        >
          <ShieldCheck className="h-5 w-5" style={{ color: "var(--color-success-fg)" }} />
          <div className="flex-1 text-[13px] font-semibold" style={{ color: "var(--color-success-fg)" }}>
            MTL_FY2025_v1 approved by Bilal R. (CFO) on {new Date().toISOString().slice(0, 10)}. Version permanently locked.
          </div>
          <Button variant="secondary" onClick={() => navigate({ to: "/audit" })}>
            <FileText className="h-4 w-4" /> View audit trail
          </Button>
        </div>
      )}

      <Card className="mb-5">
        <div className="mb-1 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--color-accent-sparkle)]" />
          <Badge tone="ai">Auto-generated executive brief</Badge>
          <Badge tone="neutral">MTL_FY2025_v1</Badge>
        </div>
        <h2 className="mt-2 text-[20px] font-bold">Millat Tractors Limited · FY2025</h2>
        <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
          Revenue grew <b>8.4%</b> to PKR 54.8B, driven by tractor unit volume recovery (+11% YoY) and improved IFS service mix.
          EBITDA margin expanded <b>120 bps</b> to <b>23.6%</b>; net debt remained negligible (<b>0.42x EBITDA</b>).
          5-year base-case forecast projects <b>7.2% revenue CAGR</b> with peak sensitivity to KIBOR and PKR/USD.
        </p>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            ["Revenue", "PKR 54.8B", "+8.4%"],
            ["EBITDA", "PKR 12.9B", "+15.0%"],
            ["EBITDA Margin", "23.6%", "+120 bps"],
            ["Op. Cash Flow", "PKR 11.4B", "+4.1%"],
            ["Net Debt/EBITDA", "0.42x", "-0.08x"],
            ["FCF", "PKR 7.65B", "+6.0%"],
          ].map(([k, v, d]) => (
            <div key={k} className="rounded-lg border p-3" style={{ borderColor: "var(--color-border-default)" }}>
              <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">{k}</div>
              <div className="mt-1 text-[18px] font-bold tnum">{v}</div>
              <div className="text-[11px] text-[var(--color-success-fg)]">{d}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-5">
        <Card>
          <h3 className="mb-2 text-[15px] font-semibold">Key risks (Prediction Agent)</h3>
          <ul className="space-y-2 text-[13px]">
            <li>• KIBOR sensitivity: 100 bps → -PKR 380M PAT (bear scenario).</li>
            <li>• PKR/USD: 5% depreciation → +PKR 220M import cost.</li>
            <li>• Tractor unit volume: 5% decline → -PKR 1.9B revenue.</li>
          </ul>
        </Card>
        <Card>
          <h3 className="mb-2 text-[15px] font-semibold">Governance checklist</h3>
          <ul className="space-y-2 text-[13px]">
            <li><CheckCircle2 className="mr-1 inline h-4 w-4 text-[var(--color-success-fg)]" /> 40/40 Data Mapping Rules applied</li>
            <li><CheckCircle2 className="mr-1 inline h-4 w-4 text-[var(--color-success-fg)]" /> All 4 Human-in-Loop gates passed</li>
            <li><CheckCircle2 className="mr-1 inline h-4 w-4 text-[var(--color-success-fg)]" /> 3-statement check clean</li>
            <li><CheckCircle2 className="mr-1 inline h-4 w-4 text-[var(--color-success-fg)]" /> Assumptions sheet 100% source-cited</li>
            <li><CheckCircle2 className="mr-1 inline h-4 w-4 text-[var(--color-success-fg)]" /> Audit trail exportable</li>
          </ul>
        </Card>
      </div>
    </PageShell>
  );
}
