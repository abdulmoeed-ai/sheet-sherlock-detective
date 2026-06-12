import type { PsxCompany } from "@/lib/api/users";
import type { ProjectResponse, SourceSearchResponse, WorkspaceResponse } from "@/lib/api/types";
import { dashboardMetrics } from "@/lib/mappers/workspace";

export type DashboardSource = "AskAnalyst" | "PSX" | "Broker Research" | "Approved Model";

export interface DashboardOption {
  value: string;
  label: string;
}

export interface FinancialDashboardSection {
  id: string;
  title: string;
  source: DashboardSource;
  description: string;
}

export interface ModelGraphAvailability {
  available: boolean;
  source?: "Approved Model";
  reason?: string;
  project?: ProjectResponse;
}

export interface FinancialDashboardSourcePlan {
  liveSections: FinancialDashboardSection[];
  modelSections: FinancialDashboardSection[];
  modelGraphAvailability: ModelGraphAvailability;
}

export interface LiveMarketInput {
  lastPrice: number;
  changePct: number;
  changeBasisLabel?: string | null;
  changeBasisValue?: number | null;
  lastSyncedAt?: string | null;
  volume: number;
  valueTraded: number;
  marketCap: number;
  pe: number | null;
  pbv: number | null;
  dividendYield: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  freeFloatPercent: number | null;
}

export interface SourceTaggedMetric {
  label: string;
  value: string;
  source: DashboardSource;
  tone?: "positive" | "negative" | "neutral";
  detail?: string;
  syncedAt?: string;
}

export interface LiveMarketDashboardMetrics {
  cards: SourceTaggedMetric[];
  valuation: SourceTaggedMetric[];
  range: {
    source: DashboardSource;
    high: string;
    low: string;
    spreadLabel: string;
  };
}

export interface BrokerReportInput {
  broker: DashboardSource | string;
  title: string;
  date?: string | null;
  summary: string;
  targetPrice?: string | null;
  rating?: string | null;
  sourceUrl?: string | null;
}

export interface BrokerResearchSummary {
  status: "available" | "unavailable";
  source: string;
  title: string;
  detail: string;
  date?: string;
  targetPrice?: string;
  rating?: string;
  sourceUrl?: string;
}

export interface ModelGraphCard {
  title: string;
  value: string;
  delta?: string;
  source: "Approved Model";
  variant: number;
}

export interface ApprovedModelGraphPack {
  status: "available" | "locked" | "empty" | "loading";
  reason: string;
  cards: ModelGraphCard[];
}

export interface SourceSyncStatus {
  source: DashboardSource;
  status: "synced" | "pending" | "locked";
  lastSyncedLabel: string;
}

export interface ValuationDashboardChartPoint {
  label: string;
  value: number;
  displayValue: string;
}

export interface ValuationDashboardChartSeries {
  title: string;
  kind: "bar" | "range" | "status";
  source: DashboardSource;
  unit?: string;
  points: ValuationDashboardChartPoint[];
}

export function sectorOptions(companies: PsxCompany[]): DashboardOption[] {
  return [...new Set(companies.map((company) => company.sector).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right))
    .map((sector) => ({ value: sector, label: sector }));
}

export function companyOptionsForSector(
  companies: PsxCompany[],
  selectedSector: string,
): DashboardOption[] {
  return companies
    .filter((company) => company.sector === selectedSector)
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((company) => ({ value: company.symbol, label: `${company.name} (${company.symbol})` }));
}

export function buildFinancialDashboardSourcePlan({
  selectedCompany,
  projects,
}: {
  selectedCompany: PsxCompany;
  projects: ProjectResponse[];
}): FinancialDashboardSourcePlan {
  const approvedModel = projects.find(
    (project) =>
      normalize(project.companyName) === normalize(selectedCompany.name) &&
      project.status === "approved",
  );

  return {
    liveSections: [
      {
        id: "market_snapshot",
        title: "Market Snapshot",
        source: "AskAnalyst",
        description: "Quote, returns, valuation multiples, free float, and share price trend.",
      },
      {
        id: "psx_trading",
        title: "PSX Trading Data",
        source: "PSX",
        description: "Ticker identity, listed market context, trading value, and volume fields.",
      },
      {
        id: "broker_view",
        title: "Broker View",
        source: "Broker Research",
        description:
          "Topline first, then other trusted broker commentary, target price, assumptions, and cited risks when available.",
      },
    ],
    modelSections: [
      modelSection("key_ratios", "Key Ratios"),
      modelSection("balance_sheet", "Balance Sheet"),
      modelSection("working_capital", "Working Capital"),
      modelSection("cash_flow", "Cash Flow"),
    ],
    modelGraphAvailability: approvedModel
      ? { available: true, source: "Approved Model", project: approvedModel }
      : { available: false, reason: "Requires approved financial model" },
  };
}

export function buildLiveMarketMetrics(input: LiveMarketInput): LiveMarketDashboardMetrics {
  const changeBasisLabel = input.changeBasisLabel?.trim() || "LDCP";
  const changeBasisDetail = input.changeBasisValue
    ? `Compared with ${changeBasisLabel} (Last Day Close Price) of PKR ${input.changeBasisValue.toFixed(2)}`
    : `Compared with ${changeBasisLabel} (Last Day Close Price) where available`;

  const syncedAt = input.lastSyncedAt ?? undefined;
  const valuation = [
    ratioMetric("P/E", input.pe, syncedAt),
    ratioMetric("P/BV", input.pbv, syncedAt),
    input.dividendYield === null
      ? null
      : {
          label: "Dividend Yield",
          value: `${input.dividendYield.toFixed(2)}%`,
          source: "AskAnalyst" as const,
          tone: "neutral" as const,
          syncedAt,
        },
    {
      label: "Free Float",
      value:
        input.freeFloatPercent === null ? "Not available" : `${input.freeFloatPercent.toFixed(2)}%`,
      source: "AskAnalyst" as const,
      tone: "neutral" as const,
      syncedAt,
    },
  ].filter((metric): metric is SourceTaggedMetric => metric !== null);

  return {
    cards: [
      {
        label: "Last Price",
        value: `PKR ${input.lastPrice.toFixed(2)}`,
        source: "AskAnalyst",
        tone: "neutral",
        syncedAt,
      },
      {
        label: `Price Change vs ${changeBasisLabel}`,
        value: `${input.changePct >= 0 ? "+" : ""}${input.changePct.toFixed(1)}%`,
        source: "AskAnalyst",
        tone: input.changePct >= 0 ? "positive" : "negative",
        detail: changeBasisDetail,
        syncedAt,
      },
      {
        label: "Volume",
        value: compactNumber(input.volume),
        source: "PSX",
        tone: "neutral",
        syncedAt,
      },
      {
        label: "Value Traded",
        value: `PKR ${compactNumber(input.valueTraded)}`,
        source: "PSX",
        tone: "neutral",
        syncedAt,
      },
      {
        label: "Market Cap",
        value: `PKR ${compactNumber(input.marketCap)}`,
        source: "AskAnalyst",
        tone: "neutral",
        syncedAt,
      },
    ],
    valuation,
    range: {
      source: "AskAnalyst",
      high:
        input.fiftyTwoWeekHigh === null
          ? "Not available"
          : `PKR ${input.fiftyTwoWeekHigh.toFixed(2)}`,
      low:
        input.fiftyTwoWeekLow === null
          ? "Not available"
          : `PKR ${input.fiftyTwoWeekLow.toFixed(2)}`,
      spreadLabel:
        input.fiftyTwoWeekHigh === null || input.fiftyTwoWeekLow === null
          ? "Range unavailable"
          : `${(input.fiftyTwoWeekHigh - input.fiftyTwoWeekLow).toFixed(2)} PKR spread`,
    },
  };
}

export function buildSourceSyncSummary({
  marketSyncedAt,
  askAnalystLive,
  brokerSyncedAt,
  approvedModelUpdatedAt,
  approvedModelAvailable,
}: {
  marketSyncedAt?: string | null;
  askAnalystLive: boolean;
  brokerSyncedAt?: string | null;
  approvedModelUpdatedAt?: string | null;
  approvedModelAvailable: boolean;
}): SourceSyncStatus[] {
  return [
    {
      source: "AskAnalyst",
      status: askAnalystLive && marketSyncedAt ? "synced" : "pending",
      lastSyncedLabel: marketSyncedAt ? `Last synced ${marketSyncedAt}` : "Not synced yet",
    },
    {
      source: "PSX",
      status: marketSyncedAt ? "synced" : "pending",
      lastSyncedLabel: marketSyncedAt ? `Last synced ${marketSyncedAt}` : "Not synced yet",
    },
    {
      source: "Broker Research",
      status: brokerSyncedAt ? "synced" : "pending",
      lastSyncedLabel: brokerSyncedAt ? `Last synced ${brokerSyncedAt}` : "Not synced yet",
    },
    {
      source: "Approved Model",
      status: approvedModelAvailable ? (approvedModelUpdatedAt ? "synced" : "pending") : "locked",
      lastSyncedLabel: approvedModelUpdatedAt
        ? `Last synced ${approvedModelUpdatedAt}`
        : approvedModelAvailable
          ? "Not synced yet"
          : "Locked until model approval",
    },
  ];
}

export function buildBrokerResearchSummary({
  companyName,
  brokerReports = [],
}: {
  companyName: string;
  brokerReports?: BrokerReportInput[];
}): BrokerResearchSummary {
  const toplineReport = brokerReports.find(
    (report) => report.broker.trim().toLowerCase() === "topline securities",
  );
  const trustedReport = toplineReport ?? brokerReports[0];
  if (!trustedReport) {
    return {
      status: "unavailable",
      source: "Broker Research",
      title: "Broker view not yet sourced",
      detail: `No trusted broker research was found for ${companyName}. Tried Topline Securities and approved brokerage sources.`,
    };
  }

  return {
    status: "available",
    source: trustedReport.broker,
    title: trustedReport.title,
    detail: trustedReport.summary,
    date: trustedReport.date ?? undefined,
    targetPrice: trustedReport.targetPrice ?? undefined,
    rating: trustedReport.rating ?? undefined,
    sourceUrl: trustedReport.sourceUrl ?? undefined,
  };
}

export function brokerReportsFromSourceSearch(
  response?: SourceSearchResponse | null,
): BrokerReportInput[] {
  if (!response?.results?.length) return [];

  return response.results
    .filter((result) => TRUSTED_BROKER_SOURCE_IDS.has(result.sourceId.trim().toLowerCase()))
    .map((result) => ({
      broker: brokerNameForSource(result.sourceId, result.sourceName),
      title: result.title,
      date: result.publicationDate ?? null,
      summary: result.excerpt,
      targetPrice: null,
      rating: null,
      sourceUrl: result.url,
    }));
}

const TRUSTED_BROKER_SOURCE_IDS = new Set([
  "topline",
  "akd",
  "arif-habib",
  "js-global",
  "intermarket",
  "sherman",
  "foundation",
  "insight",
  "askanalyst-research",
  "investors-lounge",
]);

function brokerNameForSource(sourceId: string, sourceName: string): string {
  const sourceIdNameMap: Record<string, string> = {
    topline: "Topline Securities",
    akd: "AKD Securities",
    "arif-habib": "Arif Habib Limited",
    "js-global": "JS Global Capital",
    intermarket: "Intermarket Securities",
    sherman: "Sherman Securities",
    foundation: "Foundation Securities",
    insight: "Insight Securities",
    "askanalyst-research": "AskAnalyst Research",
    "investors-lounge": "Investors Lounge Research",
  };
  const mappedName = sourceIdNameMap[sourceId.trim().toLowerCase()];
  if (mappedName) return mappedName;
  const fallbackName = sourceName.trim();
  return fallbackName || "Broker Research";
}

export function buildApprovedModelGraphPack({
  availability,
  workspace,
  loading = false,
}: {
  availability: ModelGraphAvailability;
  workspace?: Partial<WorkspaceResponse> | null;
  loading?: boolean;
}): ApprovedModelGraphPack {
  if (!availability.available) {
    return {
      status: "locked",
      reason: availability.reason ?? "Requires approved financial model",
      cards: [],
    };
  }

  if (loading) {
    return {
      status: "loading",
      reason: "Loading approved model dashboard metrics",
      cards: [],
    };
  }

  const cards = dashboardMetrics(workspace).map((metric, index) => ({
    title: metric.label,
    value: metric.value,
    delta: metric.delta,
    source: "Approved Model" as const,
    variant: index,
  }));

  if (cards.length === 0) {
    return {
      status: "empty",
      reason: "Approved model found, but graph-ready financial metrics are not available from the workbook yet.",
      cards: [],
    };
  }

  return {
    status: "available",
    reason: "Source: approved financial model.",
    cards,
  };
}

export function buildValuationDashboardChartSeries({
  metrics,
  sourceSyncSummary,
  modelGraphPack,
}: {
  metrics: LiveMarketDashboardMetrics;
  sourceSyncSummary: SourceSyncStatus[];
  modelGraphPack: ApprovedModelGraphPack | null;
}): ValuationDashboardChartSeries[] {
  const lastPrice = numericFromDisplayValue(
    metrics.cards.find((metric) => metric.label === "Last Price")?.value,
  );
  const low = numericFromDisplayValue(metrics.range.low);
  const high = numericFromDisplayValue(metrics.range.high);
  const volume = numericFromDisplayValue(metrics.cards.find((metric) => metric.label === "Volume")?.value);
  const valueTraded = numericFromDisplayValue(
    metrics.cards.find((metric) => metric.label === "Value Traded")?.value,
  );
  const marketCap = numericFromDisplayValue(metrics.cards.find((metric) => metric.label === "Market Cap")?.value);
  const valuationPoints = metrics.valuation
    .map((metric) => ({
      label: metric.label,
      value: numericFromDisplayValue(metric.value),
      displayValue: metric.value,
    }))
    .filter((point): point is ValuationDashboardChartPoint => point.value !== null);

  const series: ValuationDashboardChartSeries[] = [];
  if (low !== null && lastPrice !== null && high !== null) {
    series.push({
      title: "Share Price Range",
      kind: "range",
      source: metrics.range.source,
      unit: "PKR",
      points: [
        { label: "52W Low", value: low, displayValue: metrics.range.low },
        { label: "Current", value: lastPrice, displayValue: `PKR ${lastPrice.toFixed(2)}` },
        { label: "52W High", value: high, displayValue: metrics.range.high },
      ],
    });
  }

  if (valuationPoints.length >= 2) {
    series.push({
      title: "Valuation Multiples",
      kind: "bar",
      source: "AskAnalyst",
      points: valuationPoints.slice(0, 4),
    });
  }

  const scalePoints = [
    volume === null ? null : { label: "Volume", value: volume, displayValue: "Volume" },
    valueTraded === null ? null : { label: "Value Traded", value: valueTraded, displayValue: "Value traded" },
    marketCap === null ? null : { label: "Market Cap", value: marketCap, displayValue: "Market cap" },
  ].filter((point): point is ValuationDashboardChartPoint => point !== null);
  if (scalePoints.length >= 2) {
    series.push({
      title: "Trading Scale",
      kind: "bar",
      source: "PSX",
      points: scalePoints,
    });
  }

  if (sourceSyncSummary.length >= 2) {
    series.push({
      title: "Source Readiness",
      kind: "status",
      source: "AskAnalyst",
      points: sourceSyncSummary.map((item) => ({
        label: item.source,
        value: item.status === "synced" ? 100 : item.status === "pending" ? 50 : 0,
        displayValue: item.lastSyncedLabel,
      })),
    });
  }

  const modelPoints = (modelGraphPack?.cards ?? [])
    .map((card) => ({
      label: card.title,
      value: numericFromDisplayValue(card.value),
      displayValue: card.value,
    }))
    .filter((point): point is ValuationDashboardChartPoint => point.value !== null);
  if (modelPoints.length >= 2) {
    series.push({
      title: "Approved Model Snapshot",
      kind: "bar",
      source: "Approved Model",
      points: modelPoints.slice(0, 5),
    });
  }

  return series;
}

function modelSection(id: string, title: string): FinancialDashboardSection {
  return {
    id,
    title,
    source: "Approved Model",
    description: "Generated from reviewed and Manager-approved workbook data.",
  };
}

function ratioMetric(
  label: string,
  value: number | null,
  syncedAt?: string,
): SourceTaggedMetric | null {
  if (value === null) return null;
  return {
    label,
    value: value.toFixed(2),
    source: "AskAnalyst",
    tone: "neutral",
    syncedAt,
  };
}

function compactNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}bn`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}m`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toLocaleString();
}

function numericFromDisplayValue(value?: string | null): number | null {
  if (!value) return null;
  const normalized = value.replace(/,/g, "").toLowerCase();
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed)) return null;
  const unitMatch = normalized.match(/-?\d+(?:\.\d+)?\s*(bn|b|m|k)\b/);
  const unit = unitMatch?.[1];
  if (unit === "bn" || unit === "b") return parsed * 1_000_000_000;
  if (unit === "m") return parsed * 1_000_000;
  if (unit === "k") return parsed * 1_000;
  return parsed;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}
