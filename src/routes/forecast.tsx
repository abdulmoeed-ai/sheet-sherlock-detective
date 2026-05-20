import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell, Card, Badge } from "@/components/PageShell";
import { Button } from "@/components/Button";
import { TrendingUp, Sparkles } from "lucide-react";

export const Route = createFileRoute("/forecast")({
  head: () => ({
    meta: [
      { title: "5-Year Forecast — Sheet Sherlock" },
      { name: "description", content: "Predictive 5-year sector forecasts with Base / Bull / Bear scenarios driven by PSX and macro data." },
    ],
  }),
  component: Forecast,
});

const scenarios = {
  Base: [28.4, 31.2, 34.0, 37.1, 40.3, 43.2],
  Bull: [28.4, 32.8, 37.9, 43.7, 49.6, 55.1],
  Bear: [28.4, 29.1, 29.4, 30.0, 30.8, 31.5],
};

function Forecast() {
  const [tab, setTab] = useState<"Base" | "Bull" | "Bear">("Base");
  const data = scenarios[tab];
  const max = Math.max(...Object.values(scenarios).flat());
  const years = ["FY25A", "FY26E", "FY27E", "FY28E", "FY29E", "FY30E"];

  return (
    <PageShell
      title="5-Year Sector Forecast — Cement"
      subtitle="Prediction Agent · driven by PSX, APCMA, NEPRA, SBP · sensitivity from historical volatility"
      actions={
        <>
          <Button variant="secondary">Export</Button>
          <Button>
            <Sparkles className="h-4 w-4" /> Re-train
          </Button>
        </>
      }
    >
      <div className="mb-5 flex items-center gap-3">
        <div className="inline-flex rounded-lg p-1" style={{ background: "var(--color-table-header)" }}>
          {(["Base", "Bull", "Bear"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setTab(s)}
              className="rounded-md px-4 py-1.5 text-[13px] font-medium transition-colors"
              style={{
                background: tab === s ? "#fff" : "transparent",
                color: tab === s ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                boxShadow: tab === s ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <span className="text-[12px] text-[var(--color-text-muted)]">across</span>
        <Pill label="Sector: Cement" />
        <span className="text-[12px] text-[var(--color-text-muted)]">on</span>
        <Pill label="Forecast horizon: 5Y" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="text-[12px] uppercase tracking-wider text-[var(--color-text-secondary)]">FY30 Revenue</div>
          <div className="num !text-left mt-2 text-[28px] font-bold tnum">PKR {data[5].toFixed(1)}Bn</div>
          <div className="mt-2">
            <Badge tone="success">CAGR {((Math.pow(data[5] / data[0], 1 / 5) - 1) * 100).toFixed(1)}%</Badge>
          </div>
        </Card>
        <Card>
          <div className="text-[12px] uppercase tracking-wider text-[var(--color-text-secondary)]">EBITDA margin (avg)</div>
          <div className="num !text-left mt-2 text-[28px] font-bold tnum">
            {tab === "Bull" ? "26.4%" : tab === "Bear" ? "18.1%" : "22.3%"}
          </div>
          <div className="mt-2">
            <Badge tone="info">±2.8% sensitivity</Badge>
          </div>
        </Card>
        <Card>
          <div className="text-[12px] uppercase tracking-wider text-[var(--color-text-secondary)]">Free cash flow (cum.)</div>
          <div className="num !text-left mt-2 text-[28px] font-bold tnum">
            PKR {tab === "Bull" ? "118.4" : tab === "Bear" ? "47.2" : "82.6"}Bn
          </div>
          <div className="mt-2">
            <Badge tone={tab === "Bear" ? "warning" : "success"}>{tab} scenario</Badge>
          </div>
        </Card>
      </div>

      <Card className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[var(--color-accent-sparkle)]" /> Revenue trajectory — {tab}
          </h3>
          <span className="text-[12px] text-[var(--color-text-muted)]">PKR Bn</span>
        </div>
        <div className="flex h-[260px] items-end gap-4 border-b border-l px-4 pb-1 pt-4" style={{ borderColor: "var(--color-border-default)" }}>
          {data.map((v, i) => (
            <div key={years[i]} className="flex flex-1 flex-col items-center gap-2">
              <div className="text-[12px] font-semibold tnum">{v.toFixed(1)}</div>
              <div
                className="w-full rounded-t-md transition-all"
                style={{
                  height: `${(v / max) * 200}px`,
                  background:
                    i === 0
                      ? "var(--color-text-muted)"
                      : tab === "Bull"
                      ? "var(--color-accent-mid)"
                      : tab === "Bear"
                      ? "var(--color-warning)"
                      : "var(--color-brand)",
                }}
              />
              <div className="text-[11px] font-medium text-[var(--color-text-secondary)]">{years[i]}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-5">
        <h3 className="text-[15px] font-semibold">Key drivers</h3>
        <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-[13px]">
          {[
            ["Cement despatch growth", "+6.2% / yr", "APCMA"],
            ["Coal price (CIF)", "USD 158/t → 142/t", "WSJ"],
            ["SBP policy rate", "21.50% → 16.00%", "SBP"],
            ["PKR/USD", "284 → 312", "Bloomberg"],
            ["Power tariff (industrial)", "PKR 38.4/kWh", "NEPRA"],
            ["Construction GDP", "+4.8% / yr", "PBS"],
          ].map(([k, v, s]) => (
            <div key={k} className="flex items-center justify-between border-b py-2" style={{ borderColor: "var(--color-border-default)" }}>
              <span className="text-[var(--color-text-secondary)]">{k}</span>
              <span className="flex items-center gap-2">
                <span className="font-semibold tnum">{v}</span>
                <Badge tone="ai">{s}</Badge>
              </span>
            </div>
          ))}
        </div>
      </Card>
    </PageShell>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-[13px] font-medium"
      style={{ borderColor: "var(--color-border-default)" }}
    >
      {label}
    </span>
  );
}
