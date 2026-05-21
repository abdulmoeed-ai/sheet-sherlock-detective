import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageShell } from "@/components/PageShell";

import {
  AlertTriangle,
  TrendingUp,
  PieChart,
  DollarSign,
  Droplet,
  Scale,
  Banknote,
  ChevronDown,
  Sparkles,
  Plus,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Financial Intelligence — Sheet Sherlock" },
      { name: "description", content: "CFO dashboard: live financial health, variance bridge, 5-year sector forecast, and cycle approvals." },
    ],
  }),
  component: Dashboard,
});

// ────────── Sector / company catalog ──────────
const CATALOG: Record<string, string[]> = {
  Cement: ["Lucky Cement", "DG Khan Cement", "Bestway Cement", "Maple Leaf Cement", "Fauji Cement"],
  Banking: ["MCB Bank", "HBL", "UBL", "Allied Bank", "Bank Alfalah", "Meezan Bank"],
  "Oil & Gas": ["OGDC", "PPL", "POL", "MARI", "PSO"],
  Fertilizers: ["Engro Fertilizers", "FFC", "FFBL", "Fatima Fertilizer"],
  Textiles: ["Nishat Mills", "Interloop", "Gul Ahmed", "Kohinoor Textile"],
  "IT / Software": ["Systems Limited", "NetSol Tech", "Avanceon", "TRG Pakistan"],
  "Power & Energy": ["HUBCO", "K-Electric", "Nishat Power", "Kohinoor Energy"],
  Steel: ["International Steels", "Aisha Steel", "Mughal Iron"],
  Pharmaceuticals: ["GlaxoSmithKline", "Searle", "Highnoon Labs", "Ferozsons"],
  "Auto Parts": ["Indus Motor", "Honda Atlas", "Pak Suzuki", "Millat Tractors"],
  "Construction Materials": ["Cherat Cement", "Pioneer Cement", "Kohat Cement"],
  "Food & FMCG": ["Nestle Pakistan", "Unilever", "National Foods", "Engro Foods"],
};
const SECTORS = Object.keys(CATALOG);
const QUICK_SECTORS = ["Cement", "Banking", "Energy"]; // pills

// ────────── Color tokens (per spec) ──────────
const GREEN = "#1B4332";
const GREEN_MID = "#52B788";
const GREEN_SOFT = "#D1FAE5";
const RED = "#EF4444";
const AMBER = "#F59E0B";
const AMBER_SOFT = "#FEF3C7";
const BORDER = "#E5E7EB";
const SUBTLE = "#F9FAFB";
const TEXT = "#111827";
const MUTED = "#6B7280";
const MUTED_2 = "#9CA3AF";

function Dashboard() {
  const [sector, setSector] = useState("Cement");
  const [company, setCompany] = useState("Lucky Cement");
  const [period, setPeriod] = useState("FY2025");
  const [chartTab, setChartTab] = useState<"Monthly" | "Quarterly" | "Annual">("Quarterly");
  const [scenario, setScenario] = useState<"Base" | "Bull" | "Bear">("Base");

  const companies = CATALOG[sector] ?? [];

  // Pending approvals (controls the alert banner visibility)
  const pendingHardBlocked = 1;
  const pendingDiagnosis = 1;
  const showAlert = pendingHardBlocked + pendingDiagnosis > 0;

  const onSectorChange = (s: string) => {
    setSector(s);
    setCompany(CATALOG[s]?.[0] ?? "");
  };

  return (
    <PageShell title={`${company} · ${period}`} subtitle="Financial intelligence overview · live model">
      {/* ───── Section 0 — Context bar ───── */}
      <div
        className="sticky top-14 z-10 -mx-8 mb-4 flex h-12 items-center justify-between border-b px-8"
        style={{ background: SUBTLE, borderColor: BORDER }}
      >
        <div className="flex items-center gap-2">
          {QUICK_SECTORS.map((s) => {
            const active = sector === s || (s === "Energy" && sector === "Power & Energy");
            return (
              <button
                key={s}
                onClick={() => onSectorChange(s === "Energy" ? "Power & Energy" : s)}
                className="h-7 rounded-full px-3 text-[12px] font-semibold transition-colors"
                style={
                  active
                    ? { background: GREEN, color: "#fff", border: `1px solid ${GREEN}` }
                    : { background: "#fff", color: "#374151", border: "1px solid #D1D5DB" }
                }
              >
                {s}
              </button>
            );
          })}
          <SelectBar value={sector} onChange={onSectorChange} options={SECTORS} width={170} />
          <SelectBar value={company} onChange={setCompany} options={companies} width={190} />
          <span className="mx-1 text-[#D1D5DB]">|</span>
          <SelectBar value={period} onChange={setPeriod} options={["FY2025", "FY2024", "Q3 FY2025", "H1 FY2025"]} width={120} />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[12px]" style={{ color: MUTED }}>
            <span className="h-2 w-2 rounded-full" style={{ background: "#22C55E" }} />
            Data as of May 20, 2026 · 14 sources live
          </div>
          <button
            className="inline-flex h-[34px] items-center gap-2 rounded-lg px-4 text-[13px] font-semibold text-white"
            style={{ background: GREEN }}
          >
            <Sparkles className="h-3.5 w-3.5" /> New ingestion cycle
          </button>
        </div>
      </div>

      {/* ───── Section 1 — Alert banner ───── */}
      {showAlert && (
        <div
          className="-mx-8 mb-5 flex h-11 items-center justify-between px-8"
          style={{ background: AMBER_SOFT, borderLeft: `4px solid ${AMBER}` }}
        >
          <div className="flex items-center gap-2.5 text-[13px]" style={{ color: "#92400E" }}>
            <AlertTriangle className="h-4 w-4" style={{ color: "#B45309" }} />
            <span>
              <span className="font-semibold">{pendingHardBlocked + pendingDiagnosis} items require your attention</span> before this cycle can proceed —{" "}
              {pendingHardBlocked} hard-blocked diff in Sheet BS!F18, {pendingDiagnosis} pending BS diagnosis.
            </span>
          </div>
          <Link to="/diff-review" className="text-[13px] font-semibold" style={{ color: "#B45309" }}>
            Review now →
          </Link>
        </div>
      )}

      {/* ───── Section 2 — Primary KPI row ───── */}
      <div className="grid grid-cols-6 gap-3">
        <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Revenue (FY2025)" value="PKR 54.8B" badge={{ text: "↑ 12.4%", tone: "good" }} comparison="vs PKR 48.7B FY2024" spark="up" />
        <KpiCard icon={<PieChart className="h-4 w-4" />} label="EBITDA Margin" value="23.6%" badge={{ text: "↑ 2.1 pts", tone: "good" }} comparison="vs 21.5% FY2024" spark="up" />
        <KpiCard icon={<DollarSign className="h-4 w-4" />} label="Gross Margin" value="37.4%" badge={{ text: "→ ~0.2 pts", tone: "flat" }} comparison="vs 37.2% FY2024" spark="flat" />
        <KpiCard icon={<Droplet className="h-4 w-4" />} label="Operating CF" value="PKR 8.2B" badge={{ text: "↑ 8.7%", tone: "good" }} comparison="vs PKR 7.5B FY2024" spark="up" />
        <KpiCard icon={<Scale className="h-4 w-4" />} label="Net Debt / EBITDA" value="2.1x" badge={{ text: "↓ 0.4x", tone: "good" }} comparison="vs 2.5x FY2024" gauge={0.42} />
        <KpiCard icon={<Banknote className="h-4 w-4" />} label="Free Cash Flow" value="PKR 4.3B" badge={{ text: "↑ 15.2%", tone: "good" }} comparison="vs PKR 3.7B FY2024" spark="up" />
      </div>

      {/* ───── Section 3 — 60/40 main content ───── */}
      <div className="mt-5 grid grid-cols-[3fr_2fr] gap-5">
        {/* LEFT */}
        <div className="space-y-5">
          {/* Panel A */}
          <div className="rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[14px] font-semibold" style={{ color: TEXT }}>
                Revenue · Actual vs Budget vs Forecast
              </h3>
              <div className="flex items-center gap-4 text-[12px]" style={{ color: MUTED }}>
                {(["Monthly", "Quarterly", "Annual"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setChartTab(t)}
                    className="pb-1"
                    style={{
                      color: chartTab === t ? GREEN : MUTED,
                      borderBottom: chartTab === t ? `2px solid ${GREEN}` : "2px solid transparent",
                      fontWeight: chartTab === t ? 600 : 500,
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <RevenueChart />
            <div className="mt-3 flex items-center gap-8 border-t pt-3" style={{ borderColor: "#F3F4F6" }}>
              <SummaryStat label="Actual" value="PKR 54.8B" />
              <SummaryStat label="Budget" value="PKR 52.0B" />
              <SummaryStat label="Variance" value="+PKR 2.8B (+5.4%)" valueColor="#15803D" />
            </div>
          </div>

          {/* Panel B */}
          <div className="rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: MUTED }}>
              What drove the FY2025 variance?
            </div>
            <div className="mt-3">
              <Waterfall />
            </div>
            <p className="mt-3 text-[12px] italic" style={{ color: MUTED }}>
              Volume and price together offset a PKR 1.8B cost overrun. Cost of goods sold was the primary driver — cement input costs up 14% YoY.
            </p>
          </div>
        </div>

        {/* RIGHT — Panel C */}
        <div className="rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}>
          <div>
            <h3 className="text-[14px] font-semibold" style={{ color: TEXT }}>
              {sector} Sector — 5-Year Outlook
            </h3>
            <div className="mt-1 text-[11px]" style={{ color: MUTED_2 }}>
              {company} · PSX data + ADB macro · Generated May 19, 2026
            </div>
          </div>

          <div className="mt-4 flex justify-center">
            <div className="inline-flex rounded-full border p-0.5" style={{ borderColor: BORDER }}>
              {(["Base", "Bull", "Bear"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setScenario(s)}
                  className="h-7 rounded-full px-4 text-[12px] font-semibold"
                  style={
                    scenario === s
                      ? { background: GREEN, color: "#fff" }
                      : { background: "transparent", color: MUTED }
                  }
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <ForecastChart scenario={scenario} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {[
              ["CPI", "11.2%"],
              ["KIBOR", "18.5%"],
              ["PKR/USD", "287"],
            ].map(([k, v]) => (
              <span
                key={k}
                className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ background: "#F0FDF4", color: "#15803D" }}
              >
                {k}: {v}
              </span>
            ))}
          </div>
          <Link to="/assumptions" className="mt-2 inline-block text-[12px] font-medium" style={{ color: GREEN }}>
            See full assumptions →
          </Link>

          <div className="my-4 h-px" style={{ background: "#F3F4F6" }} />

          <div className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: MUTED }}>
            Key model risks
          </div>
          <ul className="mt-2 space-y-1.5 text-[12px]" style={{ color: "#4B5563" }}>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full" style={{ background: AMBER }} />
              Cement dispatches sensitivity: ±1MT = ±PKR 0.8B
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full" style={{ background: AMBER }} />
              KIBOR at 22%+ compresses margin by ~180bps
            </li>
          </ul>
        </div>
      </div>

      {/* ───── Section 4 — Approval status row ───── */}
      <div className="mt-5 rounded-xl border bg-white px-6 py-4" style={{ borderColor: BORDER }}>
        <div className="grid grid-cols-4 divide-x" style={{ borderColor: "#F3F4F6" }}>
          <div className="pr-6">
            <Eyebrow>Active cycle</Eyebrow>
            <div className="mt-1.5 text-[15px] font-semibold" style={{ color: TEXT }}>
              {period} · {company}
            </div>
            <div className="mt-0.5 text-[12px]" style={{ color: MUTED }}>
              Cycle started May 19 · 47 input cells changed
            </div>
          </div>
          <div className="px-6">
            <Eyebrow>Data confidence</Eyebrow>
            <div className="mt-1.5 flex items-center gap-3">
              <Ring pct={94.2} />
              <div className="text-[11px]" style={{ color: MUTED }}>
                1,284 cells
                <br />
                98.4% auto-verified
              </div>
            </div>
          </div>
          <div className="px-6">
            <Eyebrow>Approval queue</Eyebrow>
            <div className="mt-2 space-y-1.5">
              <QueueRow to="/diff-review" label="Diff Review" status="3 pending" tone="amber" />
              <QueueRow to="/diagnosis" label="BS Diagnosis" status="1 item" tone="amber" />
              <QueueRow to="/audit" label="Manager Sign-off" status="✓ clear" tone="green" />
            </div>
          </div>
          <div className="pl-6">
            <Eyebrow>Last approved</Eyebrow>
            <div className="mt-1.5 text-[13px] font-semibold" style={{ color: TEXT }}>
              FY2024 · Approved Mar 12, 2025
            </div>
            <div className="mt-0.5 text-[12px]" style={{ color: MUTED }}>
              CFO: Ayesha S. · Version locked
            </div>
            <Link to="/audit" className="mt-1.5 inline-block text-[12px] font-medium" style={{ color: GREEN }}>
              View audit trail →
            </Link>
          </div>
        </div>
      </div>

      {/* ───── Section 5 — Macro pulse strip ───── */}
      <div className="mt-5 rounded-[10px] border px-6 py-3" style={{ background: SUBTLE, borderColor: BORDER }}>
        <div className="text-[11px]" style={{ color: MUTED_2 }}>
          Live macro inputs — sourced from SBP, PSX, ADB · refreshed 2h ago
        </div>
        <div
          className="mt-2 flex gap-2 overflow-x-auto pb-1"
          style={{ scrollbarWidth: "none", maskImage: "linear-gradient(to right, #000 92%, transparent)" }}
        >
          {[
            { src: "KSE-100", val: "113,420", delta: "↑ 0.42%", tone: "good" },
            { src: "KIBOR", val: "18.5%", delta: "→ flat", tone: "flat" },
            { src: "CPI (YoY)", val: "11.2%", delta: "↓ from 13.8%", tone: "good" },
            { src: "PKR/USD", val: "287.4", delta: "↓ 0.2%", tone: "good" },
            { src: "SBP Policy Rate", val: "20.0%", delta: "→ no change", tone: "flat" },
            { src: "Cement Dispatches", val: "3.84MT", delta: "↑ 6.2% MoM", tone: "good" },
          ].map((t) => (
            <div
              key={t.src}
              className="inline-flex min-w-[180px] items-center justify-between gap-3 rounded-lg border bg-white px-3.5 py-2"
              style={{ borderColor: BORDER }}
            >
              <div>
                <div className="text-[10px]" style={{ color: MUTED_2 }}>
                  {t.src}
                </div>
                <div className="text-[14px] font-semibold tnum" style={{ color: TEXT }}>
                  {t.val}
                </div>
              </div>
              <span
                className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
                style={
                  t.tone === "good"
                    ? { background: GREEN_SOFT, color: "#15803D" }
                    : { background: "#F3F4F6", color: "#4B5563" }
                }
              >
                {t.delta}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ───── Section 6 — Models tracker ───── */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-[14px] font-semibold" style={{ color: TEXT }}>
          All active models
        </h2>
        <button
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold"
          style={{ color: GREEN }}
        >
          <Plus className="h-3.5 w-3.5" /> New model
        </button>
      </div>
      <table className="mt-3 w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
            {["Model", "Sector", "Period", "Analyst", "Data Confidence", "Status", "Last updated", ""].map((h) => (
              <th key={h} className="border-b px-3 py-2.5" style={{ borderColor: BORDER }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            { m: "Lucky Cement", s: "Cement", p: "FY2025", a: "Ayesha S.", c: 94.2, st: "Awaiting approval", u: "2h ago", tone: "amber" },
            { m: "MCB Bank", s: "Banking", p: "FY2025", a: "Omar R.", c: 97.1, st: "Approved", u: "1d ago", tone: "green" },
            { m: "Engro Fertilizers", s: "Energy", p: "FY2025", a: "Sara K.", c: 88.4, st: "Needs attention", u: "3d ago", tone: "red" },
            { m: "DG Khan Cement", s: "Cement", p: "Q3 FY2025", a: "Ayesha S.", c: 91.8, st: "In review", u: "5h ago", tone: "blue" },
          ].map((r) => (
            <tr
              key={r.m}
              className="cursor-pointer border-b transition-colors hover:bg-[#FAFAFA]"
              style={{ borderColor: BORDER }}
            >
              <td
                className="px-3 py-3 font-medium"
                style={{
                  color: TEXT,
                  borderLeft: r.tone === "red" ? `3px solid ${RED}` : "3px solid transparent",
                }}
              >
                {r.m}
              </td>
              <td className="px-3 py-3" style={{ color: MUTED }}>
                {r.s}
              </td>
              <td className="px-3 py-3" style={{ color: MUTED }}>
                {r.p}
              </td>
              <td className="px-3 py-3" style={{ color: MUTED }}>
                {r.a}
              </td>
              <td className="px-3 py-3 tnum" style={{ color: TEXT }}>
                {r.c}%
              </td>
              <td className="px-3 py-3">
                <StatusBadge tone={r.tone as any}>{r.st}</StatusBadge>
              </td>
              <td className="px-3 py-3" style={{ color: MUTED }}>
                {r.u}
              </td>
              <td className="px-3 py-3 text-right" style={{ color: GREEN }}>
                →
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PageShell>
  );
}

// ─────────────────────── Sub-components ───────────────────────

function SelectBar({ value, onChange, options, width = 160 }: { value: string; onChange: (v: string) => void; options: string[]; width?: number }) {
  return (
    <div className="relative" style={{ width }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-[34px] w-full appearance-none rounded-lg border bg-white pl-3 pr-8 text-[13px] font-medium"
        style={{ borderColor: "#D1D5DB", color: "#111827" }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: MUTED_2 }} />
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  badge,
  comparison,
  spark,
  gauge,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  badge: { text: string; tone: "good" | "bad" | "flat" };
  comparison: string;
  spark?: "up" | "down" | "flat";
  gauge?: number;
}) {
  const badgeStyle =
    badge.tone === "good"
      ? { bg: GREEN_SOFT, fg: "#15803D" }
      : badge.tone === "bad"
        ? { bg: "#FEE2E2", fg: "#B91C1C" }
        : { bg: "#F3F4F6", fg: "#4B5563" };
  return (
    <div className="rounded-[10px] border bg-white px-5 py-4" style={{ borderColor: BORDER }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span style={{ color: MUTED_2 }}>{icon}</span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: MUTED }}>
            {label}
          </span>
        </div>
        <span
          className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
          style={{ background: badgeStyle.bg, color: badgeStyle.fg }}
        >
          {badge.text}
        </span>
      </div>
      <div className="mt-2 text-[26px] font-bold leading-none tnum" style={{ color: TEXT }}>
        {value}
      </div>
      <div className="mt-2 text-[12px]" style={{ color: MUTED }}>
        {comparison}
      </div>
      {spark && (
        <div className="mt-2">
          <Sparkline direction={spark} />
        </div>
      )}
      {gauge !== undefined && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ background: BORDER }}>
          <div className="h-full rounded-full" style={{ width: `${gauge * 100}%`, background: GREEN_MID }} />
        </div>
      )}
    </div>
  );
}

function Sparkline({ direction }: { direction: "up" | "down" | "flat" }) {
  const points = direction === "up"
    ? [18, 16, 17, 13, 14, 10, 11, 6, 4]
    : direction === "down"
      ? [6, 8, 10, 9, 12, 14, 13, 16, 18]
      : [12, 11, 13, 12, 12, 13, 11, 12, 12];
  const color = direction === "down" ? RED : GREEN_MID;
  const path = points.map((y, i) => `${i === 0 ? "M" : "L"} ${i * 12} ${y}`).join(" ");
  return (
    <svg width="100%" height="32" viewBox="0 0 96 22" preserveAspectRatio="none">
      <path d={path} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RevenueChart() {
  const data = [
    { q: "Q1 FY24", a: 11.2, b: 11.8, f: false },
    { q: "Q2 FY24", a: 12.0, b: 11.9, f: false },
    { q: "Q3 FY24", a: 12.8, b: 12.5, f: false },
    { q: "Q4 FY24", a: 12.7, b: 12.6, f: false },
    { q: "Q1 FY25", a: 13.1, b: 12.9, f: false },
    { q: "Q2 FY25", a: 13.6, b: 13.1, f: false },
    { q: "Q1 FY26F", a: 0, b: 13.4, f: true, fc: 14.2 },
    { q: "Q2 FY26F", a: 0, b: 13.8, f: true, fc: 14.8 },
  ];
  const max = 16;
  const h = 200;
  return (
    <div className="relative" style={{ height: h + 24 }}>
      {/* reference lines */}
      {[0.33, 0.66, 1].map((r) => (
        <div key={r} className="absolute left-0 right-0" style={{ bottom: 24 + r * h * 0.9, borderTop: `1px dashed #F3F4F6` }} />
      ))}
      <div className="absolute inset-x-0 bottom-0 flex h-full items-end justify-around px-1">
        {data.map((d) => (
          <div key={d.q} className="flex flex-1 flex-col items-center">
            <div className="flex h-full items-end gap-0.5">
              {!d.f ? (
                <>
                  <div className="w-3 rounded-t-sm" style={{ height: `${(d.a / max) * h}px`, background: GREEN }} />
                  <div className="w-3 rounded-t-sm" style={{ height: `${(d.b / max) * h}px`, background: GREEN_SOFT }} />
                </>
              ) : (
                <>
                  <div
                    className="w-3 rounded-t-sm"
                    style={{ height: `${((d.fc ?? 0) / max) * h}px`, border: `1.5px dashed ${GREEN_MID}`, background: "transparent" }}
                  />
                  <div className="w-3 rounded-t-sm" style={{ height: `${(d.b / max) * h}px`, background: GREEN_SOFT, opacity: 0.6 }} />
                </>
              )}
            </div>
            <div className="mt-1.5 text-[10px]" style={{ color: MUTED_2 }}>
              {d.q}
            </div>
          </div>
        ))}
      </div>
      {/* legend */}
      <div className="absolute right-0 top-0 flex items-center gap-3 text-[11px]" style={{ color: MUTED }}>
        <LegendDot color={GREEN} label="Actual" />
        <LegendDot color={GREEN_SOFT} label="Budget" />
        <LegendDot color={GREEN_MID} label="Forecast" dashed />
      </div>
    </div>
  );
}

function LegendDot({ color, label, dashed = false }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block h-2.5 w-2.5 rounded-sm"
        style={dashed ? { border: `1.5px dashed ${color}` } : { background: color }}
      />
      {label}
    </span>
  );
}

function Waterfall() {
  // values relative; positive in green, negative red, anchors in dark green
  const steps = [
    { label: "Budget", val: 52.0, type: "anchor", display: "PKR 52.0B" },
    { label: "Volume", val: 3.2, type: "pos", display: "+3.2B" },
    { label: "Price", val: 1.4, type: "pos", display: "+1.4B" },
    { label: "Cost overrun", val: -1.8, type: "neg", display: "−1.8B" },
    { label: "Actual", val: 54.8, type: "anchor", display: "PKR 54.8B" },
  ];
  const h = 100;
  const scaleMax = 56;
  let running = 0;
  return (
    <div className="relative" style={{ height: h + 40 }}>
      <div className="flex h-full items-end justify-around gap-2 px-2" style={{ height: h }}>
        {steps.map((s, i) => {
          let barTop = 0;
          let barH = 0;
          let color = GREEN;
          if (s.type === "anchor") {
            barH = (s.val / scaleMax) * h;
            barTop = h - barH;
            color = GREEN;
            running = s.val;
          } else if (s.type === "pos") {
            barH = (s.val / scaleMax) * h;
            const baseY = h - (running / scaleMax) * h;
            barTop = baseY - barH;
            color = GREEN_MID;
            running += s.val;
          } else {
            barH = (Math.abs(s.val) / scaleMax) * h;
            const baseY = h - (running / scaleMax) * h;
            barTop = baseY;
            color = RED;
            running += s.val;
          }
          return (
            <div key={i} className="relative flex flex-1 flex-col items-center">
              <div className="relative w-full" style={{ height: h }}>
                <div
                  className="absolute left-1/2 -translate-x-1/2 rounded-sm"
                  style={{ top: barTop, height: Math.max(barH, 4), width: 36, background: color }}
                />
                <div
                  className="absolute left-1/2 -translate-x-1/2 text-[11px] font-semibold tnum"
                  style={{ top: barTop - 16, color: TEXT, whiteSpace: "nowrap" }}
                >
                  {s.display}
                </div>
              </div>
              <div className="mt-1 text-[11px]" style={{ color: MUTED }}>
                {s.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ForecastChart({ scenario }: { scenario: "Base" | "Bull" | "Bear" }) {
  const years = ["FY25", "FY26", "FY27", "FY28", "FY29", "FY30"];
  const series = useMemo(
    () => ({
      Base: [54.8, 60.1, 65.4, 70.2, 74.3, 78.4],
      Bull: [54.8, 62.4, 70.8, 79.1, 87.0, 95.6],
      Bear: [54.8, 56.0, 57.8, 59.6, 61.0, 62.5],
    }),
    [],
  );
  const w = 360;
  const h = 180;
  const padL = 8;
  const padR = 8;
  const padT = 14;
  const padB = 24;
  const min = 50;
  const max = 100;
  const xy = (vals: number[]) =>
    vals.map((v, i) => [padL + (i * (w - padL - padR)) / (vals.length - 1), padT + (h - padT - padB) * (1 - (v - min) / (max - min))]);
  const path = (vals: number[]) => xy(vals).map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
  const baseXY = xy(series.Base);
  const bandTop = baseXY.map(([x, y]) => [x, y - 14]);
  const bandBot = baseXY.map(([x, y]) => [x, y + 14]);
  const bandPath = `M ${bandTop[0][0]} ${bandTop[0][1]} ` + bandTop.slice(1).map(([x, y]) => `L ${x} ${y}`).join(" ") + " " + bandBot.reverse().map(([x, y]) => `L ${x} ${y}`).join(" ") + " Z";
  const active = scenario;
  const lineFor = (s: "Base" | "Bull" | "Bear") => {
    const color = s === "Base" ? GREEN : s === "Bull" ? GREEN_MID : RED;
    const isActive = s === active;
    return (
      <path
        key={s}
        d={path(series[s])}
        fill="none"
        stroke={color}
        strokeWidth={isActive ? 2.2 : 1.4}
        strokeOpacity={isActive ? 1 : 0.35}
        strokeDasharray={s === "Base" ? "0" : "4 4"}
      />
    );
  };
  const lastPt = xy(series[active])[5];
  const lastVal = series[active][5];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      <path d={bandPath} fill="#F0FDF4" opacity={0.7} />
      {lineFor("Bear")}
      {lineFor("Bull")}
      {lineFor("Base")}
      <circle cx={lastPt[0]} cy={lastPt[1]} r={4} fill={GREEN} />
      <text x={lastPt[0] - 6} y={lastPt[1] - 8} textAnchor="end" fontSize={11} fill={TEXT} fontWeight={600}>
        PKR {lastVal.toFixed(1)}B ({active})
      </text>
      {years.map((y, i) => (
        <text key={y} x={padL + (i * (w - padL - padR)) / 5} y={h - 6} fontSize={10} fill={MUTED_2} textAnchor="middle">
          {y}
        </text>
      ))}
    </svg>
  );
}

function SummaryStat({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div>
      <div className="text-[12px]" style={{ color: MUTED }}>
        {label}
      </div>
      <div className="text-[14px] font-bold tnum" style={{ color: valueColor ?? TEXT }}>
        {value}
      </div>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: MUTED }}>
      {children}
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 24;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <svg width={56} height={56}>
      <circle cx={28} cy={28} r={r} stroke={BORDER} strokeWidth={5} fill="none" />
      <circle
        cx={28}
        cy={28}
        r={r}
        stroke={GREEN}
        strokeWidth={5}
        fill="none"
        strokeDasharray={`${dash} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 28 28)"
      />
      <text x={28} y={32} textAnchor="middle" fontSize={11} fontWeight={700} fill={TEXT}>
        {pct.toFixed(1)}%
      </text>
    </svg>
  );
}

function QueueRow({ to, label, status, tone }: { to: string; label: string; status: string; tone: "amber" | "green" }) {
  const colors = tone === "amber" ? { bg: "#FEF3C7", fg: "#B45309" } : { bg: GREEN_SOFT, fg: "#15803D" };
  return (
    <Link to={to} className="flex items-center justify-between text-[12px]">
      <span style={{ color: TEXT }}>{label}</span>
      <span className="rounded-md px-2 py-0.5 text-[11px] font-semibold" style={{ background: colors.bg, color: colors.fg }}>
        {status} →
      </span>
    </Link>
  );
}

function StatusBadge({ tone, children }: { tone: "amber" | "green" | "red" | "blue"; children: React.ReactNode }) {
  const map = {
    amber: { bg: "#FEF3C7", fg: "#B45309" },
    green: { bg: GREEN_SOFT, fg: "#15803D" },
    red: { bg: "#FEE2E2", fg: "#B91C1C" },
    blue: { bg: "#DBEAFE", fg: "#1D4ED8" },
  } as const;
  const c = map[tone];
  return (
    <span className="rounded-md px-2 py-0.5 text-[11px] font-semibold" style={{ background: c.bg, color: c.fg }}>
      {children}
    </span>
  );
}
