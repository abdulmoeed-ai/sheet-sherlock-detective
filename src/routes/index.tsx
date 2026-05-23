import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { cycleStore } from "@/lib/cycle-store";

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
  X,
  Settings2,
  Landmark,
  Flame,
  Leaf,
  Shirt,
  Laptop,
  Pill,
  ShoppingCart,
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

// ────────── Sector catalogue ──────────
type SectorMeta = {
  name: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  companies: { name: string; ticker: string }[];
  total: number;
};

const SECTORS: SectorMeta[] = [
  {
    name: "Engineering & Industrials",
    icon: Settings2,
    total: 12,
    companies: [
      { name: "Millat Tractors Limited", ticker: "MTL" },
      { name: "Al-Ghazi Tractors", ticker: "AGTL" },
      { name: "Bolan Castings Limited", ticker: "BCL" },
      { name: "Atlas Honda Limited", ticker: "ATLH" },
      { name: "Indus Motor Company", ticker: "INDU" },
      { name: "Pak Suzuki Motor", ticker: "PSMC" },
      { name: "Millat Equipment Limited", ticker: "—" },
      { name: "Dewan Motors", ticker: "DWKC" },
    ],
  },
  {
    name: "Banking & Finance",
    icon: Landmark,
    total: 18,
    companies: [
      { name: "MCB Bank", ticker: "MCB" },
      { name: "HBL", ticker: "HBL" },
      { name: "UBL", ticker: "UBL" },
      { name: "Meezan Bank", ticker: "MEBL" },
    ],
  },
  {
    name: "Oil & Gas",
    icon: Flame,
    total: 9,
    companies: [
      { name: "OGDC", ticker: "OGDC" },
      { name: "PPL", ticker: "PPL" },
      { name: "MARI", ticker: "MARI" },
      { name: "PSO", ticker: "PSO" },
    ],
  },
  {
    name: "Fertilizers",
    icon: Leaf,
    total: 6,
    companies: [
      { name: "Engro Fertilizers", ticker: "EFERT" },
      { name: "FFC", ticker: "FFC" },
      { name: "Fatima Fertilizer", ticker: "FATIMA" },
    ],
  },
  {
    name: "Textiles",
    icon: Shirt,
    total: 24,
    companies: [
      { name: "Nishat Mills", ticker: "NML" },
      { name: "Interloop", ticker: "ILP" },
      { name: "Gul Ahmed", ticker: "GATM" },
    ],
  },
  {
    name: "IT & Software",
    icon: Laptop,
    total: 14,
    companies: [
      { name: "Systems Limited", ticker: "SYS" },
      { name: "NetSol Tech", ticker: "NETSOL" },
      { name: "Avanceon", ticker: "AVN" },
    ],
  },
  {
    name: "Pharmaceuticals",
    icon: Pill,
    total: 11,
    companies: [
      { name: "GlaxoSmithKline", ticker: "GLAXO" },
      { name: "Searle", ticker: "SEARL" },
      { name: "Highnoon Labs", ticker: "HINOON" },
      { name: "Ferozsons", ticker: "FEROZ" },
    ],
  },
  {
    name: "Food & FMCG",
    icon: ShoppingCart,
    total: 16,
    companies: [
      { name: "Nestle Pakistan", ticker: "NESTLE" },
      { name: "Unilever", ticker: "UPFL" },
      { name: "National Foods", ticker: "NATF" },
    ],
  },
];

// ────────── Tokens (preserved) ──────────
const BRAND = "#7B68EE";
const BRAND_HOVER = "#6951E0";
const BRAND_SOFT = "#EDE9FE";
const ACCENT = "#49CCF9";
const SUCCESS = "#22C55E";
const SUCCESS_BG = "#ECFDF3";
const RED = "#FF5765";
const AMBER = "#FFB02E";
const AMBER_SOFT = "#FFF8EC";
const BORDER = "#E3E6EA";
const SUBTLE = "#F7F8FA";
const TEXT = "#292D34";
const MUTED = "#4F546B";
const MUTED_2 = "#818EA0";

const GREEN = BRAND;
const GREEN_MID = ACCENT;
const GREEN_SOFT = BRAND_SOFT;

// ────────── Selection store (localStorage-backed) ──────────
type Selection = { sector: string; company: string; ticker: string; period: string };
const LS_KEY = "ss_last_view";
const LS_RECENT = "ss_recent_views";

function readSelection(): Selection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Selection) : null;
  } catch {
    return null;
  }
}
function writeSelection(sel: Selection) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_KEY, JSON.stringify(sel));
}
function readRecents(): Selection[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(LS_RECENT) ?? "[]");
  } catch {
    return [];
  }
}
function pushRecent(sel: Selection) {
  const existing = readRecents().filter((r) => r.ticker !== sel.ticker);
  const next = [sel, ...existing].slice(0, 4);
  window.localStorage.setItem(LS_RECENT, JSON.stringify(next));
}

const PERIODS = ["FY2025", "FY2024", "FY2023", "Q3 FY2025", "Q2 FY2025"];

function Dashboard() {
  const navigate = useNavigate();
  // Initial state: null = State 1 ghost+panel; otherwise State 2/3
  const [selection, setSelection] = useState<Selection | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [returning, setReturning] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelStep, setPanelStep] = useState<"sector" | "company">("sector");
  const [pendingSector, setPendingSector] = useState<string | null>(null);
  const [skeletonFlash, setSkeletonFlash] = useState(false);
  const [recents, setRecents] = useState<Selection[]>([]);
  const [chartTab, setChartTab] = useState<"Monthly" | "Quarterly" | "Annual">("Quarterly");
  const [scenario, setScenario] = useState<"Base" | "Bull" | "Bear">("Base");
  const [periodOpen, setPeriodOpen] = useState(false);

  // Hydrate from localStorage
  useEffect(() => {
    const sel = readSelection();
    setRecents(readRecents());
    if (sel) {
      setSelection(sel);
      setReturning(true);
      setSkeletonFlash(true);
      const t = setTimeout(() => setSkeletonFlash(false), 300);
      setHydrated(true);
      return () => clearTimeout(t);
    } else {
      setPanelOpen(true);
      setHydrated(true);
    }
  }, []);

  const ghost = hydrated && !selection;

  const applySelection = (sel: Selection) => {
    setSelection(sel);
    writeSelection(sel);
    pushRecent(sel);
    setRecents(readRecents());
    setPanelOpen(false);
    setPendingSector(null);
    setSkeletonFlash(true);
    setTimeout(() => setSkeletonFlash(false), 350);
    // Sync cycle store too
    try {
      cycleStore.startCycle({ sector: sel.sector, company: sel.company, period: sel.period });
      cycleStore.setStatus("idle");
    } catch {}
  };

  const clearCompany = () => {
    if (!selection) return;
    const sectorName = selection.sector;
    setSelection(null);
    window.localStorage.removeItem(LS_KEY);
    setPendingSector(sectorName);
    setPanelStep("company");
    setPanelOpen(true);
  };
  const clearSector = () => {
    setSelection(null);
    window.localStorage.removeItem(LS_KEY);
    setPendingSector(null);
    setPanelStep("sector");
    setPanelOpen(true);
  };

  // For display when selection is null we still want to render the dashboard shell — use placeholder
  const displaySelection: Selection =
    selection ?? { sector: "Engineering & Industrials", company: "Millat Tractors Limited", ticker: "MTL", period: "FY2025" };

  const title = ghost ? "Select a company to begin" : `${displaySelection.company} · ${displaySelection.period}`;
  const subtitle = ghost
    ? "Choose a sector and company — Sheet Sherlock will load the full intelligence model."
    : "Financial intelligence overview · live model";

  return (
    <PageShell title={title} subtitle={subtitle} hideProgress>
      {/* ───── Context bar (State 2/3) ───── */}
      {!ghost && (
        <div
          className="sticky top-14 z-10 -mx-8 -mt-1 mb-5 flex h-11 items-center justify-between border-b px-8"
          style={{ background: "#FFFFFF", borderColor: BORDER }}
        >
          <div className="flex items-center gap-1.5">
            <Chip
              label={displaySelection.sector}
              onClear={clearSector}
              onClick={() => {
                setPanelStep("sector");
                setPanelOpen(true);
              }}
            />
            <Chip
              label={`${shortCompany(displaySelection.company)} (${displaySelection.ticker})`}
              onClear={clearCompany}
              onClick={() => {
                setPendingSector(displaySelection.sector);
                setPanelStep("company");
                setPanelOpen(true);
              }}
            />
            <div className="relative">
              <Chip
                label={displaySelection.period}
                onClear={() => applySelection({ ...displaySelection, period: "FY2025" })}
                onClick={() => setPeriodOpen((v) => !v)}
              />
              {periodOpen && (
                <div
                  className="absolute left-0 top-9 z-30 w-44 rounded-lg border bg-white py-1 shadow-lg"
                  style={{ borderColor: BORDER }}
                  onMouseLeave={() => setPeriodOpen(false)}
                >
                  {PERIODS.map((p) => (
                    <button
                      key={p}
                      className="block h-[34px] w-full px-3 text-left text-[13px] hover:bg-[#F7F8FA]"
                      style={{ color: TEXT }}
                      onClick={() => {
                        applySelection({ ...displaySelection, period: p });
                        setPeriodOpen(false);
                      }}
                    >
                      {p}
                      {p === "FY2025" && <span className="ml-1 text-[11px]" style={{ color: MUTED_2 }}>(current)</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {returning && recents.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px]" style={{ color: MUTED_2 }}>Recent:</span>
                {recents.slice(0, 4).map((r) => {
                  const active = r.ticker === displaySelection.ticker;
                  return (
                    <button
                      key={r.ticker + r.period}
                      onClick={() => applySelection(r)}
                      className="h-[22px] rounded-full border px-2 text-[11px] font-medium transition-colors"
                      style={{
                        background: active ? BRAND_SOFT : SUBTLE,
                        color: active ? BRAND : MUTED,
                        borderColor: active ? BRAND : BORDER,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {shortCompany(r.company)} · {r.period}
                    </button>
                  );
                })}
              </div>
            )}
            <span className="text-[11px]" style={{ color: MUTED_2 }}>
              Data as of Jun 30, 2025 · {displaySelection.ticker} Annual Report
            </span>
          </div>
        </div>
      )}

      {/* ───── Ghost shell / Dashboard body ───── */}
      <div className="relative">
        {ghost ? (
          <GhostDashboard />
        ) : (
          <DashboardBody
            skeletonFlash={skeletonFlash}
            sel={displaySelection}
            chartTab={chartTab}
            setChartTab={setChartTab}
            scenario={scenario}
            setScenario={setScenario}
            onNewCycle={() => {
              cycleStore.startCycle({ sector: displaySelection.sector, company: displaySelection.company, period: displaySelection.period });
              navigate({ to: "/ingestion" });
            }}
          />
        )}

        {/* Selection panel overlay */}
        {panelOpen && (
          <SelectionPanel
            initialStep={panelStep}
            initialSector={pendingSector}
            onClose={() => {
              if (selection) setPanelOpen(false);
            }}
            onSelect={(sec, co) =>
              applySelection({ sector: sec.name, company: co.name, ticker: co.ticker, period: "FY2025" })
            }
          />
        )}
      </div>
    </PageShell>
  );
}

function shortCompany(name: string): string {
  return name.replace(/ Limited$/, "").replace(/ Pakistan$/, "");
}

// ────────── Context-bar chip ──────────
function Chip({ label, onClear, onClick }: { label: string; onClear?: () => void; onClick?: () => void }) {
  return (
    <span
      className="inline-flex h-7 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[12px] font-medium transition-colors"
      style={{ background: "#FFFFFF", borderColor: BORDER, color: TEXT }}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "#F5F3FF";
        e.currentTarget.style.borderColor = BRAND;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "#FFFFFF";
        e.currentTarget.style.borderColor = BORDER;
      }}
    >
      {label}
      {onClear && (
        <button
          aria-label="Clear"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="rounded-full p-0.5 hover:bg-[#EDE9FE]"
        >
          <X className="h-2.5 w-2.5" style={{ color: MUTED_2 }} />
        </button>
      )}
    </span>
  );
}

// ────────── Selection panel (State 1 overlay) ──────────
function SelectionPanel({
  initialStep,
  initialSector,
  onClose,
  onSelect,
}: {
  initialStep: "sector" | "company";
  initialSector: string | null;
  onClose: () => void;
  onSelect: (sec: SectorMeta, co: { name: string; ticker: string }) => void;
}) {
  const [selectedSectorName, setSelectedSectorName] = useState<string | null>(
    initialStep === "company" ? initialSector : null,
  );
  const selectedSector = useMemo(
    () => SECTORS.find((s) => s.name === selectedSectorName) ?? null,
    [selectedSectorName],
  );
  const ref = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);

  return (
    <div
      className="absolute inset-0 z-20 flex items-start justify-center pt-20"
      onClick={onClose}
    >
      <div
        ref={ref}
        onClick={(e) => e.stopPropagation()}
        className="w-[680px] max-w-[92vw] transition-all"
        style={{
          background: "rgba(255,255,255,0.97)",
          backdropFilter: "blur(6px)",
          border: `1px solid ${BORDER}`,
          borderRadius: 16,
          padding: "28px 32px 24px",
          boxShadow: "0 8px 32px rgba(25,31,46,0.12)",
          opacity: closing ? 0 : 1,
          transform: closing ? "scale(0.97)" : "scale(1)",
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[17px] font-bold" style={{ color: TEXT }}>
              Select a sector to get started
            </div>
            <div className="mt-1 text-[13px]" style={{ color: MUTED_2 }}>
              Sheet Sherlock will load all financial intelligence for the company you choose.
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-2.5">
          {SECTORS.map((s) => {
            const Icon = s.icon;
            const isSel = selectedSectorName === s.name;
            return (
              <button
                key={s.name}
                onClick={() => setSelectedSectorName(s.name)}
                className="flex h-[82px] flex-col items-center justify-center gap-1.5 rounded-[10px] px-2 transition-all"
                style={{
                  background: isSel ? BRAND_SOFT : "#FFFFFF",
                  border: `1.5px solid ${isSel ? BRAND : BORDER}`,
                  cursor: "pointer",
                  boxShadow: isSel ? "0 2px 8px rgba(123,104,238,0.14)" : "none",
                }}
                onMouseEnter={(e) => {
                  if (isSel) return;
                  e.currentTarget.style.background = "#F5F3FF";
                  e.currentTarget.style.borderColor = BRAND;
                }}
                onMouseLeave={(e) => {
                  if (isSel) return;
                  e.currentTarget.style.background = "#FFFFFF";
                  e.currentTarget.style.borderColor = BORDER;
                }}
              >
                <Icon className="h-6 w-6" style={{ color: isSel ? BRAND : MUTED }} />
                <span
                  className="text-center text-[12px] font-semibold leading-tight"
                  style={{ color: isSel ? BRAND : TEXT }}
                >
                  {s.name}
                </span>
                <span className="text-[10px]" style={{ color: MUTED_2 }}>
                  {s.total} companies
                </span>
              </button>
            );
          })}
        </div>

        <div
          className="overflow-hidden transition-all"
          style={{
            maxHeight: selectedSector ? 320 : 0,
            opacity: selectedSector ? 1 : 0,
            marginTop: selectedSector ? 16 : 0,
            borderTop: selectedSector ? `1px solid #F3F4F6` : "none",
            paddingTop: selectedSector ? 16 : 0,
          }}
        >
          {selectedSector && (
            <>
              <div
                className="mb-2.5 text-[11px] font-semibold uppercase"
                style={{ color: MUTED_2, letterSpacing: "0.06em" }}
              >
                Companies in {selectedSector.name}
              </div>
              <div
                className="grid grid-cols-2 gap-1.5 overflow-y-auto pr-1"
                style={{ maxHeight: 200, scrollbarWidth: "thin", scrollbarColor: `${BORDER} transparent` }}
              >
                {selectedSector.companies.map((co) => (
                  <button
                    key={co.name}
                    onClick={() => {
                      setClosing(true);
                      setTimeout(() => onSelect(selectedSector, co), 180);
                    }}
                    className="flex h-10 items-center justify-between rounded-lg border bg-white px-3 transition-all"
                    style={{ borderColor: BORDER, cursor: "pointer" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = BRAND;
                      e.currentTarget.style.background = "#F5F3FF";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = BORDER;
                      e.currentTarget.style.background = "#FFFFFF";
                    }}
                  >
                    <span className="truncate text-[13px] font-medium" style={{ color: TEXT }}>
                      {co.name}
                    </span>
                    <span
                      className="rounded px-1.5 py-0.5 text-[11px] font-semibold"
                      style={{ background: BRAND_SOFT, color: BRAND }}
                    >
                      {co.ticker}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────── Ghost dashboard (State 1) ──────────
function GhostDashboard() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBox key={i} className="h-[124px] rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-[3fr_2fr] gap-5">
        <div className="space-y-5">
          <SkeletonBox className="h-[280px] rounded-xl" />
          <SkeletonBox className="h-[200px] rounded-xl" />
        </div>
        <SkeletonBox className="h-[500px] rounded-xl" />
      </div>
      <SkeletonBox className="h-[90px] rounded-xl" />
      <SkeletonBox className="h-[160px] rounded-xl" />
    </div>
  );
}

function SkeletonBox({ className = "" }: { className?: string }) {
  return (
    <div
      className={`${className} animate-ss-pulse`}
      style={{ background: BRAND_SOFT }}
    />
  );
}

// ────────── Real dashboard body ──────────
function DashboardBody({
  skeletonFlash,
  sel,
  chartTab,
  setChartTab,
  scenario,
  setScenario,
  onNewCycle,
}: {
  skeletonFlash: boolean;
  sel: Selection;
  chartTab: "Monthly" | "Quarterly" | "Annual";
  setChartTab: (v: "Monthly" | "Quarterly" | "Annual") => void;
  scenario: "Base" | "Bull" | "Bear";
  setScenario: (v: "Base" | "Bull" | "Bear") => void;
  onNewCycle: () => void;
}) {
  if (skeletonFlash) return <GhostDashboard />;

  const pendingHardBlocked = 1;
  const pendingDiagnosis = 1;
  const showAlert = pendingHardBlocked + pendingDiagnosis > 0;

  return (
    <div className="animate-ss-fade-in">
      <div className="mb-4 flex items-center justify-end">
        <button
          onClick={onNewCycle}
          className="inline-flex h-9 items-center gap-2 rounded-lg px-4 text-[13px] font-semibold text-white shadow-sm transition-colors"
          style={{ background: BRAND }}
          onMouseEnter={(e) => (e.currentTarget.style.background = BRAND_HOVER)}
          onMouseLeave={(e) => (e.currentTarget.style.background = BRAND)}
        >
          <Sparkles className="h-3.5 w-3.5" /> New ingestion cycle
        </button>
      </div>

      {showAlert && (
        <div
          className="-mx-8 mb-5 flex h-11 items-center justify-between px-8"
          style={{ background: AMBER_SOFT, borderLeft: `4px solid ${AMBER}` }}
        >
          <div className="flex items-center gap-2.5 text-[13px]" style={{ color: "#92560B" }}>
            <AlertTriangle className="h-4 w-4" style={{ color: "#92560B" }} />
            <span>
              <span className="font-semibold">{pendingHardBlocked + pendingDiagnosis} items require your attention</span> before this cycle can proceed —{" "}
              {pendingHardBlocked} hard-blocked diff in Sheet BS!F18, {pendingDiagnosis} pending BS diagnosis.
            </span>
          </div>
          <Link to="/diff-review" className="text-[13px] font-semibold" style={{ color: "#92560B" }}>
            Review now →
          </Link>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Revenue (FY2025)" value="PKR 54.8B" badge={{ text: "↑ 12.4%", tone: "good" }} comparison="vs PKR 48.7B FY2024" spark="up" />
        <KpiCard icon={<PieChart className="h-4 w-4" />} label="Tractors sold (units)" value="42,180" badge={{ text: "↑ 9.8%", tone: "good" }} comparison="vs 38,420 FY2024" spark="up" />
        <KpiCard icon={<DollarSign className="h-4 w-4" />} label="Plant utilisation rate" value="86.4%" badge={{ text: "↑ 4.2 pts", tone: "good" }} comparison="vs 82.2% FY2024" spark="up" />
        <KpiCard icon={<Droplet className="h-4 w-4" />} label="Operating CF" value="PKR 8.2B" badge={{ text: "↑ 8.7%", tone: "good" }} comparison="vs PKR 7.5B FY2024" spark="up" />
        <KpiCard icon={<Scale className="h-4 w-4" />} label="Net Debt / EBITDA" value="2.1x" badge={{ text: "↓ 0.4x", tone: "good" }} comparison="vs 2.5x FY2024" gauge={0.42} />
        <KpiCard icon={<Banknote className="h-4 w-4" />} label="IFS services revenue" value="PKR 2.1B" badge={{ text: "↑ 15.2%", tone: "good" }} comparison="vs PKR 1.8B FY2024" spark="up" />
      </div>

      {/* Main */}
      <div className="mt-5 grid grid-cols-[3fr_2fr] gap-5">
        <div className="space-y-5">
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
            <div className="mt-3 flex items-center gap-8 border-t pt-3" style={{ borderColor: "#F4F3FA" }}>
              <SummaryStat label="Actual" value="PKR 54.8B" />
              <SummaryStat label="Budget" value="PKR 52.0B" />
              <SummaryStat label="Variance" value="+PKR 2.8B (+5.4%)" valueColor="#15803D" />
            </div>
          </div>

          <div className="rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: MUTED }}>
              What drove the FY2025 variance?
            </div>
            <div className="mt-6 pt-4">
              <Waterfall />
            </div>
            <p className="mt-3 text-[12px] italic" style={{ color: MUTED }}>
              Tractor volume and price together offset a PKR 1.8B cost overrun — components consumed up 14% YoY.
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}>
          <div>
            <h3 className="text-[14px] font-semibold" style={{ color: TEXT }}>
              {sel.sector} — 5-Year Outlook
            </h3>
            <div className="mt-1 text-[11px]" style={{ color: MUTED_2 }}>
              {sel.company} · PSX data + ADB macro · Generated May 19, 2026
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
                style={{ background: "#ECFDF3", color: "#15803D" }}
              >
                {k}: {v}
              </span>
            ))}
          </div>
          <Link to="/assumptions" className="mt-2 inline-block text-[12px] font-medium" style={{ color: GREEN }}>
            See full assumptions →
          </Link>

          <div className="my-4 h-px" style={{ background: "#F4F3FA" }} />

          <div className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: MUTED }}>
            Key model risks
          </div>
          <ul className="mt-2 space-y-1.5 text-[12px]" style={{ color: "#4B5563" }}>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full" style={{ background: AMBER }} />
              Tractor unit sensitivity: ±1K units = ±PKR 0.9B
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full" style={{ background: AMBER }} />
              KIBOR at 22%+ compresses margin by ~180bps
            </li>
          </ul>
        </div>
      </div>

      {/* Approval status */}
      <div className="mt-5 rounded-xl border bg-white px-6 py-4" style={{ borderColor: BORDER }}>
        <div className="grid grid-cols-4 divide-x" style={{ borderColor: "#F4F3FA" }}>
          <div className="pr-6">
            <Eyebrow>Active cycle</Eyebrow>
            <div className="mt-1.5 text-[15px] font-semibold" style={{ color: TEXT }}>
              {sel.period} · {sel.company}
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

      {/* Macro */}
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
            { src: "Tractor unit sales", val: "4,210", delta: "↑ 7.1% MoM", tone: "good" },
          ].map((t) => (
            <div
              key={t.src}
              className="inline-flex min-w-[180px] items-center justify-between gap-3 rounded-lg border bg-white px-3.5 py-2"
              style={{ borderColor: BORDER }}
            >
              <div>
                <div className="text-[10px]" style={{ color: MUTED_2 }}>{t.src}</div>
                <div className="text-[14px] font-semibold tnum" style={{ color: TEXT }}>{t.val}</div>
              </div>
              <span
                className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
                style={
                  t.tone === "good"
                    ? { background: "#ECFDF3", color: "#15803D" }
                    : { background: "#F4F3FA", color: "#4B5563" }
                }
              >
                {t.delta}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Models tracker */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-[14px] font-semibold" style={{ color: TEXT }}>All active models</h2>
        <button className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold" style={{ color: GREEN }}>
          <Plus className="h-3.5 w-3.5" /> New model
        </button>
      </div>
      <table className="mt-3 w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
            {["Model", "Sector", "Period", "Analyst", "Data Confidence", "Status", "Last updated", ""].map((h) => (
              <th key={h} className="border-b px-3 py-2.5" style={{ borderColor: BORDER }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            { m: "Millat Tractors Limited", s: "Engineering & Industrials", p: "FY2025", a: "Ayesha S.", c: 94.2, st: "Awaiting approval", u: "2h ago", tone: "amber" },
            { m: "Al-Ghazi Tractors", s: "Engineering & Industrials", p: "FY2025", a: "Sara K.", c: 92.5, st: "Approved", u: "1d ago", tone: "green" },
            { m: "Atlas Honda Limited", s: "Engineering & Industrials", p: "FY2025", a: "Omar R.", c: 88.4, st: "Needs attention", u: "3d ago", tone: "red" },
            { m: "Bolan Castings Limited", s: "Engineering & Industrials", p: "Q3 FY2025", a: "Ayesha S.", c: 91.8, st: "In review", u: "5h ago", tone: "blue" },
          ].map((r) => (
            <tr key={r.m} className="cursor-pointer border-b transition-colors hover:bg-[#FAFAFD]" style={{ borderColor: BORDER }}>
              <td className="px-3 py-3 font-medium" style={{ color: TEXT, borderLeft: r.tone === "red" ? `3px solid ${RED}` : "3px solid transparent" }}>{r.m}</td>
              <td className="px-3 py-3" style={{ color: MUTED }}>{r.s}</td>
              <td className="px-3 py-3" style={{ color: MUTED }}>{r.p}</td>
              <td className="px-3 py-3" style={{ color: MUTED }}>{r.a}</td>
              <td className="px-3 py-3 tnum" style={{ color: TEXT }}>{r.c}%</td>
              <td className="px-3 py-3"><StatusBadge tone={r.tone as any}>{r.st}</StatusBadge></td>
              <td className="px-3 py-3" style={{ color: MUTED }}>{r.u}</td>
              <td className="px-3 py-3 text-right" style={{ color: GREEN }}>→</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ────────── Sub-components (unchanged from prior version) ──────────

function KpiCard({
  icon, label, value, badge, comparison, spark, gauge,
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
    badge.tone === "good" ? { bg: "#ECFDF3", fg: "#15803D" } :
    badge.tone === "bad" ? { bg: "#FFF0F2", fg: "#B42330" } :
    { bg: "#F4F3FA", fg: "#4B5563" };
  return (
    <div className="group rounded-xl border bg-white px-5 py-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_rgba(123,104,238,0.25)]" style={{ borderColor: BORDER }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md" style={{ background: BRAND_SOFT, color: BRAND }}>
            {icon}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: MUTED }}>{label}</span>
        </div>
        <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold tnum" style={{ background: badgeStyle.bg, color: badgeStyle.fg }}>{badge.text}</span>
      </div>
      <div className="mt-3 text-[26px] font-bold leading-none tnum" style={{ color: TEXT }}>{value}</div>
      <div className="mt-1.5 text-[12px]" style={{ color: MUTED }}>{comparison}</div>
      {spark && <div className="mt-2"><Sparkline direction={spark} /></div>}
      {gauge !== undefined && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ background: BRAND_SOFT }}>
          <div className="h-full rounded-full" style={{ width: `${gauge * 100}%`, background: BRAND }} />
        </div>
      )}
    </div>
  );
}

function Sparkline({ direction }: { direction: "up" | "down" | "flat" }) {
  const points = direction === "up" ? [18, 16, 17, 13, 14, 10, 11, 6, 4] : direction === "down" ? [6, 8, 10, 9, 12, 14, 13, 16, 18] : [12, 11, 13, 12, 12, 13, 11, 12, 12];
  const color = direction === "down" ? RED : direction === "flat" ? MUTED_2 : SUCCESS;
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
      {[0.33, 0.66, 1].map((r) => (
        <div key={r} className="absolute left-0 right-0" style={{ bottom: 24 + r * h * 0.9, borderTop: `1px dashed #F4F3FA` }} />
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
                  <div className="w-3 rounded-t-sm" style={{ height: `${((d.fc ?? 0) / max) * h}px`, border: `1.5px dashed ${GREEN_MID}`, background: "transparent" }} />
                  <div className="w-3 rounded-t-sm" style={{ height: `${(d.b / max) * h}px`, background: GREEN_SOFT, opacity: 0.6 }} />
                </>
              )}
            </div>
            <div className="mt-1.5 text-[10px]" style={{ color: MUTED_2 }}>{d.q}</div>
          </div>
        ))}
      </div>
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
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={dashed ? { border: `1.5px dashed ${color}` } : { background: color }} />
      {label}
    </span>
  );
}

function Waterfall() {
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
                <div className="absolute left-1/2 -translate-x-1/2 rounded-sm" style={{ top: barTop, height: Math.max(barH, 4), width: 36, background: color }} />
                <div className="absolute left-1/2 -translate-x-1/2 text-[11px] font-semibold tnum" style={{ top: barTop - 16, color: TEXT, whiteSpace: "nowrap" }}>{s.display}</div>
              </div>
              <div className="mt-1 text-[11px]" style={{ color: MUTED }}>{s.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ForecastChart({ scenario }: { scenario: "Base" | "Bull" | "Bear" }) {
  const years = ["FY25", "FY26", "FY27", "FY28", "FY29", "FY30"];
  const series = useMemo(() => ({
    Base: [54.8, 60.1, 65.4, 70.2, 74.3, 78.4],
    Bull: [54.8, 62.4, 70.8, 79.1, 87.0, 95.6],
    Bear: [54.8, 56.0, 57.8, 59.6, 61.0, 62.5],
  }), []);
  const w = 360, h = 180, padL = 8, padR = 8, padT = 14, padB = 24, min = 50, max = 100;
  const xy = (vals: number[]) => vals.map((v, i) => [padL + (i * (w - padL - padR)) / (vals.length - 1), padT + (h - padT - padB) * (1 - (v - min) / (max - min))]);
  const path = (vals: number[]) => xy(vals).map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
  const baseXY = xy(series.Base);
  const bandTop = baseXY.map(([x, y]) => [x, y - 14]);
  const bandBot = baseXY.map(([x, y]) => [x, y + 14]);
  const bandPath = `M ${bandTop[0][0]} ${bandTop[0][1]} ` + bandTop.slice(1).map(([x, y]) => `L ${x} ${y}`).join(" ") + " " + bandBot.reverse().map(([x, y]) => `L ${x} ${y}`).join(" ") + " Z";
  const active = scenario;
  const lineFor = (s: "Base" | "Bull" | "Bear") => {
    const color = s === "Base" ? GREEN : s === "Bull" ? GREEN_MID : RED;
    const isActive = s === active;
    return <path key={s} d={path(series[s])} fill="none" stroke={color} strokeWidth={isActive ? 2.2 : 1.4} strokeOpacity={isActive ? 1 : 0.35} strokeDasharray={s === "Base" ? "0" : "4 4"} />;
  };
  const lastPt = xy(series[active])[5];
  const lastVal = series[active][5];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      <path d={bandPath} fill="#F1EEFE" opacity={0.7} />
      {lineFor("Bear")}{lineFor("Bull")}{lineFor("Base")}
      <circle cx={lastPt[0]} cy={lastPt[1]} r={4} fill={GREEN} />
      <text x={lastPt[0] - 6} y={lastPt[1] - 8} textAnchor="end" fontSize={11} fill={TEXT} fontWeight={600}>
        PKR {lastVal.toFixed(1)}B ({active})
      </text>
      {years.map((y, i) => (
        <text key={y} x={padL + (i * (w - padL - padR)) / 5} y={h - 6} fontSize={10} fill={MUTED_2} textAnchor="middle">{y}</text>
      ))}
    </svg>
  );
}

function SummaryStat({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div>
      <div className="text-[12px]" style={{ color: MUTED }}>{label}</div>
      <div className="text-[14px] font-bold tnum" style={{ color: valueColor ?? TEXT }}>{value}</div>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: MUTED }}>{children}</div>;
}

function Ring({ pct }: { pct: number }) {
  const r = 24;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <svg width={56} height={56}>
      <circle cx={28} cy={28} r={r} stroke={BORDER} strokeWidth={5} fill="none" />
      <circle cx={28} cy={28} r={r} stroke={GREEN} strokeWidth={5} fill="none" strokeDasharray={`${dash} ${c}`} strokeLinecap="round" transform="rotate(-90 28 28)" />
      <text x={28} y={32} textAnchor="middle" fontSize={11} fontWeight={700} fill={TEXT}>{pct.toFixed(1)}%</text>
    </svg>
  );
}

function QueueRow({ to, label, status, tone }: { to: string; label: string; status: string; tone: "amber" | "green" }) {
  const colors = tone === "amber" ? { bg: "#FFF8EC", fg: "#92560B" } : { bg: "#ECFDF3", fg: "#15803D" };
  return (
    <Link to={to} className="flex items-center justify-between text-[12px]">
      <span style={{ color: TEXT }}>{label}</span>
      <span className="rounded-md px-2 py-0.5 text-[11px] font-semibold" style={{ background: colors.bg, color: colors.fg }}>{status} →</span>
    </Link>
  );
}

function StatusBadge({ tone, children }: { tone: "amber" | "green" | "red" | "blue"; children: React.ReactNode }) {
  const map = {
    amber: { bg: "#FFF8EC", fg: "#92560B" },
    green: { bg: "#ECFDF3", fg: "#15803D" },
    red: { bg: "#FFF0F2", fg: "#B42330" },
    blue: { bg: "#ECF8FE", fg: "#0E7FB0" },
  } as const;
  const c = map[tone];
  return <span className="rounded-md px-2 py-0.5 text-[11px] font-semibold" style={{ background: c.bg, color: c.fg }}>{children}</span>;
}
