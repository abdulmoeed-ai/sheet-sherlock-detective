import { describe, expect, it } from "vitest";
import {
  buildPortfolioApprovedModelCoverage,
  buildPortfolioSectorAllocation,
  filterPortfolioDashboards,
  normalizePortfolioCompanies,
  portfolioCompanySummary,
  portfolioSourceSyncRange,
  portfolioVisibilityDescription,
  portfolioVisibilityLabel,
  sortPortfolioDashboardsByUpdated,
} from "./portfolio-dashboard";
import type { PortfolioDashboardResponse, ProjectResponse } from "@/lib/api/types";

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

const project = (overrides: Partial<ProjectResponse> = {}): ProjectResponse => ({
  id: "project-1",
  companyName: "Millat Tractors Limited",
  projectLabel: "MTL_FY2025_v1",
  sector: "Automobile Assembler",
  fiscalYear: "FY2025",
  currencyUnit: "Rs in Thousands",
  template: "Millat - Template.xlsx",
  status: "approved",
  createdAt: "2026-06-01T10:00:00Z",
  updatedAt: "2026-06-01T10:00:00Z",
  teamMembers: [],
  pdfs: [],
  reviewProgress: { total: 1, reviewed: 1 },
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
    expect(filterPortfolioDashboards(dashboards, "", null, "public")).toHaveLength(1);
  });

  it("sorts dashboards by most recently updated", () => {
    expect(
      sortPortfolioDashboardsByUpdated([
        dashboard({ id: "old", updatedAt: "2026-06-01T10:00:00Z" }),
        dashboard({ id: "new", updatedAt: "2026-06-06T10:00:00Z" }),
      ]).map((item) => item.id),
    ).toEqual(["new", "old"]);
  });

  it("builds sector allocation by company count", () => {
    expect(
      buildPortfolioSectorAllocation([
        { symbol: "MTL", name: "Millat Tractors Limited", sector: "Automobile Assembler" },
        {
          symbol: "HCAR",
          name: "Honda Atlas Cars Pakistan Limited",
          sector: "Automobile Assembler",
        },
        { symbol: "LUCK", name: "Lucky Cement Limited", sector: "Cement" },
      ]),
    ).toEqual([
      { sector: "Automobile Assembler", count: 2, share: 2 / 3 },
      { sector: "Cement", count: 1, share: 1 / 3 },
    ]);
  });

  it("matches approved model coverage without blocking missing models", () => {
    const coverage = buildPortfolioApprovedModelCoverage(
      [
        { symbol: "MTL", name: "Millat Tractors Limited", sector: "Automobile Assembler" },
        { symbol: "LUCK", name: "Lucky Cement Limited", sector: "Cement" },
      ],
      [project()],
    );

    expect(coverage.label).toBe("1 of 2 companies have approved models");
    expect(coverage.rows.map((row) => row.statusLabel)).toEqual([
      "Approved financial model available",
      "Approved financial model not available yet",
    ]);
  });

  it("summarizes source sync freshness range", () => {
    expect(portfolioSourceSyncRange(["2026-06-04 15:30 PKT", "2026-06-05 15:30 PKT"]).label).toBe(
      "Last synced range 2026-06-04 15:30 PKT to 2026-06-05 15:30 PKT",
    );
    expect(portfolioSourceSyncRange([]).label).toBe("No live source sync timestamp available yet");
  });
});
