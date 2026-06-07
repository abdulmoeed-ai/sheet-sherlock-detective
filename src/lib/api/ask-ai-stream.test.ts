import { describe, expect, it } from "vitest";
import { parseSseEvents, readAskAiSseStream } from "./ask-ai-stream";

describe("parseSseEvents", () => {
  it("parses named backend Ask AI SSE events", () => {
    const events = parseSseEvents([
      'event: status\ndata: {"stage":"context","message":"Preparing project context","percent":10}\n\n',
      'event: token\ndata: {"delta":"Revenue increased"}\n\n',
    ]);

    expect(events).toEqual([
      {
        type: "status",
        payload: {
          stage: "context",
          message: "Preparing project context",
          percent: 10,
        },
      },
      {
        type: "token",
        payload: {
          delta: "Revenue increased",
        },
      },
    ]);
  });

  it("supports SSE data split across chunks", () => {
    const events = parseSseEvents([
      'event: source\ndata: {"kind":"model",',
      '"message":"Found accepted model fields","count":2,"items":[]}\n\n',
    ]);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "source",
      payload: { kind: "model", count: 2 },
    });
  });

  it("returns the final Ask AI response after finalizing status and token events", async () => {
    const finalPayload = {
      answer: "Three-year forecast uses model history and approved sources [1] [2].",
      sourcesUsed: [
        { index: 1, kind: "model", cellReference: "PL7!F14" },
        { index: 2, kind: "source", sourceName: "Pakistan Stock Exchange" },
      ],
      modelCitations: [{ index: 1, kind: "model", cellReference: "PL7!F14" }],
      sourceCitations: [{ index: 2, kind: "source", sourceName: "Pakistan Stock Exchange" }],
      warnings: ["prompt_guardrail_exceeded"],
      usage: { provider: "gemini" },
      activityLog: [],
      forecastVisuals: {
        confidence: "Medium",
        assumptionPills: ["Demand recovery"],
        riskCallouts: [{ label: "Margin pressure", severity: "Medium" }],
        chartSeries: [
          {
            id: "revenue-trend",
            title: "Revenue trend",
            metric: "revenue",
            points: [{ label: "FY2025", value: 10 }],
          },
        ],
      },
      claimSourceGroups: [{ claimId: "demand-recovery", citationIndexes: [1, 2] }],
      tavilyQuestions: ["What is the latest MTL demand outlook?"],
    };
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(
            [
              'event: status\ndata: {"stage":"llm","message":"Drafting cited answer","percent":70}\n\n',
              'event: token\ndata: {"delta":"Draft answer"}\n\n',
              'event: status\ndata: {"stage":"finalizing","message":"Finalizing citations","percent":95}\n\n',
              `event: final\ndata: ${JSON.stringify(finalPayload)}\n\n`,
            ].join(""),
          ),
        );
        controller.close();
      },
    });
    const finalEvents: unknown[] = [];
    const statuses: string[] = [];

    const result = await readAskAiSseStream(
      new Response(stream, { headers: { "Content-Type": "text/event-stream" } }),
      {
        onStatus: (event) => statuses.push(event.stage),
        onFinal: (event) => finalEvents.push(event),
      },
    );

    expect(statuses).toEqual(["llm", "finalizing"]);
    expect(finalEvents).toEqual([finalPayload]);
    expect(result).toEqual(finalPayload);
  });

  it("rejects non-streaming JSON Ask AI responses", async () => {
    await expect(
      readAskAiSseStream(
        new Response(JSON.stringify({ answer: "Full response" }), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ).rejects.toThrow("Ask AI requires a streaming response.");
  });

  it("treats backend error events as terminal and ignores later stream frames", async () => {
    const encoder = new TextEncoder();
    const finalPayload = {
      answer: "This answer should not render.",
      sourcesUsed: [],
      modelCitations: [],
      sourceCitations: [],
      warnings: [],
      usage: {},
    };
    let pullCount = 0;
    const stream = new ReadableStream({
      pull(controller) {
        pullCount += 1;
        if (pullCount === 1) {
          controller.enqueue(
            encoder.encode(
              'event: error\ndata: {"message":"Approved web search timed out.","code":"external_search_unavailable"}\n\n',
            ),
          );
          return;
        }
        controller.enqueue(encoder.encode(`event: final\ndata: ${JSON.stringify(finalPayload)}\n\n`));
        controller.close();
      },
    });
    const errors: string[] = [];
    const finals: unknown[] = [];

    const result = await readAskAiSseStream(
      new Response(stream, { headers: { "Content-Type": "text/event-stream" } }),
      {
        onError: (event) => errors.push(event.message),
        onFinal: (event) => finals.push(event),
      },
    );

    expect(result).toBeNull();
    expect(errors).toEqual(["Approved web search timed out."]);
    expect(finals).toEqual([]);
  });
});
