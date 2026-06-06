const LEGACY_ASK_AI_CHAT_HISTORY_KEY = "ask-ai-chat-history";

export function clearLegacyAskAiChatHistoryStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEGACY_ASK_AI_CHAT_HISTORY_KEY);
  } catch {
    // Ignore storage failures; backend-backed chat sessions are the source of truth.
  }
}
