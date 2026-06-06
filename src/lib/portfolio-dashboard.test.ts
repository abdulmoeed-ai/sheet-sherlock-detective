import { describe, expect, it } from "vitest";
import {
  filterPortfolioDashboards,
  normalizePortfolioCompanies,
  portfolioCompanySummary,
  portfolioVisibilityDescription,
  portfolioVisibilityLabel,
} from "./portfolio-dashboard";
import type { PortfolioDashboardResponse } from "@/lib/api/types";

const dashboard = (overrides: Partial<PortfolioDashboardResponse>): PortfolioDashboardResponse => ({
  id: "portfolio-1",
  name: "Cross-sector portfolio",
  description: null,
  visibility: "private",
  createdByUserId: "analyst-1",
  createdByName: "Finance Analyst",
  createdByRole: "finance_analyst",
  companySelections: [
    { symbol: "MTL", name: "Millat Tractors Limited", sector: "Automobile Assembler" },
  ],
  createdAt: "2026-06-06T10:00:00Z",
  updatedAt: "2026-06-06T10:00:00Z",
  lastExportedAt: null,
  ...overrides,
});

describe("portfolio dashboard helpers", () => {
  it("normalizes symbols and collapses duplicate selections", () => {
    expect(
      normalizePortfolioCompanies([
        { symbol: " mtl ", name: " Millat Tractors Limited ", sector: " Automobile Assembler " },
        { symbol: "MTL", name: "Millat Tractors Limited", sector: "Automobile Assembler" },
        { symbol: "LUCK", name: "Lucky Cement Limited", sector: "Cement" },
      ]),
    ).toEqual([
      { symbol: "MTL", name: "Millat Tractors Limited", sector: "Automobile Assembler" },
      { symbol: "LUCK", name: "Lucky Cement Limited", sector: "Cement" },
    ]);
  });

  it("labels visibility and explains the default private state", () => {
    expect(portfolioVisibilityLabel("private")).toBe("Private");
    expect(portfolioVisibilityDescription("private")).toBe("Only you can view this dashboard.");
    expect(portfolioVisibilityLabel("public")).toBe("Public");
  });

  it("summarizes company count and multi-sector coverage", () => {
    expect(
      portfolioCompanySummary([
        { symbol: "MTL", name: "Millat Tractors Limited", sector: "Automobile Assembler" },
        { symbol: "LUCK", name: "Lucky Cement Limited", sector: "Cement" },
      ]),
    ).toEqual({
      companyCount: 2,
      sectors: ["Automobile Assembler", "Cement"],
      sectorLabel: "2 sectors",
    });
  });

  it("filters dashboards by company, ticker, sector, and creator", () => {
    const dashboards = [
      dashboard({ name: "Autos", visibility: "public" }),
      dashboard({
        id: "portfolio-2",
        name: "Cement",
        createdByName: "Portfolio Manager",
        companySelections: [{ symbol: "LUCK", name: "Lucky Cement Limited", sector: "Cement" }],
      }),
    ];

    expect(filterPortfolioDashboards(dashboards, "luck")).toHaveLength(1);
    expect(filterPortfolioDashboards(dashboards, "Automobile")).toHaveLength(1);
    expect(filterPortfolioDashboards(dashboards, "", "Portfolio Manager")).toHaveLength(1);
  });
});
