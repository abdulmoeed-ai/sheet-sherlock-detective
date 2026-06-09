// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
  askAiCompletionNotificationBody,
  shouldNotifyAskAiCompletion,
} from "./ask-ai-browser-notifications";

describe("ask-ai-browser-notifications", () => {
  it("notifies when the page is hidden or the panel is closed", () => {
    expect(shouldNotifyAskAiCompletion({ pageHidden: true, panelOpen: true })).toBe(true);
    expect(shouldNotifyAskAiCompletion({ pageHidden: false, panelOpen: false })).toBe(true);
    expect(shouldNotifyAskAiCompletion({ pageHidden: false, panelOpen: true })).toBe(false);
  });

  it("builds a concise body that identifies the completed chat", () => {
    expect(
      askAiCompletionNotificationBody({
        threadTitle: "Forecast assumptions",
        question: "Give me five year assumptions for Millat",
      }),
    ).toBe("Forecast assumptions: Give me five year assumptions for Millat");
  });
});
