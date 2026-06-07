import { describe, expect, it } from "vitest";
import { markAskAiStreamStopped } from "./ask-ai-stop";
import type { AskAiMsg } from "./ask-ai-message-types";

describe("markAskAiStreamStopped", () => {
  it("keeps partial streamed text and marks only the active response as stopped", () => {
    const messages: AskAiMsg[] = [
      { id: "u-1", role: "user", text: "What is revenue?" },
      {
        id: "a-active",
        role: "ai",
        kind: "stream",
        text: "Revenue grew",
        activity: [],
        approaches: [],
        done: false,
      },
      {
        id: "a-other",
        role: "ai",
        kind: "stream",
        text: "Already done",
        activity: [],
        approaches: [],
        done: true,
      },
    ];

    expect(markAskAiStreamStopped(messages, "a-active")).toEqual([
      messages[0],
      {
        ...messages[1],
        done: true,
        error: "Stopped by user.",
      },
      messages[2],
    ]);
  });
});
