import { describe, expect, it } from "vitest";
import { parseSseEvents } from "./ask-ai-stream";

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
});
