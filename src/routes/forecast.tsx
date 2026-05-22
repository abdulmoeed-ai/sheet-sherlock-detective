import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PageShell } from "@/components/PageShell";
import { cycleStore, useCycle } from "@/lib/cycle-store";
import { Pencil } from "lucide-react";

export const Route = createFileRoute("/forecast")({
  head: () => ({
    meta: [
      { title: "5-Year Forecast — Sheet Sherlock" },
      { name: "description", content: "Scenario-based revenue forecasting with what-if macro sensitivity." },
    ],
  }),
  component: Forecast,
});

const BASE_SCENARIOS = {
  Base: [54.8, 60.1, 65.4, 70.2, 74.3, 78.4],
  Bull: [54.8, 62.4, 70.8, 79.1, 87.0, 91.2],
  Bear: [54.8, 56.0, 57.8, 59.6, 61.0, 63.1],
};
const YEARS = ["FY2025", "FY2026", "FY2027", "FY2028", "FY2029", "FY2030"];

function Forecast() {
  const navigate = useNavigate();
  const cycle = useCycle();
  const [scenario, setScenario] = useState<"Base" | "Bull" | "Bear">("Base");
  const [kibor, setKibor] = useState(18.5);
  const [cpi, setCpi] = useState(11.2);
  const [fx, setFx] = useState(287);

  // Sensitivity multiplier — simple mock recalc
  const adj = useMemo(() => {
    const kiborImpact = (kibor - 18.5) * -0.008;
    const cpiImpact = (cpi - 11.2) * 0.004;
    const fxImpact = (fx - 287) * 0.0008;
    return 1 + kiborImpact + cpiImpact + fxImpact;
  }, [kibor, cpi, fx]);

  const series = useMemo(() => {
    const out: Record<string, number[]> = {};
    (Object.keys(BASE_SCENARIOS) as Array<keyof typeof BASE_SCENARIOS>).forEach((k) => {
      out[k] = BASE_SCENARIOS[k].map((v, i) => (i === 0 ? v : v * adj));
    });
    return out as Record<"Base" | "Bull" | "Bear", number[]>;
  }, [adj]);

  const diagnosisReady = cycle.status === "review" || cycle.status === "approved" || cycle.status === "forecast" || cycle.status === "assumptions";

  return (
    <PageShell title={`5-Year Forecast — ${cycle.sector} · ${cycle.company}`} subtitle="Scenario-based revenue projection driven by PSX historicals + ADB macro">
      <div className="pb-24">
        {/* Diagnosis lock status banner */}
        <div
          className="mb-4 flex items-center justify-between rounded-lg border px-4 py-3"
          style={{
            background: diagnosisReady ? "#F0FDF4" : "#FFFBEB",
            borderColor: diagnosisReady ? "#A7F3D0" : "#FDE68A",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full"
              style={{ background: diagnosisReady ? "#D1FAE5" : "#FEF3C7" }}
            >
              <span style={{ color: diagnosisReady ? "#15803D" : "#B45309", fontSize: 14 }}>
                {diagnosisReady ? "🔒" : "⚠"}
              </span>
            </div>
            <div>
              <div className="text-[13px] font-semibold" style={{ color: diagnosisReady ? "#15803D" : "#B45309" }}>
                {diagnosisReady
                  ? "Diagnosis locked — forecast is using finalized figures"
                  : "Diagnosis not yet marked ready for CEO review"}
              </div>
              <div className="text-[12px]" style={{ color: diagnosisReady ? "#15803D" : "#92400E", opacity: 0.85 }}>
                {diagnosisReady
                  ? "Balance Sheet, P&L and Cash Flow values are frozen as the baseline for projections."
                  : "Underlying figures may still change. Lock the diagnosis to freeze the forecast baseline."}
              </div>
            </div>
          </div>
          {!diagnosisReady && (
            <button
              onClick={() => navigate({ to: "/diagnosis" })}
              className="h-8 rounded-md px-3 text-[12px] font-semibold text-white"
              style={{ background: "#7B68EE" }}
            >
              Open diagnosis →
            </button>
          )}
        </div>

        {/* Top — scenario + chart */}
        <div className="rounded-xl border bg-white p-6" style={{ borderColor: "var(--color-border-default)" }}>
          <div className="flex items-center justify-between">
            <div className="text-[14px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
              {cycle.company} · Revenue Forecast FY2026–FY2030
            </div>
            <div className="inline-flex rounded-full border p-0.5" style={{ borderColor: "var(--color-border-default)" }}>
              {(["Base", "Bull", "Bear"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setScenario(s)}
                  className="h-7 rounded-full px-4 text-[12px] font-semibold"
                  style={
                    scenario === s
                      ? { background: "var(--color-brand)", color: "#fff" }
                      : { background: "transparent", color: "var(--color-text-secondary)" }
                  }
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <ForecastSvg series={series} active={scenario} />
          </div>

          {/* What-if sliders */}
          <div className="mt-5 grid grid-cols-3 gap-5 border-t pt-4" style={{ borderColor: "var(--color-border-default)" }}>
            <Slider label="KIBOR" value={kibor} min={15} max={25} step={0.1} onChange={setKibor} fmt={(v) => `${v.toFixed(1)}%`} />
            <Slider label="CPI (YoY)" value={cpi} min={8} max={18} step={0.1} onChange={setCpi} fmt={(v) => `${v.toFixed(1)}%`} />
            <Slider label="PKR/USD" value={fx} min={260} max={320} step={1} onChange={setFx} fmt={(v) => v.toFixed(0)} />
          </div>
        </div>

        {/* Bottom — two cards */}
        <div className="mt-5 grid grid-cols-2 gap-4">
          <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: "var(--color-border-default)" }}>
            <div className="border-b px-5 py-3 text-[13px] font-semibold" style={{ borderColor: "var(--color-border-default)", color: "var(--color-text-primary)" }}>
              Scenario summary
            </div>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase" style={{ background: "var(--color-table-header)", color: "var(--color-text-muted)" }}>
                  <th className="px-4 py-2">Scenario</th>
                  <th className="px-4 py-2 text-right">FY2030 Revenue</th>
                  <th className="px-4 py-2 text-right">CAGR</th>
                  <th className="px-4 py-2 text-right">EBITDA Margin</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { s: "Base", v: series.Base[5], cagr: 11.2, m: 24.8, bg: "#fff", fg: "var(--color-text-primary)" },
                  { s: "Bull", v: series.Bull[5], cagr: 13.7, m: 27.3, bg: "#F0FDF4", fg: "var(--color-success-fg)" },
                  { s: "Bear", v: series.Bear[5], cagr: 7.8,  m: 20.1, bg: "#FEF2F2", fg: "var(--color-danger-fg)" },
                ].map((r) => (
                  <tr key={r.s} style={{ background: r.bg, color: r.fg, borderTop: "1px solid var(--color-border-default)" }}>
                    <td className="px-4 py-2.5 font-semibold">{r.s}</td>
                    <td className="px-4 py-2.5 text-right tnum">PKR {r.v.toFixed(1)}B</td>
                    <td className="px-4 py-2.5 text-right tnum">{r.cagr.toFixed(1)}%</td>
                    <td className="px-4 py-2.5 text-right tnum">{r.m.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border bg-white p-5" style={{ borderColor: "var(--color-border-default)" }}>
            <div className="text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Key assumptions
            </div>
            <div className="mt-3 space-y-2">
              {[
                ["PSX", "Cement dispatches CAGR", "+4.2%/yr"],
                ["SBP", "KIBOR", `${kibor.toFixed(1)}%`],
                ["ADB", "CPI (Pakistan)", `${cpi.toFixed(1)}%`],
              ].map(([src, k, v]) => (
                <div key={k} className="flex items-center gap-2.5">
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{ background: "var(--color-tag-bg)", color: "var(--color-accent-sparkle)" }}
                  >
                    {src}
                  </span>
                  <span className="flex-1 text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
                    {k}
                  </span>
                  <span className="text-[13px] font-semibold tnum" style={{ color: "var(--color-text-primary)" }}>
                    {v}
                  </span>
                  <Pencil className="h-3 w-3" style={{ color: "var(--color-text-muted)" }} />
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              {[
                "±1MT cement dispatch = ±PKR 0.8B revenue impact",
                "KIBOR at 22%+ compresses margin ~180bps",
              ].map((r) => (
                <div
                  key={r}
                  className="flex items-start gap-2 rounded-r-md px-3 py-2 text-[12px]"
                  style={{
                    background: "var(--color-warning-bg)",
                    borderLeft: "3px solid var(--color-warning)",
                    color: "var(--color-warning-fg)",
                  }}
                >
                  <span className="mt-1 h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-warning)" }} />
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        className="fixed bottom-0 left-[240px] right-0 z-20 flex h-16 items-center justify-end border-t bg-white px-8"
        style={{ borderColor: "var(--color-border-default)" }}
      >
        <button
          onClick={() => {
            cycleStore.setStatus("assumptions");
            navigate({ to: "/assumptions" });
          }}
          className="h-10 rounded-lg px-5 text-[13px] font-semibold text-white"
          style={{ background: "var(--color-brand)" }}
        >
          Review assumptions →
        </button>
      </div>
    </PageShell>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  fmt,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt: (v: number) => string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-[80px] text-[12px]" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1"
        style={{ accentColor: "var(--color-brand)" }}
      />
      <span className="w-[60px] text-right text-[13px] font-semibold tnum" style={{ color: "var(--color-brand)" }}>
        {fmt(value)}
      </span>
    </div>
  );
}

function ForecastSvg({
  series,
  active,
}: {
  series: Record<"Base" | "Bull" | "Bear", number[]>;
  active: "Base" | "Bull" | "Bear";
}) {
  const w = 760;
  const h = 240;
  const padL = 40;
  const padR = 80;
  const padT = 20;
  const padB = 30;
  const allVals = [...series.Base, ...series.Bull, ...series.Bear];
  const min = 40;
  const max = Math.max(...allVals) + 5;
  const xy = (vals: number[]) =>
    vals.map((v, i) => [
      padL + (i * (w - padL - padR)) / (vals.length - 1),
      padT + (h - padT - padB) * (1 - (v - min) / (max - min)),
    ]);
  const path = (vals: number[]) =>
    xy(vals)
      .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`)
      .join(" ");

  // Confidence band ±15%
  const baseXY = xy(series.Base);
  const bandTop = xy(series.Base.map((v) => v * 1.15));
  const bandBot = xy(series.Base.map((v) => v * 0.85));
  const bandPath =
    `M ${bandTop[0][0]} ${bandTop[0][1]} ` +
    bandTop.slice(1).map(([x, y]) => `L ${x} ${y}`).join(" ") +
    " " +
    bandBot.reverse().map(([x, y]) => `L ${x} ${y}`).join(" ") +
    " Z";

  const lineFor = (s: "Base" | "Bull" | "Bear") => {
    const color = s === "Base" ? "#7B68EE" : s === "Bull" ? "#22C55E" : "#F44336";
    const isActive = s === active;
    return (
      <path
        key={s}
        d={path(series[s])}
        fill="none"
        stroke={color}
        strokeWidth={isActive ? 2.5 : 1.5}
        strokeOpacity={isActive ? 1 : 0.35}
        strokeDasharray={s === "Base" ? "0" : "4 4"}
      />
    );
  };

  const lastPt = baseXY[5];
  const activeLast = xy(series[active])[5];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h}>
      {[0.25, 0.5, 0.75].map((r) => (
        <line key={r} x1={padL} y1={padT + r * (h - padT - padB)} x2={w - padR} y2={padT + r * (h - padT - padB)} stroke="#F3F4F6" />
      ))}
      <path d={bandPath} fill="#F0FDF4" opacity={0.5} />
      {lineFor("Bear")}
      {lineFor("Bull")}
      {lineFor("Base")}
      <circle cx={activeLast[0]} cy={activeLast[1]} r={5} fill="#7B68EE" />
      <text x={activeLast[0] + 8} y={activeLast[1] + 4} fontSize={12} fill="#7B68EE" fontWeight={700}>
        PKR {series[active][5].toFixed(1)}B
      </text>
      {YEARS.map((y, i) => (
        <text
          key={y}
          x={padL + (i * (w - padL - padR)) / 5}
          y={h - 8}
          fontSize={11}
          fill="#9CA3AF"
          textAnchor="middle"
        >
          {y}
        </text>
      ))}
    </svg>
  );
}
