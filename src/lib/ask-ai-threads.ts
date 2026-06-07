import type { AskAiChatSessionResponse } from "@/lib/api/types";
import type { AskAiFinalResponse } from "@/lib/api/ask-ai-stream";
import type { AskAiMsg } from "@/lib/ask-ai-message-types";
import type { StreamActivityEvent } from "@/lib/ask-ai-reasoning";

export function askAiSessionToMessages(session: AskAiChatSessionResponse): AskAiMsg[] {
  return session.messages
    .map((message): AskAiMsg | null => {
      if (message.role === "user") {
        return { id: message.id, role: "user", text: message.content };
      }
      if (message.role === "assistant") {
        const snapshot = message.retrievalSnapshot ?? {};
        return {
          id: message.id,
          role: "ai",
          kind: "stream",
          text: message.content,
          activity: activityFromSnapshot(snapshot),
          approaches: [],
          done: true,
          final: {
            answer: message.content,
            sessionId: session.id,
            sourcesUsed: arrayValue(snapshot.sourcesUsed),
            modelCitations: arrayValue(snapshot.modelCitations),
            sourceCitations: arrayValue(snapshot.sourceCitations),
            warnings: message.warnings,
            usage: message.usage,
            activityLog: arrayValue(snapshot.activityLog),
            forecastVisuals:
              (recordOrNull(snapshot.forecastVisuals) as AskAiFinalResponse["forecastVisuals"]) ??
              null,
            forecastAnalysis:
              (recordOrNull(snapshot.forecastAnalysis) as AskAiFinalResponse["forecastAnalysis"]) ??
              null,
            claimSourceGroups: arrayValue(
              snapshot.claimSourceGroups,
            ) as AskAiFinalResponse["claimSourceGroups"],
            tavilyQuestions: stringArrayValue(snapshot.tavilyQuestions),
          },
        };
      }
      return null;
    })
    .filter((message): message is AskAiMsg => message !== null);
}

function activityFromSnapshot(snapshot: Record<string, unknown>): StreamActivityEvent[] {
  const activity = arrayValue(snapshot.activityLog);
  return activity.flatMap((entry) => {
    const type = entry.type;
    const payload = recordOrNull(entry.payload);
    if (!payload) return [];
    if (type === "status") {
      return [
        {
          type: "status" as const,
          stage: String(payload.stage ?? "status"),
          message: String(payload.message ?? ""),
          percent: typeof payload.percent === "number" ? payload.percent : 100,
        },
      ];
    }
    if (type === "source") {
      return [
        {
          type: "source" as const,
          kind: String(payload.kind ?? "source"),
          message: String(payload.message ?? ""),
          count: typeof payload.count === "number" ? payload.count : 0,
          items: arrayValue(payload.items),
          queries: stringArrayValue(payload.queries),
        },
      ];
    }
    return [];
  });
}

function arrayValue(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
