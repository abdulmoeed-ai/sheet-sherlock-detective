import { describe, expect, it } from "vitest";
import { ingestionPageTitle, filesFromDrop } from "./ingestion-page";
import type { CycleState } from "./cycle-store";
import type { WorkspaceResponse } from "./api/types";

const cycle: CycleState = {
  sector: "Engineering & Industrials",
  company: "Millat Tractors Limited",
  period: "FY2025",
  status: "ingestion",
  startedAt: null,
  documentIds: [],
};

describe("ingestion page helpers", () => {
  it("titles the page from the project workspace instead of stale cycle state", () => {
    expect(
      ingestionPageTitle({
        workspace: workspace("Lucky Cement Limited", "FY2025"),
        cycle,
      }),
    ).toBe("Ingestion - FY2025 · Lucky Cement Limited");
  });

  it("falls back to cycle state while project workspace is loading", () => {
    expect(ingestionPageTitle({ workspace: undefined, cycle })).toBe(
      "Ingestion - FY2025 · Millat Tractors Limited",
    );
  });

  it("reads files from a drag-and-drop data transfer", () => {
    const pdf = new File(["%PDF"], "annual-report.pdf", { type: "application/pdf" });
    const transfer = { files: [pdf] } as unknown as DataTransfer;

    expect(filesFromDrop(transfer)).toEqual([pdf]);
  });
});

function workspace(companyName: string, fiscalYear: string): WorkspaceResponse {
  return {
    project: {
      id: "project-1",
      companyName,
      projectLabel: null,
      sector: "Cement",
      fiscalYear,
      currencyUnit: "Rs in Thousands",
      template: "Cement Sector Template Presentation.xlsx",
      status: "draft",
      createdAt: "2026-06-06T00:00:00Z",
      updatedAt: "2026-06-06T00:00:00Z",
      teamMembers: [],
      pdfs: [],
      reviewProgress: { total: 0, reviewed: 0 },
    },
    documents: [],
    review: {},
    auditEvents: [],
    exportPreview: {},
    dashboard: {},
  };
}
