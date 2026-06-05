import { describe, expect, it } from "vitest";
import {
  getAskAiCitationDetail,
  getAskAiCitationPillLabel,
  getAskAiCitationPreview,
  getAskAiCitationTitle,
} from "./ask-ai-citations";

describe("getAskAiCitationTitle", () => {
  it("titles model citations from sheet and cell", () => {
    expect(
      getAskAiCitationTitle({
        kind: "model",
        sheetName: "Assumptions",
        cellReference: "B12",
      }),
    ).toBe("Assumptions B12");
  });

  it("titles diagnosis workbook citations from label and cell", () => {
    expect(
      getAskAiCitationTitle({
        kind: "diagnosis_workbook_cell",
        label: "Total assets",
        cellReference: "BS1!D18",
      }),
    ).toBe("Total assets BS1!D18");
  });

  it("titles uploaded PDF citations from filename", () => {
    expect(getAskAiCitationTitle({ kind: "uploaded_pdf", filename: "annual-report.pdf" })).toBe(
      "annual-report.pdf",
    );
  });

  it("falls back to source name or kind", () => {
    expect(getAskAiCitationTitle({ kind: "web", sourceName: "PSX" })).toBe("PSX");
    expect(getAskAiCitationTitle({ kind: "source_registry" })).toBe("source_registry");
  });
});

describe("Ask AI citation pills", () => {
  it("labels web citations with their citation index and source", () => {
    expect(
      getAskAiCitationPillLabel({
        index: 4,
        kind: "web",
        sourceName: "Pakistan Stock Exchange",
        url: "https://psx.com.pk/company/MTL",
      }),
    ).toBe("4 Pakistan Stock Exchange");
  });

  it("explains what a web citation links to", () => {
    expect(
      getAskAiCitationDetail({
        kind: "web",
        sourceName: "Pakistan Stock Exchange",
        title: "MTL filing",
        url: "https://psx.com.pk/company/MTL",
        excerpt: "Company filing information",
      }),
    ).toContain("Website: https://psx.com.pk/company/MTL");
  });

  it("explains model citations from sheet and cell metadata", () => {
    expect(
      getAskAiCitationDetail({
        kind: "model",
        sheetName: "PL1 - Revenue",
        cellReference: "PL1!F5",
        currentValue: "52108997",
      }),
    ).toContain("Model cell: PL1 - Revenue PL1!F5");
  });

  it("explains diagnosis workbook citations with exact row cell and value", () => {
    const detail = getAskAiCitationDetail({
      kind: "diagnosis_workbook_cell",
      sheetName: "Balance Sheet",
      cellReference: "BS1!D18",
      rowNumber: 18,
      label: "Total assets",
      period: "FY2025",
      currentValue: "987654",
      formula: "=D16+D17",
    });

    expect(detail).toContain("Workbook cell: Balance Sheet · BS1!D18 · row 18");
    expect(detail).toContain("Value: 987654");
    expect(detail).toContain("Formula: =D16+D17");
  });

  it("exposes uploaded PDF citations as previewable document pages", () => {
    expect(
      getAskAiCitationPreview({
        index: 4,
        kind: "uploaded_pdf",
        documentId: "document-1",
        filename: "Millat - 2025.pdf",
        pageNumber: 108,
      }),
    ).toEqual({
      type: "document_page",
      documentId: "document-1",
      pdfPageIndex: 107,
      pageLabel: "108",
      title: "Millat - 2025.pdf",
    });
  });

  it("exposes model citations with document evidence as previewable source pages", () => {
    expect(
      getAskAiCitationPreview({
        index: 1,
        kind: "model",
        documentId: "document-1",
        sheetName: "PL7 - OCI",
        cellReference: "PL7!F14",
        pageNumber: 108,
      }),
    ).toMatchObject({
      type: "document_page",
      documentId: "document-1",
      pdfPageIndex: 107,
      title: "PL7 - OCI PL7!F14",
    });
  });

  it("exposes web citations as external links", () => {
    expect(
      getAskAiCitationPreview({
        index: 8,
        kind: "source",
        sourceName: "Pakistan Stock Exchange",
        url: "https://dps.psx.com.pk/download/document/260894.pdf",
      }),
    ).toEqual({
      type: "external_url",
      url: "https://dps.psx.com.pk/download/document/260894.pdf",
      title: "Pakistan Stock Exchange",
    });
  });
});
