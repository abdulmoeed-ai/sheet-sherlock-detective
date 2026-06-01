import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell, Card, Badge } from "@/components/PageShell";
import { Button } from "@/components/Button";
import { MessagesSquare, CheckCircle2, Clock, ArrowRight } from "lucide-react";
import { cycleStore } from "@/lib/cycle-store";

export const Route = createFileRoute("/inbox")({
  head: () => ({
    meta: [
      { title: "Inbox · Teams Requests — Sheet Sherlock" },
      { name: "description", content: "Requests sent by Finance Manager via Microsoft Teams integration." },
    ],
  }),
  component: Inbox,
});

interface Request {
  id: string;
  from: string;
  sector: string;
  company: string;
  ticker: string;
  period: string;
  message: string;
  receivedAt: string;
  status: "new" | "acknowledged" | "in-progress";
  channel: "Teams" | "Email";
}

const SEED: Request[] = [
  {
    id: "REQ-2049",
    from: "Faisal K. (Finance Manager)",
    sector: "Engineering & Industrials",
    company: "Millat Tractors Limited",
    ticker: "MTL",
    period: "FY2025",
    message: "Please run the FY2025 cycle for MTL. Need draft ready for CFO review by Friday.",
    receivedAt: "Today · 09:14",
    status: "new",
    channel: "Teams",
  },
  {
    id: "REQ-2048",
    from: "Faisal K. (Finance Manager)",
    sector: "Banking & Finance",
    company: "MCB Bank",
    ticker: "MCB",
    period: "FY2024",
    message: "Refresh MCB FY2024 model — Basel III ratios require update.",
    receivedAt: "Yesterday · 16:42",
    status: "in-progress",
    channel: "Teams",
  },
  {
    id: "REQ-2046",
    from: "Faisal K. (Finance Manager)",
    sector: "Fertilizers",
    company: "Engro Fertilizers",
    ticker: "EFERT",
    period: "FY2024",
    message: "EFERT FY2024 done — please archive and send to CFO.",
    receivedAt: "Mon · 11:01",
    status: "acknowledged",
    channel: "Teams",
  },
];

function Inbox() {
  const navigate = useNavigate();
  const [items, setItems] = useState(SEED);

  const accept = (r: Request) => {
    setItems((xs) => xs.map((x) => (x.id === r.id ? { ...x, status: "in-progress" } : x)));
    cycleStore.startCycle({ sector: r.sector, company: r.company, period: r.period });
    navigate({ to: "/registry", search: { ticker: r.ticker, fy: r.period } as never });
  };

  return (
    <PageShell
      title="Inbox · Teams Requests"
      subtitle="Requests forwarded by your Finance Manager via Microsoft Teams. Accept to begin a cycle."
      hideProgress
      actions={
        <Badge tone="info">
          <MessagesSquare className="mr-1 inline h-3 w-3" />
          Teams integration live
        </Badge>
      }
    >
      <div className="mb-5 grid grid-cols-3 gap-4">
        {[
          ["Open requests", items.filter((i) => i.status === "new").length.toString()],
          ["In progress", items.filter((i) => i.status === "in-progress").length.toString()],
          ["Acknowledged", items.filter((i) => i.status === "acknowledged").length.toString()],
        ].map(([k, v]) => (
          <Card key={k}>
            <div className="text-[12px] uppercase tracking-wider text-[var(--color-text-secondary)]">{k}</div>
            <div className="mt-2 text-[24px] font-bold tnum">{v}</div>
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        {items.map((r) => (
          <Card key={r.id}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge tone={r.status === "new" ? "info" : r.status === "in-progress" ? "warning" : "success"}>
                    {r.status === "new" ? "NEW" : r.status === "in-progress" ? "IN PROGRESS" : "ACKNOWLEDGED"}
                  </Badge>
                  <Badge tone="neutral">{r.channel}</Badge>
                  <span className="text-[12px] text-[var(--color-text-muted)]">
                    {r.id} · {r.receivedAt}
                  </span>
                </div>
                <div className="mt-2 text-[15px] font-semibold text-[var(--color-text-primary)]">
                  {r.company} ({r.ticker}) · {r.period}
                </div>
                <div className="text-[12px] text-[var(--color-text-muted)]">
                  {r.sector} · from {r.from}
                </div>
                <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">"{r.message}"</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {r.status === "new" ? (
                  <Button onClick={() => accept(r)}>
                    Accept & start cycle <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : r.status === "in-progress" ? (
                  <Button variant="secondary" onClick={() => navigate({ to: "/ingestion" })}>
                    <Clock className="h-4 w-4" /> Continue
                  </Button>
                ) : (
                  <Badge tone="success">
                    <CheckCircle2 className="mr-1 inline h-3 w-3" /> Closed
                  </Badge>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
