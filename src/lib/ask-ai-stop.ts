import type { AskAiMsg } from "./ask-ai-message-types";

export function markAskAiStreamStopped(messages: AskAiMsg[], streamId: string | null): AskAiMsg[] {
  if (!streamId) return messages;
  return messages.map((message) => {
    if (message.id !== streamId || message.role !== "ai" || message.kind !== "stream" || message.done) {
      return message;
    }
    return {
      ...message,
      done: true,
      error: "Stopped by user.",
    };
  });
}
