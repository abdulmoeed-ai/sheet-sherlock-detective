import { describe, expect, it } from "vitest";

import { buildAskAiRequestPayload, shouldUseExternalSources } from "./ask-ai-request";

describe("buildAskAiRequestPayload", () => {
  it("omits stale project filters when no project context is selected", () => {
    const payload = buildAskAiRequestPayload({
      question: "Hi",
      sessionId: "chat-1",
      routePath: "/inbox",
      screenName: "Analysis Requests",
      documents: [],
      project: null,
    });

    expect(payload.filters).toEqual({});
    expect(payload.documentIds).toEqual([]);
    expect(payload.includeExternalSources).toBe(false);
  });

  it("includes project filters only from real selected workspace context", () => {
    const payload = buildAskAiRequestPayload({
      question: "Forecast the company outlook",
      sessionId: "chat-1",
      routePath: "/forecast",
      screenName: "Forecast",
      documents: [{ id: "doc-1" }],
      project: {
        companyName: "Actual Company",
        fiscalYear: "FY2026",
      },
    });

    expect(payload.filters).toEqual({ period: "FY2026", company: "Actual Company" });
    expect(payload.documentIds).toEqual(["doc-1"]);
    expect(payload.includeExternalSources).toBe(true);
  });

  it("auto-enables approved external sources for all forecast route prompts", () => {
    const payload = buildAskAiRequestPayload({
      question: "What assumptions should I use?",
      sessionId: "chat-1",
      routePath: "/forecast",
      screenName: "Forecast",
      documents: [],
      project: null,
    });

    expect(payload.includeExternalSources).toBe(true);
  });
});

describe("shouldUseExternalSources", () => {
  it("matches current market questions but not greetings", () => {
    expect(shouldUseExternalSources("What are current policy rates?")).toBe(true);
    expect(shouldUseExternalSources("Hi")).toBe(false);
  });
});
