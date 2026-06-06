import type {
  AskAnalystChartPoint,
  AskAnalystOverview,
  AskAnalystSharePrice,
} from "@/lib/ask-analyst";

export type ReadinessStatus = "ready" | "pending" | "locked";
export type MetricTone = "neutral" | "positive" | "negative";

export interface CompanyIdentityInput {
  name: string;
  symbol?: string | null;
  sector?: string | null;
}

export interface MarketPoint {
  label: string;
  price: number;
}

export interface IntelligenceMetric {
  label: string;
  value: string;
  detail?: string;
  tone?: MetricTone;
}

export interface IntelligenceMetricGroup {
  title: string;
  subtitle: string;
  items: IntelligenceMetric[];
}

export interface CompanyIntelligence {
  identifiers: {
    name: string;
    symbol: string;
    exchange: string;
    sector: string;
    fiscalYear: string;
    currency: string;
    country: string;
    logoUrl?: string | null;
    askAnalystCompanyId?: number | null;
  };
  headline: string;
  provider: {
    label: string;
    statusLabel: string;
    detail: string;
    url: string;
  };
  marketSignals: {
    sourceLabel: string;
    sourceTypeLabel: string;
    lastPrice: number;
    currency: string;
    changePct30d: number;
    updatedAt: string;
    sharePriceTrend: MarketPoint[];
  };
  metricGroups: IntelligenceMetricGroup[];
  sourceCoverage: {
    coveragePercent: number;
    sources: Array<{
      label: string;
      status: ReadinessStatus;
      detail: string;
    }>;
  };
  dataReadiness: {
    score: number;
    items: Array<{
      label: string;
      status: ReadinessStatus;
      detail: string;
    }>;
  };
  forecastLocked: {
    title: string;
    reason: string;
    requirements: string[];
  };
}

const MARKET_SEEDS: Record<
  string,
  {
    lastPrice: number;
    changePct30d: number;
    trend: number[];
    updatedAt: string;
  }
> = {
  MTL: {
    lastPrice: 694.2,
    changePct30d: 4.8,
    trend: [662, 668, 671, 666, 681, 687, 694],
    updatedAt: "2026-06-04 15:30 PKT",
  },
  MCB: {
    lastPrice: 286.7,
    changePct30d: -1.6,
    trend: [293, 291, 289, 285, 287, 284, 286.7],
    updatedAt: "2026-06-04 15:30 PKT",
  },
  EFERT: {
    lastPrice: 188.4,
    changePct30d: 2.1,
    trend: [184, 183, 185, 187, 186, 188, 188.4],
    updatedAt: "2026-06-04 15:30 PKT",
  },
};

const DEFAULT_MARKET_SEED = {
  lastPrice: 124.5,
  changePct30d: 1.9,
  trend: [119, 120, 121, 119.5, 122, 123, 124.5],
  updatedAt: "2026-06-04 15:30 PKT",
};

const TREND_LABELS = ["May 20", "May 23", "May 27", "May 30", "Jun 02", "Jun 04", "Close"];

export function getMockCompanyIntelligence(
  company: CompanyIdentityInput,
  fiscalYear = "FY2025",
): CompanyIntelligence {
  const symbol = normalizeSymbol(company.symbol, company.name);
  const market = MARKET_SEEDS[symbol] ?? DEFAULT_MARKET_SEED;

  return {
    identifiers: {
      name: company.name,
      symbol,
      exchange: "PSX",
      sector: company.sector?.trim() || "Listed equity",
      fiscalYear,
      currency: "PKR",
      country: "Pakistan",
      logoUrl: null,
      askAnalystCompanyId: null,
    },
    headline: "No approved model exists. Start with the annual report.",
    provider: {
      label: "Local fallback",
      statusLabel: "Fallback source",
      detail: "Local PSX-style fallback used while AskAnalyst data is unavailable.",
      url: "https://www.askanalyst.com.pk/company/overview",
    },
    marketSignals: {
      sourceLabel: "PSX end-of-day market snapshot",
      sourceTypeLabel: "Market-sourced",
      lastPrice: market.lastPrice,
      currency: "PKR",
      changePct30d: market.changePct30d,
      updatedAt: market.updatedAt,
      sharePriceTrend: market.trend.map((price, index) => ({
        label: TREND_LABELS[index] ?? `Point ${index + 1}`,
        price,
      })),
    },
    metricGroups: [
      {
        title: "Trading Data",
        subtitle: "Market-style quote fields",
        items: [
          { label: "Open", value: `PKR ${(market.lastPrice * 0.98).toFixed(2)}` },
          { label: "High", value: `PKR ${(market.lastPrice * 1.02).toFixed(2)}` },
          { label: "Low", value: `PKR ${(market.lastPrice * 0.96).toFixed(2)}` },
          { label: "Volume", value: "376,020", detail: "Shares" },
          { label: "Value traded", value: "PKR 164.01m", detail: "Market source" },
          { label: "LDCP", value: `PKR ${(market.lastPrice * 0.99).toFixed(2)}` },
        ],
      },
      {
        title: "Returns & History",
        subtitle: "Provider-sourced market ranges",
        items: [
          {
            label: "1M return",
            value: formatSignedPercent(market.changePct30d),
            tone: market.changePct30d >= 0 ? "positive" : "negative",
          },
          { label: "52W high", value: `PKR ${(market.lastPrice * 1.2).toFixed(2)}` },
          { label: "52W low", value: `PKR ${(market.lastPrice * 0.76).toFixed(2)}` },
        ],
      },
      {
        title: "Valuation Context",
        subtitle: "Market/provider fields, not model output",
        items: [
          { label: "Market cap", value: "PKR 638,095.40m" },
          { label: "Free float", value: "439.50m shares" },
          { label: "P/E", value: "7.66", detail: "Provider ratio" },
          { label: "Dividend yield", value: "0.92%", detail: "Provider ratio" },
        ],
      },
    ],
    sourceCoverage: {
      coveragePercent: 42,
      sources: [
        {
          label: "PSX company master",
          status: "ready",
          detail: "Company identifiers and sector are available.",
        },
        {
          label: "Market price feed",
          status: "ready",
          detail: "Share price trend is available before model creation.",
        },
        {
          label: "Annual report",
          status: "pending",
          detail: "Upload the approved annual report to create model data.",
        },
        {
          label: "Forecast workbook",
          status: "locked",
          detail: "Locked until extracted model data is manager-approved.",
        },
      ],
    },
    dataReadiness: {
      score: 25,
      items: [
        {
          label: "Company selected",
          status: "ready",
          detail: "Identifiers are ready for model setup.",
        },
        {
          label: "Annual report upload",
          status: "pending",
          detail: "Required before extraction and model creation.",
        },
        {
          label: "Model data approval",
          status: "locked",
          detail: "Requires manager review after extraction.",
        },
        {
          label: "Forecasting",
          status: "locked",
          detail: "Requires approved model data.",
        },
      ],
    },
    forecastLocked: {
      title: "Forecast locked",
      reason:
        "Forecasting requires approved model data. No assumptions or forecast outputs are generated before manager approval.",
      requirements: [
        "Upload annual report",
        "Complete extraction review",
        "Submit model data for manager approval",
      ],
    },
  };
}

export function companyIntelligenceFromAskAnalyst(
  overview: AskAnalystOverview,
  fallback: CompanyIntelligence,
): CompanyIntelligence {
  const quote = overview.quote;
  const lastPrice = numericValue(quote.current) ?? numericValue(quote.close);
  const changePct = numericValue(quote.change_in_percentage);
  const sector = overview.company.sector?.trim() || fallback.identifiers.sector;

  return {
    ...fallback,
    identifiers: {
      ...fallback.identifiers,
      name: overview.company.name || fallback.identifiers.name,
      symbol: overview.company.symbol || fallback.identifiers.symbol,
      sector,
      logoUrl: overview.company.image ?? null,
      askAnalystCompanyId: overview.company.id,
    },
    headline:
      "AskAnalyst market overview is available. Upload the annual report to start the model.",
    provider: {
      label: "AskAnalyst",
      statusLabel: "Live source",
      detail: "Public AskAnalyst company overview data used before model creation.",
      url: overview.sourceUrl,
    },
    marketSignals: {
      ...fallback.marketSignals,
      sourceLabel: "AskAnalyst PSX company overview",
      sourceTypeLabel: "Market-sourced",
      lastPrice: lastPrice ?? fallback.marketSignals.lastPrice,
      changePct30d: changePct ?? fallback.marketSignals.changePct30d,
      updatedAt: quote.date || fallback.marketSignals.updatedAt,
      sharePriceTrend:
        chartPointsFromAskAnalyst(overview) ?? fallback.marketSignals.sharePriceTrend,
    },
    metricGroups: metricGroupsFromAskAnalyst(quote, fallback.metricGroups),
    sourceCoverage: {
      coveragePercent: 58,
      sources: [
        {
          label: "AskAnalyst company master",
          status: "ready",
          detail: `${overview.company.symbol} identifiers and sector matched from AskAnalyst.`,
        },
        {
          label: "AskAnalyst market quote",
          status: "ready",
          detail:
            "Quote, trading data, returns, valuation context, and one price chart are available.",
        },
        {
          label: "Annual report",
          status: "pending",
          detail: "Upload the approved annual report to create model data.",
        },
        {
          label: "Forecast workbook",
          status: "locked",
          detail: "Locked until extracted model data is manager-approved.",
        },
      ],
    },
    dataReadiness: {
      score: 32,
      items: [
        {
          label: "Company selected",
          status: "ready",
          detail: "Identifiers are ready for model setup.",
        },
        {
          label: "Market overview",
          status: "ready",
          detail: "AskAnalyst market data is available before model creation.",
        },
        {
          label: "Annual report upload",
          status: "pending",
          detail: "Required before extraction and model creation.",
        },
        {
          label: "Forecasting",
          status: "locked",
          detail: "Requires manager-approved model data.",
        },
      ],
    },
  };
}

function normalizeSymbol(symbol: string | null | undefined, companyName: string): string {
  const cleanSymbol = symbol?.trim().toUpperCase();
  if (cleanSymbol) return cleanSymbol;
  return companyName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function metricGroupsFromAskAnalyst(
  quote: AskAnalystSharePrice,
  fallbackGroups: IntelligenceMetricGroup[],
): IntelligenceMetricGroup[] {
  const totalReturn = quote.total_return ?? {};
  const tradingItems = compactMetrics([
    priceMetric("Open", quote.open),
    priceMetric("High", quote.high ?? quote.day_range?.high),
    priceMetric("Low", quote.low ?? quote.day_range?.low),
    priceMetric("LDCP", quote.ldcp),
    priceMetric("Average", quote.average_price),
    textMetric("Bid / Ask", bidAskValue(quote), "PKR"),
    numberMetric("Volume", quote.volume, "Shares"),
    moneyMetric("Value traded", quote.value),
  ]);
  const returnItems = compactMetrics([
    percentMetric("1M return", totalReturn["1M"]),
    percentMetric("3M return", totalReturn["3M"]),
    percentMetric("6M return", totalReturn["6M"]),
    percentMetric("1Y return", totalReturn["1Y"]),
    priceMetric("52W high", quote.fifty_two_week_high),
    priceMetric("52W low", quote.fifty_two_week_low),
    priceMetric("52W average", quote.fifty_two_week_average),
  ]);
  const valuationItems = compactMetrics([
    moneyMetric("Market cap", quote.market_cap),
    numberMetric("Free float shares", quote.free_float, "m shares"),
    percentMetric("Free float %", quote.free_float_percentage, "Provider percentage", false),
    numberMetric("Shares", quote.shares, "m shares"),
    numberMetric("P/E", quote.pe, "Provider ratio"),
    numberMetric("P/BV", quote.pbv, "Provider ratio"),
    percentMetric("Dividend yield", quote.dividend_yield, "Provider ratio", false),
    moneyMetric("Enterprise value", quote.ev),
    moneyMetric("Total debt", quote.total_debt),
    moneyMetric("Cash", quote.cash),
  ]);

  const groups = [
    {
      title: "Trading Data",
      subtitle: "AskAnalyst quote fields",
      items: tradingItems,
    },
    {
      title: "Returns & History",
      subtitle: "AskAnalyst market return ranges",
      items: returnItems,
    },
    {
      title: "Valuation Context",
      subtitle: "Provider fields, not model output",
      items: valuationItems,
    },
  ].filter((group) => group.items.length > 0);

  return groups.length > 0 ? groups : fallbackGroups;
}

function chartPointsFromAskAnalyst(overview: AskAnalystOverview): MarketPoint[] | null {
  const oneMonth = overview.chartRanges.find(
    (range) => (range.lable ?? range.label ?? "").toUpperCase() === "1M",
  );
  const sourcePoints = oneMonth?.data?.length ? oneMonth.data : overview.quote.current_feed;
  if (!sourcePoints?.length) return null;

  const points = sourcePoints
    .map((point, index) => chartPointToMarketPoint(point, index))
    .filter((point): point is MarketPoint => point !== null);

  if (points.length === 0) return null;
  const chronological = oneMonth?.data?.length ? points : [...points].reverse();
  return downsamplePoints(chronological, 28);
}

function chartPointToMarketPoint(point: AskAnalystChartPoint, index: number): MarketPoint | null {
  const price = numericValue(point.y);
  if (price === null) return null;
  return {
    label: point.xx || point.x || `Point ${index + 1}`,
    price,
  };
}

function downsamplePoints(points: MarketPoint[], maxPoints: number): MarketPoint[] {
  if (points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  const sampled = Array.from({ length: maxPoints }, (_, index) => points[Math.round(index * step)]);
  return sampled.filter(
    (point, index) =>
      index === 0 ||
      point.label !== sampled[index - 1].label ||
      point.price !== sampled[index - 1].price,
  );
}

function compactMetrics(items: Array<IntelligenceMetric | null>): IntelligenceMetric[] {
  return items.filter((item): item is IntelligenceMetric => item !== null);
}

function textMetric(
  label: string,
  value: string | null,
  detail?: string,
): IntelligenceMetric | null {
  if (!value) return null;
  return { label, value, detail };
}

function priceMetric(label: string, rawValue: string | number | null | undefined) {
  const value = numericValue(rawValue);
  if (value === null) return null;
  return { label, value: `PKR ${formatNumber(value)}` };
}

function moneyMetric(label: string, rawValue: string | number | null | undefined) {
  const value = numericValue(rawValue);
  if (value === null) return null;
  return { label, value: `PKR ${formatNumber(value)}m` };
}

function numberMetric(
  label: string,
  rawValue: string | number | null | undefined,
  detail?: string,
) {
  const value = numericValue(rawValue);
  if (value === null) return null;
  return { label, value: formatNumber(value), detail };
}

function percentMetric(
  label: string,
  rawValue: string | number | null | undefined,
  detail?: string,
  signed = true,
) {
  const value = numericValue(rawValue);
  if (value === null) return null;
  return {
    label,
    value: signed ? formatSignedPercent(value) : `${formatNumber(value)}%`,
    detail,
    tone: value > 0 ? "positive" : value < 0 ? "negative" : "neutral",
  } satisfies IntelligenceMetric;
}

function bidAskValue(quote: AskAnalystSharePrice): string | null {
  const bid = numericValue(quote.bid_price);
  const ask = numericValue(quote.ask_price);
  if (bid === null && ask === null) return null;
  return `${bid === null ? "--" : formatNumber(bid)} / ${ask === null ? "--" : formatNumber(ask)}`;
}

function numericValue(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatSignedPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}
