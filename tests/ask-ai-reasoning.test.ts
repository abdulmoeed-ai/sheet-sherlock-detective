import { describe, expect, it } from "bun:test";
import { buildAskAiReasoningSummary, type StreamActivityEvent } from "../src/lib/ask-ai-reasoning";

describe("Ask AI reasoning presentation", () => {
  const activity: StreamActivityEvent[] = [
    { type: "source", kind: "uploaded_pdf", message: "Found uploaded PDFs", count: 1 },
    { type: "source", kind: "uploaded_sheet", message: "Using current screen context", count: 1 },
    { type: "status", stage: "retrieval", message: "Searching uploaded workbook/PDF evidence", percent: 35 },
    { type: "source", kind: "uploaded_sheet", message: "Matched project evidence", count: 4 },
    { type: "status", stage: "llm", message: "Calling Gemini", percent: 70 },
  ];

  it("turns backend events into a compact user-facing streaming summary without percentages", () => {
    const summary = buildAskAiReasoningSummary({
      activity,
      approaches: ["Use accepted model fields first."],
      done: false,
    });

    expect(summary.state).toBe("streaming");
    expect(summary.activeLabel).toBe("Drafting cited answer");
    expect(summary.chips).toEqual(["PDF found", "Screen context", "4 evidence matches"]);
    expect(summary.compactLabel).not.toContain("%");
  });

  it("collapses completed work into evidence and citation counts", () => {
    const summary = buildAskAiReasoningSummary({
      activity,
      approaches: [],
      done: true,
      final: {
        sourcesUsed: [{}, {}, {}],
        warnings: [],
      },
    });

    expect(summary.state).toBe("complete");
    expect(summary.compactLabel).toBe("Reviewed 1 PDF · Matched 4 evidence points · 3 citations");
  });
});
