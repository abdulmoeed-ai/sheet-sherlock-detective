import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell, Card, Badge } from "@/components/PageShell";
import { Button } from "@/components/Button";
import { KeyRound, RefreshCw, AlertTriangle, CheckCircle2, Activity } from "lucide-react";

export const Route = createFileRoute("/sources")({
  head: () => ({
    meta: [
      { title: "Source Registry — Sheet Sherlock" },
      { name: "description", content: "Admin: 13-portal source registry, credential rotation and health monitor." },
    ],
  }),
  component: Sources,
});

type Health = "live" | "stale" | "down";
interface SourceRow {
  name: string;
  category: "Market" | "Macro" | "Broker" | "Filings" | "Sentiment";
  health: Health;
  reliability: number;
  schedule: string;
  lastSeen: string;
  apiKey: string;
  fallback: string;
}

const SOURCES: SourceRow[] = [
  { name: "PSX",                 category: "Filings",   health: "live", reliability: 99, schedule: "Daily 09:00 PKT",  lastSeen: "2026-05-20 09:02", apiKey: "psx_•••••••3a91", fallback: "Sarmaaya.pk" },
  { name: "ADB",                 category: "Macro",     health: "live", reliability: 96, schedule: "Quarterly",         lastSeen: "2026-04-22 11:00", apiKey: "adb_•••••••2c44", fallback: "IMF" },
  { name: "Bloomberg",           category: "Market",    health: "live", reliability: 98, schedule: "Realtime",          lastSeen: "2026-05-20 09:30", apiKey: "blp_•••••••f1b0", fallback: "WSJ" },
  { name: "WSJ",                 category: "Market",    health: "live", reliability: 92, schedule: "Hourly",            lastSeen: "2026-05-20 08:48", apiKey: "wsj_•••••••aa77", fallback: "Bloomberg" },
  { name: "SBP",                 category: "Macro",     health: "stale", reliability: 90, schedule: "Weekly Mon",       lastSeen: "2026-05-12 10:00", apiKey: "sbp_•••••••91dc", fallback: "AKD Research" },
  { name: "AKD Securities",      category: "Broker",    health: "live", reliability: 89, schedule: "Daily 16:00 PKT",  lastSeen: "2026-05-19 16:10", apiKey: "akd_•••••••7f30", fallback: "Arif Habib" },
  { name: "Arif Habib",          category: "Broker",    health: "live", reliability: 88, schedule: "Daily 16:00 PKT",  lastSeen: "2026-05-19 16:05", apiKey: "arif_••••••3b18", fallback: "TopLine" },
  { name: "TopLine Securities",  category: "Broker",    health: "live", reliability: 87, schedule: "Daily 16:30 PKT",  lastSeen: "2026-05-19 16:32", apiKey: "topl_••••••cc02", fallback: "JS Global" },
  { name: "JS Global Capital",   category: "Broker",    health: "live", reliability: 86, schedule: "Daily 17:00 PKT",  lastSeen: "2026-05-19 17:01", apiKey: "jsgc_••••••ee31", fallback: "AKD" },
  { name: "IMF",                 category: "Macro",     health: "live", reliability: 94, schedule: "Monthly",           lastSeen: "2026-05-01 12:00", apiKey: "imf_•••••••40bc", fallback: "ADB" },
  { name: "Sarmaaya.pk",         category: "Sentiment", health: "live", reliability: 81, schedule: "Daily",             lastSeen: "2026-05-20 07:00", apiKey: "smaa_•••••72de", fallback: "Investify" },
  { name: "SCSTrading",          category: "Sentiment", health: "live", reliability: 79, schedule: "Daily",             lastSeen: "2026-05-19 19:55", apiKey: "scst_••••••88fa", fallback: "Investify" },
  { name: "Investify + SWS",     category: "Sentiment", health: "down", reliability: 75, schedule: "Daily",             lastSeen: "2026-05-15 11:42", apiKey: "inv_•••••••12ab", fallback: "Sarmaaya.pk" },
];

function healthBadge(h: Health) {
  if (h === "live")   return <Badge tone="success"><CheckCircle2 className="mr-1 inline h-3 w-3" />LIVE</Badge>;
  if (h === "stale")  return <Badge tone="warning"><AlertTriangle className="mr-1 inline h-3 w-3" />STALE</Badge>;
  return <Badge tone="danger"><AlertTriangle className="mr-1 inline h-3 w-3" />DOWN</Badge>;
}

function Sources() {
  const [rotating, setRotating] = useState<string | null>(null);
  const stale = SOURCES.filter((s) => s.health !== "live");

  return (
    <PageShell
      title="Source Registry & Credential Manager"
      subtitle="Admin · 13 portals · API keys, fallback chains, publication schedules, and the 6-hour Source Health Monitor."
      hideProgress
      actions={
        <Button variant="secondary"><RefreshCw className="h-4 w-4" />Re-run health check</Button>
      }
    >
      {stale.length > 0 && (
        <div
          className="mb-5 flex items-center gap-3 rounded-[10px] border px-5 py-3.5"
          style={{ background: "var(--color-warning-bg)", borderColor: "#FCD34D" }}
        >
          <Activity className="h-5 w-5" style={{ color: "var(--color-warning-fg)" }} />
          <div className="text-[13px] font-semibold" style={{ color: "var(--color-warning-fg)" }}>
            Source Health Monitor: {stale.length} source(s) outside expected publication window. Resolve before initiating a new cycle.
          </div>
        </div>
      )}

      <div className="mb-5 grid grid-cols-4 gap-4">
        {[
          ["Total sources", "13"],
          ["Live", SOURCES.filter((s) => s.health === "live").length.toString()],
          ["Stale", SOURCES.filter((s) => s.health === "stale").length.toString()],
          ["Down", SOURCES.filter((s) => s.health === "down").length.toString()],
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
              <th className="py-2 text-left">Source</th>
              <th className="text-left">Category</th>
              <th className="text-left">Health</th>
              <th className="text-right">Reliability</th>
              <th className="text-left">Schedule</th>
              <th className="text-left">Last seen</th>
              <th className="text-left">API key</th>
              <th className="text-left">Fallback</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {SOURCES.map((s) => (
              <tr key={s.name} className="border-b last:border-0">
                <td className="py-2 font-semibold">{s.name}</td>
                <td>{s.category}</td>
                <td>{healthBadge(s.health)}</td>
                <td className="text-right tnum">{s.reliability}%</td>
                <td className="text-[var(--color-text-muted)]">{s.schedule}</td>
                <td className="text-[var(--color-text-muted)]">{s.lastSeen}</td>
                <td className="font-mono text-[11px]">{s.apiKey}</td>
                <td className="text-[var(--color-text-muted)]">{s.fallback}</td>
                <td>
                  <button
                    onClick={() => {
                      setRotating(s.name);
                      setTimeout(() => setRotating(null), 1200);
                    }}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] hover:bg-[var(--color-tag-bg)]"
                    style={{ borderColor: "var(--color-border-default)", color: "var(--color-brand)" }}
                  >
                    <KeyRound className="h-3 w-3" />
                    {rotating === s.name ? "Rotating…" : "Rotate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </PageShell>
  );
}
