import type { CompanyIdentityInput } from "@/lib/company-intelligence";

export const ASK_ANALYST_API_BASE = "https://api.askanalyst.com.pk/api";
export const ASK_ANALYST_OVERVIEW_URL = "https://www.askanalyst.com.pk/company/overview";

export interface AskAnalystCompany {
  id: number;
  value?: number;
  label?: string;
  label2?: string;
  name: string;
  sector?: string | null;
  symbol: string;
  image?: string | null;
}

export interface AskAnalystChartPoint {
  x?: string;
  xx?: string;
  y?: number | string;
}

export interface AskAnalystStockChartRange {
  lable?: string;
  label?: string;
  data?: AskAnalystChartPoint[];
}

export interface AskAnalystSharePrice {
  open?: string | number | null;
  high?: string | number | null;
  low?: string | number | null;
  close?: string | number | null;
  current?: string | number | null;
  date?: string | null;
  bid_volume?: string | number | null;
  ask_volume?: string | number | null;
  bid_price?: string | number | null;
  ask_price?: string | number | null;
  volume?: string | number | null;
  value?: string | number | null;
  ldcp?: string | number | null;
  average_price?: string | number | null;
  direction?: string | null;
  change?: string | number | null;
  change_in_percentage?: string | number | null;
  market_cap?: string | number | null;
  free_float?: string | number | null;
  shares?: string | number | null;
  free_float_percentage?: string | number | null;
  fifty_two_week_high?: string | number | null;
  fifty_two_week_low?: string | number | null;
  fifty_two_week_average?: string | number | null;
  pe?: string | number | null;
  pbv?: string | number | null;
  dividend_yield?: string | number | null;
  ev?: string | number | null;
  total_debt?: string | number | null;
  cash?: string | number | null;
  total_return?: Record<string, string | number | null> | null;
  day_range?: {
    low?: string | number | null;
    high?: string | number | null;
  } | null;
  circuit_breaker?: {
    lower_lock?: string | number | null;
    upper_lock?: string | number | null;
  } | null;
  current_feed?: AskAnalystChartPoint[];
}

export interface AskAnalystOverview {
  company: AskAnalystCompany;
  quote: AskAnalystSharePrice;
  chartRanges: AskAnalystStockChartRange[];
  sourceUrl: string;
}

export async function fetchAskAnalystOverview(
  company: CompanyIdentityInput,
  options: { signal?: AbortSignal } = {},
): Promise<AskAnalystOverview | null> {
  const companies = await askAnalystFetch<AskAnalystCompany[]>("/companylistwithids", options);
  const match = findAskAnalystCompany(companies, company);
  if (!match) return null;

  const [quote, chartRanges] = await Promise.all([
    askAnalystFetch<AskAnalystSharePrice>(`/sharepricedatanew/${match.id}`, options),
    askAnalystFetch<AskAnalystStockChartRange[]>(`/stockchartnew/${match.id}`, options).catch(
      () => [],
    ),
  ]);

  return {
    company: match,
    quote,
    chartRanges,
    sourceUrl: ASK_ANALYST_OVERVIEW_URL,
  };
}

export function findAskAnalystCompany(
  companies: AskAnalystCompany[],
  company: CompanyIdentityInput,
): AskAnalystCompany | null {
  const symbol = company.symbol?.trim().toUpperCase();
  if (symbol) {
    const symbolMatch = companies.find((item) => item.symbol?.trim().toUpperCase() === symbol);
    if (symbolMatch) return symbolMatch;
  }

  const companyName = normalizeCompanyName(company.name);
  if (!companyName) return null;

  const exactNameMatch = companies.find((item) => normalizeCompanyName(item.name) === companyName);
  if (exactNameMatch) return exactNameMatch;

  return (
    companies.find((item) => {
      const normalized = normalizeCompanyName(item.name);
      return normalized.includes(companyName) || companyName.includes(normalized);
    }) ?? null
  );
}

async function askAnalystFetch<T>(
  path: string,
  options: { signal?: AbortSignal } = {},
): Promise<T> {
  const response = await fetch(`${ASK_ANALYST_API_BASE}${path}`, {
    signal: options.signal,
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`AskAnalyst request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function normalizeCompanyName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(limited|ltd|company|co|the)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
