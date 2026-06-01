import { describe, expect, it } from "vitest";
import { getAskAiCitationTitle } from "./ask-ai-citations";

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
