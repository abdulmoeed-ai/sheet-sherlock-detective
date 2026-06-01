import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell, Card, Badge } from "@/components/PageShell";
import { Button } from "@/components/Button";
import { cycleStore, useCycle } from "@/lib/cycle-store";
import { CheckCircle2, MessageSquare, Send, RotateCcw, FileCheck } from "lucide-react";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Manager Review — Sheet Sherlock" },
      { name: "description", content: "Structured Finance Manager review pack: KPI summary, diff log, override log, inline comments." },
    ],
  }),
  component: Review,
});

const KPIS = [
  ["Revenue (FY25)",     "PKR 54,800M", "+8.4% YoY"],
  ["EBITDA Margin",      "23.6%",       "+120 bps"],
  ["Gross Margin",       "31.2%",       "+90 bps"],
  ["Operating CF",       "PKR 11,420M", "+4.1% YoY"],
  ["Net Debt / EBITDA",  "0.42x",       "-0.08x"],
  ["Free Cash Flow",     "PKR 7,650M",  "+6.0% YoY"],
];

const DIFFS = [
  { cell: "BS!D42", field: "Inventory", before: "6,040M", after: "1,840M", tier: "blocked", reason: "OCR digit transposition (p.74)" },
  { cell: "IS!C18", field: "EBITDA",    before: "12,400M", after: "12,900M", tier: "flagged", reason: "Restated prior-year confirmed" },
  { cell: "IS!C24", field: "Net Profit", before: "8,190M", after: "8,210M", tier: "auto",    reason: "Within 2% tolerance" },
];

const OVERRIDES = [
  { who: "Ayesha S.", cell: "BS!D42", action: "Accepted AI correction 6,040M → 1,840M", reason: "OCR p.74 confirmed", at: "10:14" },
  { who: "Ayesha S.", cell: "IS!C18", action: "Confirmed flagged diff",                     reason: "Tied to Note 21 restatement", at: "10:18" },
];

function Review() {
  const cycle = useCycle();
  const navigate = useNavigate();
  const [comments, setComments] = useState<{ author: string; text: string; at: string }[]>([
    { author: "Faisal K. (Manager)", text: "Inventory correction looks right — please add a footnote in Assumptions.", at: "11:02" },
  ]);
  const [draft, setDraft] = useState("");

  const submit = () => {
    if (!draft.trim()) return;
    setComments((xs) => [...xs, { author: "Faisal K. (Manager)", text: draft.trim(), at: "now" }]);
    setDraft("");
  };

  const approve = () => {
    cycleStore.setStatus("review");
    setTimeout(() => {
      cycleStore.setStatus("approved");
      navigate({ to: "/sign-off" });
    }, 400);
  };

  return (
    <PageShell
      title={`Manager Review · ${cycle.company || "MTL"} ${cycle.period || "FY2025"}`}
      subtitle="Structured review pack — no email. Approve to forward to CFO sign-off; or send back with comments."
      hideProgress
      actions={
        <>
          <Button variant="secondary"><RotateCcw className="h-4 w-4" /> Send back</Button>
          <Button onClick={approve}>
            <CheckCircle2 className="h-4 w-4" /> Approve & forward to CFO
          </Button>
        </>
      }
    >
      {/* KPI summary */}
      <Card className="mb-5">
        <h3 className="mb-3 text-[15px] font-semibold">KPI Summary</h3>
        <div className="grid grid-cols-3 gap-4">
          {KPIS.map(([k, v, d]) => (
            <div key={k} className="rounded-lg border p-4" style={{ borderColor: "var(--color-border-default)" }}>
              <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">{k}</div>
              <div className="mt-1 text-[20px] font-bold tnum">{v}</div>
              <div className="text-[11px] text-[var(--color-success-fg)]">{d}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-5">
        {/* Diff log */}
        <Card>
          <h3 className="mb-3 text-[15px] font-semibold">Diff log (3)</h3>
          <table className="w-full text-[12px]">
            <thead className="border-b text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
              <tr>
                <th className="py-2 text-left">Cell</th>
                <th className="text-left">Field</th>
                <th className="text-right">Before</th>
                <th className="text-right">After</th>
                <th className="text-left">Tier</th>
              </tr>
            </thead>
            <tbody>
              {DIFFS.map((d) => (
                <tr key={d.cell} className="border-b last:border-0">
                  <td className="py-2 font-mono">{d.cell}</td>
                  <td>{d.field}</td>
                  <td className="text-right tnum">{d.before}</td>
                  <td className="text-right tnum font-semibold">{d.after}</td>
                  <td>
                    <Badge tone={d.tier === "auto" ? "success" : d.tier === "flagged" ? "warning" : "danger"}>
                      {d.tier.toUpperCase()}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Override log */}
        <Card>
          <h3 className="mb-3 text-[15px] font-semibold">Analyst override log</h3>
          <ol className="space-y-3">
            {OVERRIDES.map((o, i) => (
              <li key={i} className="rounded-md border p-3" style={{ borderColor: "var(--color-border-default)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold">{o.who}</span>
                  <span className="text-[11px] text-[var(--color-text-muted)]">{o.at}</span>
                </div>
                <div className="mt-1 text-[12px]">
                  <span className="font-mono font-semibold">{o.cell}</span> · {o.action}
                </div>
                <div className="text-[11px] text-[var(--color-text-muted)]">Reason: {o.reason}</div>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {/* Comments */}
      <Card className="mt-5">
        <div className="mb-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-[var(--color-brand)]" />
          <h3 className="text-[15px] font-semibold">Inline comments</h3>
        </div>
        <ol className="space-y-2">
          {comments.map((c, i) => (
            <li key={i} className="rounded-md border bg-[var(--color-table-row-alt)] p-3" style={{ borderColor: "var(--color-border-default)" }}>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold">{c.author}</span>
                <span className="text-[11px] text-[var(--color-text-muted)]">{c.at}</span>
              </div>
              <div className="mt-1 text-[13px]">{c.text}</div>
            </li>
          ))}
        </ol>
        <div className="mt-3 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a comment…"
            className="h-9 flex-1 rounded-md border px-3 text-[13px]"
            style={{ borderColor: "var(--color-border-strong)" }}
          />
          <Button onClick={submit}><Send className="h-4 w-4" /> Post</Button>
        </div>
      </Card>

      <div className="mt-5 flex items-center gap-2 text-[12px] text-[var(--color-text-muted)]">
        <FileCheck className="h-4 w-4" />
        This pack is version-locked. CFO will sign off on the exact version you approve.
      </div>
    </PageShell>
  );
}
