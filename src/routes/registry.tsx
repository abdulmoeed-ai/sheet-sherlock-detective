import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageShell, Card, Badge } from "@/components/PageShell";
import { Button } from "@/components/Button";
import { modelRegistry, statusLabel, statusTone, type RegistryStatus } from "@/lib/model-registry";
import { Lock, FileClock, GitBranch, ArrowRight, Eye } from "lucide-react";

export const Route = createFileRoute("/registry")({
  head: () => ({
    meta: [
      { title: "Model Registry — Sheet Sherlock" },
      { name: "description", content: "Pre-initiation registry lookup, version timeline, and decision cards." },
    ],
  }),
  component: Registry,
});

function StatusBadge({ s }: { s: RegistryStatus }) {
  return (
    <Badge tone={statusTone(s)}>
      {s === "locked" ? (
        <Lock className="mr-1 inline h-3 w-3" />
      ) : null}
      {statusLabel(s)}
    </Badge>
  );
}

function Registry() {
  const navigate = useNavigate();
  const all = modelRegistry.all();
  const [ticker, setTicker] = useState("MTL");
  const [fy, setFy] = useState("FY2025");

  const matches = useMemo(() => modelRegistry.lookup(ticker, fy), [ticker, fy]);
  const history = useMemo(() => modelRegistry.forCompany(ticker), [ticker]);

  const decision = matches[0];
  const decisionLabel = !decision
    ? `No model found. New model ${ticker}_${fy}_v1 will be created.`
    : decision.status === "draft"
    ? `Draft ${decision.id} exists — Resume, start new version, or cancel.`
    : decision.status === "in-review"
    ? `${decision.id} is locked in review. You may only create a new version.`
    : `${decision.id} is ${statusLabel(decision.status).toLowerCase()}. Create new version to begin edits.`;

  return (
    <PageShell
      title="Model Registry Intelligence"
      subtitle="Silent pre-initiation lookup, version timeline, and CFO-grade decision cards. Versioning: [TICKER]_[FY]_v[N]."
      hideProgress
    >
      {/* Lookup */}
      <Card className="mb-5">
        <div className="flex items-end gap-4">
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Ticker</div>
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              className="h-9 w-32 rounded-md border px-3 text-[13px] font-mono"
              style={{ borderColor: "var(--color-border-strong)" }}
            />
          </div>
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Fiscal year</div>
            <input
              value={fy}
              onChange={(e) => setFy(e.target.value.toUpperCase())}
              className="h-9 w-32 rounded-md border px-3 text-[13px] font-mono"
              style={{ borderColor: "var(--color-border-strong)" }}
            />
          </div>
          <div className="flex-1" />
          <div className="text-[11px] text-[var(--color-text-muted)]">
            Registry lookup runs in &lt; 1s · every decision logged to audit trail
          </div>
        </div>
      </Card>

      {/* Decision card */}
      <Card className="mb-5" >
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <div className="mb-1 flex items-center gap-2">
              <Badge tone="ai">Decision card</Badge>
              {decision && <StatusBadge s={decision.status} />}
            </div>
            <div className="text-[16px] font-semibold">{decisionLabel}</div>
            {decision && (
              <div className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                Completeness {decision.completeness}% · last edited by {decision.lastEditedBy} on {decision.lastEditedAt}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {decision?.status === "draft" && (
              <>
                <Button variant="secondary" onClick={() => navigate({ to: "/diagnosis" })}>
                  <Eye className="h-4 w-4" /> Resume {decision.id}
                </Button>
                <Button onClick={() => navigate({ to: "/ingestion" })}>
                  New version <ArrowRight className="h-4 w-4" />
                </Button>
              </>
            )}
            {decision && decision.status !== "draft" && (
              <Button onClick={() => navigate({ to: "/ingestion" })}>
                Create {ticker}_{fy}_v{decision.version + 1} <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {!decision && (
              <Button onClick={() => navigate({ to: "/ingestion" })}>
                Begin {ticker}_{fy}_v1 <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Version timeline */}
      <Card className="mb-5">
        <div className="mb-3 flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-[var(--color-brand)]" />
          <h3 className="text-[15px] font-semibold">Version timeline · {ticker}</h3>
        </div>
        <ol className="relative ml-3 border-l-2" style={{ borderColor: "var(--color-border-default)" }}>
          {history.map((v) => (
            <li key={v.id} className="relative pb-4 pl-6 last:pb-0">
              <span
                className="absolute -left-[9px] top-1 h-4 w-4 rounded-full"
                style={{
                  background:
                    v.status === "approved" || v.status === "locked"
                      ? "var(--color-success)"
                      : v.status === "in-review"
                      ? "var(--color-warning)"
                      : "var(--color-brand)",
                }}
              />
              <div className="flex items-baseline gap-3">
                <span className="text-[13px] font-mono font-semibold">{v.id}</span>
                <StatusBadge s={v.status} />
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  {v.completeness}% complete · {v.lastEditedBy} · {v.lastEditedAt}
                </span>
              </div>
            </li>
          ))}
          {history.length === 0 && (
            <div className="pl-6 text-[13px] text-[var(--color-text-muted)]">No prior versions for {ticker}.</div>
          )}
        </ol>
      </Card>

      {/* All models */}
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <FileClock className="h-4 w-4 text-[var(--color-brand)]" />
          <h3 className="text-[15px] font-semibold">All models in registry</h3>
        </div>
        <table className="w-full text-[13px]">
          <thead className="border-b text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
            <tr>
              <th className="py-2 text-left">Version ID</th>
              <th className="text-left">Ticker</th>
              <th className="text-left">FY</th>
              <th className="text-left">Status</th>
              <th className="text-right">Completeness</th>
              <th className="text-left">Last edited</th>
            </tr>
          </thead>
          <tbody>
            {all.map((v) => (
              <tr key={v.id} className="border-b last:border-0">
                <td className="py-2 font-mono font-semibold">{v.id}</td>
                <td>{v.ticker}</td>
                <td>{v.fy}</td>
                <td><StatusBadge s={v.status} /></td>
                <td className="text-right tnum">{v.completeness}%</td>
                <td className="text-[var(--color-text-muted)]">
                  {v.lastEditedBy} · {v.lastEditedAt}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </PageShell>
  );
}
