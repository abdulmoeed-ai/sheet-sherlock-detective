import { describe, expect, it } from "vitest";
import {
  buildApprovedModelGraphPack,
  buildBrokerResearchSummary,
  buildLiveMarketMetrics,
  buildFinancialDashboardSourcePlan,
  buildSourceSyncSummary,
  brokerReportsFromSourceSearch,
  companyOptionsForSector,
  sectorOptions,
} from "./financial-dashboard";
import type { PsxCompany } from "@/lib/api/users";
import type { ProjectResponse } from "@/lib/api/types";

const companies: PsxCompany[] = [
  { name: "Lucky Cement Limited", symbol: "LUCK", sector: "Cement" },
  { name: "Millat Tractors Limited", symbol: "MTL", sector: "Engineering & Industrials" },
  { name: "MCB Bank Limited", symbol: "MCB", sector: "Commercial Banks" },
];

const project = (overrides: Partial<ProjectResponse> = {}): ProjectResponse => ({
  id: "project-1",
  companyName: "Millat Tractors Limited",
  projectLabel: null,
  sector: "Engineering & Industrials",
  fiscalYear: "FY2025",
  currencyUnit: "Rs in Thousands",
  template: "Millat - Template.xlsx",
  status: "approved",
  createdAt: "2026-06-01T09:00:00Z",
  updatedAt: "2026-06-01T09:00:00Z",
  teamMembers: [],
  pdfs: [],
  reviewProgress: { total: 12, reviewed: 12 },
  ...overrides,
});

describe("financial dashboard helpers", () => {
  it("lists sectors alphabetically and filters companies by sector", () => {
    expect(sectorOptions(companies)).toEqual([
      { value: "Cement", label: "Cement" },
      { value: "Commercial Banks", label: "Commercial Banks" },
      { value: "Engineering & Industrials", label: "Engineering & Industrials" },
    ]);

    expect(companyOptionsForSector(companies, "Cement")).toEqual([
      { value: "LUCK", label: "Lucky Cement Limited (LUCK)" },
    ]);
  });

  it("keeps financial statement graphs unavailable until an approved model exists", () => {
    const withoutModel = buildFinancialDashboardSourcePlan({
      selectedCompany: companies[0],
      projects: [project()],
    });
    const withModel = buildFinancialDashboardSourcePlan({
      selectedCompany: companies[1],
      projects: [project()],
    });

    expect(withoutModel.modelGraphAvailability).toMatchObject({
      available: false,
      reason: "Requires approved financial model",
    });
    expect(withModel.modelGraphAvailability).toMatchObject({
      available: true,
      source: "Approved Model",
    });
  });

  it("classifies market and broker data separately from approved model graphs", () => {
    const plan = buildFinancialDashboardSourcePlan({
      selectedCompany: companies[1],
      projects: [project()],
    });

    expect(plan.liveSections).toEqual([
      expect.objectContaining({ id: "market_snapshot", source: "AskAnalyst" }),
      expect.objectContaining({ id: "psx_trading", source: "PSX" }),
      expect.objectContaining({ id: "broker_view", source: "Topline Securities" }),
    ]);
    expect(plan.modelSections.map((section) => section.title)).toEqual([
      "Key Ratios",
      "Balance Sheet",
      "Working Capital",
      "Cash Flow",
    ]);
  });

  it("builds live market metrics with source tags from AskAnalyst quote fields", () => {
    const metrics = buildLiveMarketMetrics({
      lastPrice: 124.5,
      changePct: 1.9,
      volume: 376020,
      valueTraded: 164010000,
      marketCap: 638095400000,
      pe: 7.66,
      pbv: 1.33,
      dividendYield: 0.92,
      fiftyTwoWeekHigh: 149.4,
      fiftyTwoWeekLow: 94.62,
      freeFloatPercent: 32.5,
      lastSyncedAt: "2026-06-05 15:30 PKT",
      changeBasisLabel: "LDCP",
      changeBasisValue: 122.18,
    });

    expect(metrics.cards.map((card) => card.source)).toEqual([
      "AskAnalyst",
      "AskAnalyst",
      "PSX",
      "PSX",
      "AskAnalyst",
    ]);
    expect(metrics.valuation.map((metric) => metric.label)).toEqual([
      "P/E",
      "P/BV",
      "Dividend Yield",
      "Free Float",
    ]);
    expect(metrics.range).toMatchObject({
      source: "AskAnalyst",
      high: "PKR 149.40",
      low: "PKR 94.62",
    });
    expect(metrics.cards[1]).toMatchObject({
      label: "Price Change vs LDCP",
      detail: "Compared with LDCP (Last Day Close Price) of PKR 122.18",
      syncedAt: "2026-06-05 15:30 PKT",
    });
    expect(metrics.cards.every((card) => card.syncedAt === "2026-06-05 15:30 PKT")).toBe(true);
  });

  it("summarizes source freshness with last synced labels", () => {
    const summary = buildSourceSyncSummary({
      marketSyncedAt: "2026-06-05 15:30 PKT",
      askAnalystLive: true,
      brokerSyncedAt: null,
      approvedModelUpdatedAt: "2026-06-01T09:00:00Z",
      approvedModelAvailable: true,
    });

    expect(summary.map((source) => [source.source, source.status, source.lastSyncedLabel])).toEqual(
      [
        ["AskAnalyst", "synced", "Last synced 2026-06-05 15:30 PKT"],
        ["PSX", "synced", "Last synced 2026-06-05 15:30 PKT"],
        ["Topline Securities", "pending", "Not synced yet"],
        ["Approved Model", "synced", "Last synced 2026-06-01T09:00:00Z"],
      ],
    );
  });

  it("keeps broker commentary unavailable until sourced broker evidence exists", () => {
    expect(buildBrokerResearchSummary({ companyName: "Lucky Cement Limited" })).toMatchObject({
      status: "unavailable",
      source: "Topline Securities",
      title: "Broker view not yet sourced",
      detail:
        "No Topline Securities report or broker evidence has been attached for Lucky Cement Limited.",
    });

    expect(
      buildBrokerResearchSummary({
        companyName: "Lucky Cement Limited",
        brokerReports: [
          {
            broker: "Topline Securities",
            title: "Lucky Cement valuation update",
            date: "2026-06-05",
            summary: "Target price maintained; cement demand recovery remains gradual.",
            targetPrice: "PKR 540",
            rating: "Neutral",
          },
        ],
      }),
    ).toMatchObject({
      status: "available",
      source: "Topline Securities",
      title: "Lucky Cement valuation update",
      targetPrice: "PKR 540",
      rating: "Neutral",
    });
  });

  it("maps sourced Topline search results into broker evidence without inventing valuation fields", () => {
    const reports = brokerReportsFromSourceSearch({
      status: "available",
      query: "Lucky Cement Topline Securities target price rating",
      rejectedResults: 0,
      allowedDomains: ["topline.com.pk"],
      results: [
        {
          title: "Lucky Cement valuation update",
          url: "https://topline.com.pk/research/luck",
          excerpt: "Topline Securities commentary on demand recovery and pricing discipline.",
          sourceId: "topline",
          sourceName: "Topline Securities",
          publicationDate: "2026-06-05",
          score: 0.91,
        },
        {
          title: "Exchange notice",
          url: "https://psx.com.pk/notices/luck",
          excerpt: "PSX filing.",
          sourceId: "psx",
          sourceName: "Pakistan Stock Exchange",
          publicationDate: "2026-06-04",
          score: 0.8,
        },
      ],
    });

    expect(reports).toEqual([
      {
        broker: "Topline Securities",
        title: "Lucky Cement valuation update",
        date: "2026-06-05",
        summary: "Topline Securities commentary on demand recovery and pricing discipline.",
        targetPrice: null,
        rating: null,
        sourceUrl: "https://topline.com.pk/research/luck",
      },
    ]);
  });

  it("turns approved workspace dashboard metrics into model graph cards", () => {
    const pack = buildApprovedModelGraphPack({
      availability: {
        available: true,
        source: "Approved Model",
        project: project(),
      },
      workspace: {
        ...emptyWorkspace,
        dashboard: {
          metrics: [
            { label: "Revenue", value: "PKR 54.1bn", delta: "+5.2%" },
            { label: "Gross Margin", value: "24.6%", delta: "-1.1%" },
          ],
        },
      },
    });

    expect(pack.status).toBe("available");
    expect(pack.cards).toEqual([
      expect.objectContaining({
        title: "Revenue",
        value: "PKR 54.1bn",
        delta: "+5.2%",
        source: "Approved Model",
      }),
      expect.objectContaining({
        title: "Gross Margin",
        value: "24.6%",
        delta: "-1.1%",
        source: "Approved Model",
      }),
    ]);
  });
});

const emptyWorkspace = {
  documents: [],
  review: {},
  auditEvents: [],
  exportPreview: {},
  dashboard: {},
};
