import { describe, expect, it } from "vitest";

import {
  buildModelSelectionPrompt,
  matchModelSelection,
  shouldSearchModelsBeforeAskAi,
} from "./ask-ai-model-selection";
import type { AskAiModelCandidate } from "./api/types";

const candidates: AskAiModelCandidate[] = [
  {
    id: "project-1",
    companyName: "Millat Tractors Limited",
    projectLabel: "FY2025",
    fiscalYear: "FY2025",
    sector: "Engineering",
    status: "ready",
    score: 0.92,
    matchReason: "company_name",
    accessSource: "owned",
  },
  {
    id: "project-2",
    companyName: "Millat Equipment Limited",
    projectLabel: "FY2024",
    fiscalYear: "FY2024",
    sector: "Engineering",
    status: "ready",
    score: 0.69,
    matchReason: "similar_name",
    accessSource: "assigned_inbox",
  },
];

describe("shouldSearchModelsBeforeAskAi", () => {
  it("only searches when the question appears to target a specific uploaded model", () => {
    expect(shouldSearchModelsBeforeAskAi("Analyze Millat Tractors FY2025 model")).toBe(true);
    expect(shouldSearchModelsBeforeAskAi("What is working capital?")).toBe(false);
  });
});

describe("buildModelSelectionPrompt", () => {
  it("lists candidate model names without buttons", () => {
    const prompt = buildModelSelectionPrompt(candidates);

    expect(prompt).toContain("1. Millat Tractors Limited");
    expect(prompt).toContain("FY2025");
    expect(prompt).toContain("2. Millat Equipment Limited");
    expect(prompt).toContain("type the number or name");
  });
});

describe("matchModelSelection", () => {
  it("matches a typed number or model name", () => {
    expect(matchModelSelection("1", candidates)?.id).toBe("project-1");
    expect(matchModelSelection("Millat Equipment", candidates)?.id).toBe("project-2");
    expect(matchModelSelection("unknown", candidates)).toBeNull();
  });
});
