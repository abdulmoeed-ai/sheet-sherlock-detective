import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell, Card, Badge } from "@/components/PageShell";
import { Button } from "@/components/Button";
import { Bell, Send, CheckCircle2, MessageSquare, Plus } from "lucide-react";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Teams Notifications — F(AI)nance" },
      {
        name: "description",
        content:
          "Outbound Microsoft Teams notification rules and delivery log for ingestion, diagnosis, sign-off and source health.",
      },
    ],
  }),
  component: Notifications,
});

interface Rule {
  id: string;
  trigger: string;
  channel: string;
  enabled: boolean;
  recipients: string;
}

interface LogEntry {
  id: string;
  ts: string;
  event: string;
  channel: string;
  status: "delivered" | "queued" | "failed";
  preview: string;
}

const INITIAL_RULES: Rule[] = [
  {
    id: "n1",
    trigger: "Ingestion completed",
    channel: "#fp&a-cycle",
    enabled: true,
    recipients: "Analyst, Manager",
  },
  {
    id: "n2",
    trigger: "Diagnosis needs reviewer",
    channel: "#fp&a-cycle",
    enabled: true,
    recipients: "Manager",
  },
  {
    id: "n3",
    trigger: "Diagnosis: imbalance detected",
    channel: "DM · Analyst",
    enabled: true,
    recipients: "Analyst",
  },
  {
    id: "n4",
    trigger: "CFO sign-off requested",
    channel: "DM · CFO",
    enabled: true,
    recipients: "CFO",
  },
  {
    id: "n5",
    trigger: "Source Health: STALE / DOWN",
    channel: "#sherlock-alerts",
    enabled: true,
    recipients: "Admin",
  },
  {
    id: "n6",
    trigger: "Forecast Prediction Agent run",
    channel: "#fp&a-cycle",
    enabled: false,
    recipients: "Manager, CFO",
  },
];

const INITIAL_LOG: LogEntry[] = [
  {
    id: "l1",
    ts: "2026-05-20 09:32",
    event: "Ingestion completed",
    channel: "#fp&a-cycle",
    status: "delivered",
    preview: "MTL_FY2025_v1 · 247 cells ingested from 4 portals. Confidence 96%.",
  },
  {
    id: "l2",
    ts: "2026-05-20 09:34",
    event: "Diagnosis needs reviewer",
    channel: "#fp&a-cycle",
    status: "delivered",
    preview: "12 deltas, 2 blocked. Open Diagnosis →",
  },
  {
    id: "l3",
    ts: "2026-05-20 09:41",
    event: "Source Health: STALE",
    channel: "#sherlock-alerts",
    status: "delivered",
    preview: "SBP weekly publication overdue by 6h. Fallback: AKD Research.",
  },
  {
    id: "l4",
    ts: "2026-05-20 09:55",
    event: "CFO sign-off requested",
    channel: "DM · CFO",
    status: "queued",
    preview: "MTL_FY2025_v1 ready for sign-off. Executive brief attached.",
  },
  {
    id: "l5",
    ts: "2026-05-19 17:08",
    event: "Source Health: DOWN",
    channel: "#sherlock-alerts",
    status: "failed",
    preview: "Investify+SWS unreachable. Retry in 15m.",
  },
];

function statusBadge(s: LogEntry["status"]) {
  if (s === "delivered")
    return (
      <Badge tone="success">
        <CheckCircle2 className="mr-1 inline h-3 w-3" />
        Delivered
      </Badge>
    );
  if (s === "queued") return <Badge tone="warning">Queued</Badge>;
  return <Badge tone="danger">Failed</Badge>;
}

function Notifications() {
  const [rules, setRules] = useState<Rule[]>(INITIAL_RULES);
  const [log, setLog] = useState<LogEntry[]>(INITIAL_LOG);

  const toggle = (id: string) =>
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));

  const sendTest = () => {
    const entry: LogEntry = {
      id: `l-${Date.now()}`,
      ts: new Date().toISOString().slice(0, 16).replace("T", " "),
      event: "Test notification",
      channel: "#fp&a-cycle",
      status: "delivered",
      preview: "F(AI)nance test message from notification rules screen.",
    };
    setLog((l) => [entry, ...l]);
  };

  const active = rules.filter((r) => r.enabled).length;

  return (
    <PageShell
      title="Teams Outbound Notifications"
      subtitle="Push cycle events to Microsoft Teams channels and DMs. Recipient mapping mirrors the role registry."
      hideProgress
      actions={
        <>
          <Button variant="secondary" onClick={sendTest}>
            <Send className="h-4 w-4" />
            Send test
          </Button>
          <Button>
            <Plus className="h-4 w-4" />
            New rule
          </Button>
        </>
      }
    >
      <div
        className="mb-5 flex items-center gap-3 rounded-[10px] border px-5 py-3.5"
        style={{ background: "var(--color-tag-bg)", borderColor: "var(--color-brand-light)" }}
      >
        <MessageSquare className="h-5 w-5" style={{ color: "var(--color-brand)" }} />
        <div className="text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
          {active} of {rules.length} rules active · connected to Microsoft Teams tenant{" "}
          <b>millat.com.pk</b>.
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-5">
        <Card>
          <h3 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
            <Bell className="h-4 w-4 text-[var(--color-brand)]" /> Notification rules
          </h3>
          <table className="w-full text-[13px]">
            <thead className="border-b text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
              <tr>
                <th className="py-2 text-left">Trigger</th>
                <th className="text-left">Channel</th>
                <th className="text-left">Recipients</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 font-medium">{r.trigger}</td>
                  <td className="font-mono text-[12px]">{r.channel}</td>
                  <td className="text-[var(--color-text-muted)]">{r.recipients}</td>
                  <td>
                    <button
                      onClick={() => toggle(r.id)}
                      className="inline-flex h-5 w-9 items-center rounded-full transition-colors"
                      style={{
                        background: r.enabled ? "var(--color-brand)" : "var(--color-border-strong)",
                      }}
                      aria-label="toggle rule"
                    >
                      <span
                        className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                        style={{ transform: r.enabled ? "translateX(18px)" : "translateX(2px)" }}
                      />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <h3 className="mb-3 text-[15px] font-semibold">Delivery log</h3>
          <div className="space-y-2">
            {log.map((e) => (
              <div
                key={e.id}
                className="rounded-lg border p-3"
                style={{ borderColor: "var(--color-border-default)" }}
              >
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-semibold">{e.event}</div>
                  {statusBadge(e.status)}
                </div>
                <div className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                  {e.ts} · {e.channel}
                </div>
                <div className="mt-1.5 text-[12px] text-[var(--color-text-secondary)]">
                  {e.preview}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
