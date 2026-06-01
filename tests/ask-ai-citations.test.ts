import { describe, expect, it } from "bun:test";
import { getAskAiCitationTitle } from "../src/lib/ask-ai-citations";

describe("Ask AI citation display", () => {
  it("shows uploaded PDF filenames instead of technical document ids", () => {
    expect(
      getAskAiCitationTitle({
        kind: "uploaded_pdf",
        documentId: "doc-123",
        filename: "Millat - 2023.pdf",
      }),
    ).toBe("Millat - 2023.pdf");
  });
});
