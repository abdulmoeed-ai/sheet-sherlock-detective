import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell, Card, Badge } from "@/components/PageShell";
import { Button } from "@/components/Button";
import { Lock, Unlock, ShieldCheck, AlertTriangle, KeyRound } from "lucide-react";

export const Route = createFileRoute("/protection")({
  head: () => ({
    meta: [
      { title: "Write-Protection Layer — Sheet Sherlock" },
      {
        name: "description",
        content:
          "Cell-level formula write-protection. Locked formulas, approver overrides and tamper audit for the model registry.",
      },
    ],
  }),
  component: Protection,
});

type Tier = "core-formula" | "linking" | "assumption" | "output";
type Status = "locked" | "override" | "open";

interface Rule {
  id: string;
  scope: string; // sheet!range
  description: string;
  tier: Tier;
  status: Status;
  approver: string;
  lastChange: string;
}

const TIER_META: Record<Tier, { label: string; tone: "danger" | "warning" | "neutral" | "success" }> = {
  "core-formula": { label: "Core formula", tone: "danger" },
  linking: { label: "3-statement link", tone: "warning" },
  assumption: { label: "Assumption", tone: "neutral" },
  output: { label: "Output / KPI", tone: "success" },
};

const INITIAL: Rule[] = [
  { id: "r1", scope: "IS!D4:D40",   description: "Income statement P&L formula spine",      tier: "core-formula", status: "locked", approver: "CFO",        lastChange: "2026-05-12" },
  { id: "r2", scope: "BS!E4:E60",   description: "Balance sheet roll-forward links",         tier: "linking",      status: "locked", approver: "Manager",    lastChange: "2026-05-12" },
  { id: "r3", scope: "CF!D4:D45",   description: "Indirect cash flow build",                 tier: "core-formula", status: "locked", approver: "CFO",        lastChange: "2026-05-12" },
  { id: "r4", scope: "Assump!C8:C40", description: "Macro + sector assumption block",        tier: "assumption",   status: "open",   approver: "Analyst",    lastChange: "2026-05-18" },
  { id: "r5", scope: "Forecast!E5:J35", description: "5-year forecast driver cells",         tier: "assumption",   status: "open",   approver: "Analyst",    lastChange: "2026-05-19" },
  { id: "r6", scope: "KPI!B2:B12", description: "Executive KPI dashboard outputs",           tier: "output",       status: "locked", approver: "Manager",    lastChange: "2026-05-12" },
  { id: "r7", scope: "IS!D27",     description: "Tax rate override (FY25 one-off)",          tier: "core-formula", status: "override", approver: "CFO",      lastChange: "2026-05-19" },
];

function statusBadge(s: Status) {
  if (s === "locked")   return <Badge tone="success"><Lock className="mr-1 inline h-3 w-3" />Locked</Badge>;
  if (s === "override") return <Badge tone="warning"><AlertTriangle className="mr-1 inline h-3 w-3" />Override</Badge>;
  return <Badge tone="neutral"><Unlock className="mr-1 inline h-3 w-3" />Open</Badge>;
}

function Protection() {
  const [rules, setRules] = useState<Rule[]>(INITIAL);

  const toggle = (id: string) => {
    setRules((rs) =>
      rs.map((r) =>
        r.id === id
          ? { ...r, status: r.status === "locked" ? "open" : "locked", lastChange: new Date().toISOString().slice(0, 10) }
          : r,
      ),
    );
  };

  const locked = rules.filter((r) => r.status === "locked").length;
  const overrides = rules.filter((r) => r.status === "override").length;

  return (
    <PageShell
      title="Cell-Level Write-Protection Layer"
      subtitle="Formula spine and 3-statement links are protected by default. Overrides require named approver and are logged to the audit trail."
      hideProgress
      actions={<Button variant="secondary"><KeyRound className="h-4 w-4" />Manage approvers</Button>}
    >
      <div
        className="mb-5 flex items-center gap-3 rounded-[10px] border px-5 py-3.5"
        style={{ background: "var(--color-success-bg)", borderColor: "var(--color-success-border)" }}
      >
        <ShieldCheck className="h-5 w-5" style={{ color: "var(--color-success-fg)" }} />
        <div className="text-[13px] font-semibold" style={{ color: "var(--color-success-fg)" }}>
          {locked} of {rules.length} protection rules active · {overrides} approved override(s) on this version.
        </div>
      </div>

      <div className="mb-5 grid grid-cols-4 gap-4">
        {[
          ["Rules", rules.length.toString()],
          ["Locked", locked.toString()],
          ["Overrides", overrides.toString()],
          ["Open", (rules.length - locked - overrides).toString()],
        ].map(([k, v]) => (
          <Card key={k}>
            <div className="text-[12px] uppercase tracking-wider text-[var(--color-text-secondary)]">{k}</div>
            <div className="mt-2 text-[24px] font-bold tnum">{v}</div>
          </Card>
        ))}
      </div>

      <Card>
        <table className="w-full text-[13px]">
          <thead className="border-b text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
            <tr>
              <th className="py-2 text-left">Scope</th>
              <th className="text-left">Description</th>
              <th className="text-left">Tier</th>
              <th className="text-left">Status</th>
              <th className="text-left">Approver</th>
              <th className="text-left">Last change</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => {
              const meta = TIER_META[r.tier];
              return (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 font-mono text-[12px]">{r.scope}</td>
                  <td>{r.description}</td>
                  <td><Badge tone={meta.tone}>{meta.label}</Badge></td>
                  <td>{statusBadge(r.status)}</td>
                  <td>{r.approver}</td>
                  <td className="text-[var(--color-text-muted)]">{r.lastChange}</td>
                  <td>
                    {r.status !== "override" && (
                      <button
                        onClick={() => toggle(r.id)}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] hover:bg-[var(--color-tag-bg)]"
                        style={{ borderColor: "var(--color-border-default)", color: "var(--color-brand)" }}
                      >
                        {r.status === "locked" ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                        {r.status === "locked" ? "Unlock" : "Lock"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </PageShell>
  );
}
