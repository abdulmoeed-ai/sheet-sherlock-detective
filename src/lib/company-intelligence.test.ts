import { describe, expect, it } from "vitest";
import {
  companyIntelligenceFromAskAnalyst,
  getMockCompanyIntelligence,
} from "./company-intelligence";

describe("company intelligence mock service", () => {
  it("returns market-sourced signals and a locked forecast preview for a no-model company", () => {
    const intelligence = getMockCompanyIntelligence({
      name: "Millat Tractors Limited",
      symbol: "MTL",
      sector: "Engineering & Industrials",
    });

    expect(intelligence.identifiers.symbol).toBe("MTL");
    expect(intelligence.marketSignals.sourceTypeLabel).toBe("Market-sourced");
    expect(intelligence.marketSignals.sharePriceTrend).toHaveLength(7);
    expect(intelligence.metricGroups.map((group) => group.title)).toContain("Trading Data");
    expect(
      intelligence.dataReadiness.items.some((item) => item.label === "Annual report upload"),
    ).toBe(true);
    expect(intelligence.forecastLocked.reason).toContain("requires approved model data");
  });

  it("normalizes a fallback symbol when the company master has no ticker", () => {
    const intelligence = getMockCompanyIntelligence({
      name: "Pakistan State Oil",
      sector: "Oil & Gas",
    });

    expect(intelligence.identifiers.symbol).toBe("PSO");
  });

  it("maps AskAnalyst quote and chart fields into provider-sourced dashboard stats", () => {
    const fallback = getMockCompanyIntelligence({
      name: "Millat Tractors Limited",
      symbol: "MTL",
      sector: "Engineering",
    });
    const intelligence = companyIntelligenceFromAskAnalyst(
      {
        sourceUrl: "https://www.askanalyst.com.pk/company/overview",
        company: {
          id: 210,
          name: "Millat Tractors Ltd",
          symbol: "MTL",
          sector: "AUTOMOBILE ASSEMBLER",
          image: "https://admin.askanalyst.com.pk/logo16/MTL.svg",
        },
        quote: {
          current: "694.20",
          change_in_percentage: "4.80",
          date: "05 June 2026 11:01:56",
          open: "680.00",
          high: "700.00",
          low: "675.00",
          volume: "376020",
          value: "164.01",
          market_cap: "638095.40",
          pe: "7.66",
          total_return: { "1M": "5.48", "6M": "-9.27" },
        },
        chartRanges: [
          {
            lable: "1M",
            data: [
              { xx: "2026-06-04", y: 687.5 },
              { xx: "2026-06-05", y: 694.2 },
            ],
          },
        ],
      },
      fallback,
    );

    expect(intelligence.provider.statusLabel).toBe("Live source");
    expect(intelligence.marketSignals.lastPrice).toBe(694.2);
    expect(intelligence.marketSignals.sharePriceTrend).toHaveLength(2);
    expect(intelligence.identifiers.askAnalystCompanyId).toBe(210);
    expect(intelligence.metricGroups[0]?.items.map((item) => item.label)).toContain("Volume");
    expect(intelligence.forecastLocked.reason).toContain("requires approved model data");
  });
});
