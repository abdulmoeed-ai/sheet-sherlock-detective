import { describe, expect, it } from "vitest";
import { askAiSessionToMessages } from "@/lib/ask-ai-threads";
import type { AskAiChatSessionResponse } from "@/lib/api/types";

describe("askAiSessionToMessages", () => {
  it("maps persisted user and assistant messages with citations and metadata", () => {
    const session: AskAiChatSessionResponse = {
      id: "chat-1",
      projectId: "project-1",
      projectLabel: "Millat FY2025",
      companyName: "Millat",
      title: "Balance sheet",
      routePath: "/diagnosis/project-1",
      screenName: "Diagnosis",
      messageCount: 2,
      createdAt: "2026-06-06T10:00:00Z",
      updatedAt: "2026-06-06T10:01:00Z",
      messages: [
        {
          id: "msg-user",
          role: "user",
          content: "Why is it imbalanced?",
          routePath: "/diagnosis/project-1",
          screenName: "Diagnosis",
          citations: [],
          warnings: [],
          usage: {},
          retrievalSnapshot: {},
          createdAt: "2026-06-06T10:00:00Z",
        },
        {
          id: "msg-ai",
          role: "assistant",
          content: "Cash is missing [1].",
          routePath: "/diagnosis/project-1",
          screenName: "Diagnosis",
          citations: [{ index: 1, kind: "model" }],
          warnings: ["citation_limited"],
          usage: { totalTokens: 192, inputTokens: 128, outputTokens: 64 },
          retrievalSnapshot: {
            sourcesUsed: [{ index: 1, kind: "model" }],
            modelCitations: [{ index: 1, kind: "model", cellReference: "BS!D42" }],
            sourceCitations: [],
            forecastAnalysis: {
              metric: "revenue",
              forecastHorizon: 5,
              historicalSeries: [
                { period: "FY2025", value: 53.3, citationIndexes: [1], treatment: "included" },
              ],
              cagrResults: [],
              scenarioTable: [],
              forecastSets: [],
              assumptions: [],
              missingInputs: [],
            },
            activityLog: [
              {
                type: "status",
                payload: { stage: "context", message: "Preparing context", percent: 10 },
              },
            ],
          },
          createdAt: "2026-06-06T10:00:01Z",
        },
      ],
    };

    const messages = askAiSessionToMessages(session);

    expect(messages[0]).toMatchObject({ role: "user", text: "Why is it imbalanced?" });
    expect(messages[1]).toMatchObject({
      role: "ai",
      kind: "stream",
      done: true,
      final: {
        answer: "Cash is missing [1].",
        sessionId: "chat-1",
        warnings: ["citation_limited"],
        usage: { totalTokens: 192, inputTokens: 128, outputTokens: 64 },
        modelCitations: [{ index: 1, kind: "model", cellReference: "BS!D42" }],
        forecastAnalysis: {
          metric: "revenue",
          forecastHorizon: 5,
          historicalSeries: [
            { period: "FY2025", value: 53.3, citationIndexes: [1], treatment: "included" },
          ],
          cagrResults: [],
          scenarioTable: [],
          forecastSets: [],
          assumptions: [],
          missingInputs: [],
        },
      },
    });
  });

  it("ignores unsupported persisted roles", () => {
    const session: AskAiChatSessionResponse = {
      id: "chat-1",
      projectId: "project-1",
      projectLabel: null,
      companyName: null,
      title: null,
      routePath: null,
      screenName: null,
      messageCount: 1,
      createdAt: "2026-06-06T10:00:00Z",
      updatedAt: "2026-06-06T10:00:00Z",
      messages: [
        {
          id: "tool-1",
          role: "tool",
          content: "tool payload",
          routePath: null,
          screenName: null,
          citations: [],
          warnings: [],
          usage: {},
          retrievalSnapshot: {},
          createdAt: "2026-06-06T10:00:00Z",
        },
      ],
    };

    expect(askAiSessionToMessages(session)).toEqual([]);
  });
});
