import { describe, expect, it } from "vitest";

import {
  askAiSuggestionsForRoute,
  buildAskAiContextChips,
  buildAskAiSubtitleParts,
  shouldUseProjectContextForRoute,
} from "./ask-ai-context";

describe("Ask AI route context", () => {
  it("does not invent project metadata for generic routes without selected context", () => {
    expect(
      buildAskAiContextChips({
        screenName: "Inbox",
        company: null,
        period: null,
        sector: null,
        documentCount: undefined,
        isDiagnosis: false,
      }),
    ).toEqual(["Inbox"]);

    expect(
      buildAskAiSubtitleParts({
        screenName: "Inbox",
        company: null,
        period: null,
      }),
    ).toEqual(["Inbox"]);
  });

  it("keeps generic suggestions free of company, fiscal-year, and sector assumptions", () => {
    const suggestions = askAiSuggestionsForRoute("/inbox");

    expect(suggestions).toEqual([
      "Summarize what I should review on this screen",
      "What information is available for this workflow?",
      "What can you help me analyze once I select a project or upload evidence?",
    ]);
    expect(suggestions.join(" ")).not.toMatch(/Millat|FY2025|sector/i);
  });

  it("uses analyst-style forecast suggestions on the forecast route", () => {
    expect(askAiSuggestionsForRoute("/forecast")).toEqual([
      "Build a 5-year Revenue, PAT, and EPS forecast for a company I specify",
      "Use approved web sources to identify forecast drivers and risks",
      "Compare base, upside, and downside scenarios with defensible assumptions",
    ]);
  });

  it("uses provided project metadata when real context is present", () => {
    expect(
      buildAskAiContextChips({
        screenName: "Diagnosis",
        company: "Actual Company",
        period: "FY2026",
        sector: "Actual Sector",
        documentCount: 2,
        isDiagnosis: true,
      }),
    ).toEqual([
      "FY2026",
      "Actual Company",
      "Actual Sector sector",
      "2 PDFs",
      "Diagnosis workbook open",
    ]);
  });

  it("keeps list and registry routes scoped to the current screen", () => {
    expect(shouldUseProjectContextForRoute("/registry")).toBe(false);
    expect(shouldUseProjectContextForRoute("/sources")).toBe(false);
    expect(shouldUseProjectContextForRoute("/inbox")).toBe(false);
  });

  it("allows project context on project and workflow routes without borrowing context on forecast chat", () => {
    expect(shouldUseProjectContextForRoute("/diagnosis/project-1")).toBe(true);
    expect(shouldUseProjectContextForRoute("/ingestion/project-1")).toBe(true);
    expect(shouldUseProjectContextForRoute("/review")).toBe(true);
    expect(shouldUseProjectContextForRoute("/forecast")).toBe(false);
  });
});
