import { describe, expect, it } from "vitest";

import { clearLegacyAskAiChatHistoryStorage } from "./ask-ai-storage";

describe("clearLegacyAskAiChatHistoryStorage", () => {
  it("removes the old local Ask AI chat history key", () => {
    window.localStorage.setItem("ask-ai-chat-history", "[]");
    window.localStorage.setItem("sheet_sherlock_selected_project_id", "project-1");

    clearLegacyAskAiChatHistoryStorage();

    expect(window.localStorage.getItem("ask-ai-chat-history")).toBeNull();
    expect(window.localStorage.getItem("sheet_sherlock_selected_project_id")).toBe("project-1");
  });
});
