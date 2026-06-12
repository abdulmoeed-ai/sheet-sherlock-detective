import { apiFetch } from "./client";

export interface AnalystItem {
  email: string;
  name: string;
}

export interface PsxCompany {
  name: string;
  symbol: string;
  sector: string;
}

export interface MarketPulseTickerItem {
  symbol: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  direction: "up" | "down" | "flat";
  source: string;
}

export interface MarketPulseActiveStock {
  symbol: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  direction: "up" | "down" | "flat";
}

export interface MarketPulseContentItem {
  title: string;
  summary: string;
  date?: string | null;
  url?: string | null;
  source: string;
  actionLabel?: string | null;
}

export interface MarketPulseResponse {
  ticker: {
    label: string;
    source: string;
    lastSyncedAt: string;
    items: MarketPulseTickerItem[];
  };
  topActiveStocks: {
    source: string;
    lastSyncedAt: string;
    items: MarketPulseActiveStock[];
  };
  latestNews: {
    source: string;
    lastSyncedAt: string;
    items: MarketPulseContentItem[];
  };
  researchReports: {
    source: string;
    lastSyncedAt: string;
    items: MarketPulseContentItem[];
  };
  warnings: string[];
}

export function listAnalysts() {
  return apiFetch<AnalystItem[]>("/api/users/analysts");
}

export function listPsxCompanies() {
  return apiFetch<PsxCompany[]>("/api/psx/companies");
}

export function readMarketPulse() {
  return apiFetch<MarketPulseResponse>("/api/psx/market-pulse");
}
