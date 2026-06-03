import { describe, expect, it } from "vitest";
import { buildAskAiReasoningSummary } from "./ask-ai-reasoning";

describe("buildAskAiReasoningSummary", () => {
  it("summarizes the active retrieval stage", () => {
    const summary = buildAskAiReasoningSummary({
      activity: [
        { type: "status", stage: "context", message: "Loading context", percent: 10 },
        {
          type: "source",
          kind: "uploaded_pdf",
          message: "Found uploaded PDFs",
          count: 2,
        },
        { type: "status", stage: "retrieval", message: "Matching evidence", percent: 45 },
      ],
      approaches: ["Use workbook rows and matching PDF excerpts."],
      done: false,
    });

    expect(summary.state).toBe("streaming");
    expect(summary.compactLabel).toBe("Matching workbook and PDF evidence");
    expect(summary.chips).toContain("2 PDFs");
    expect(summary.groups.some((group) => group.title === "Context")).toBe(true);
  });

  it("summarizes completed answers with citations and warnings", () => {
    const summary = buildAskAiReasoningSummary({
      activity: [
        {
          type: "source",
          kind: "uploaded_pdf",
          message: "Found uploaded PDFs",
          count: 1,
        },
        {
          type: "source",
          kind: "source_registry",
          message: "Matched project evidence",
          count: 3,
        },
      ],
      approaches: [],
      done: true,
      final: {
        sourcesUsed: [{ id: "s1" }, { id: "s2" }],
        warnings: ["Limited external sources"],
      },
    });

    expect(summary.state).toBe("complete");
    expect(summary.compactLabel).toBe("Reviewed 1 PDF · Matched 3 evidence points · 2 citations");
    expect(summary.warnings).toEqual(["Limited external sources"]);
  });
});
