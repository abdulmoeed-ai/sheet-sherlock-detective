import type {
  AskAiFinalResponse,
  AskAiSourceEvent,
  AskAiStatusEvent,
} from "@/lib/api/ask-ai-stream";
import type { StreamActivityEvent } from "@/lib/ask-ai-reasoning";

export type AskAiMsg =
  | { id: string; role: "user"; text: string; attachment?: { name: string; size: string } }
  | { id: string; role: "ai"; kind: "text"; text: string }
  | {
      id: string;
      role: "ai";
      kind: "stream";
      text: string;
      activity: StreamActivityEvent[];
      approaches: string[];
      final?: AskAiFinalResponse;
      done: boolean;
      error?: string | null;
    }
  | { id: string; role: "ai"; kind: "status"; steps: string[] };

export type AskAiLiveEvent = AskAiStatusEvent | AskAiSourceEvent | { summary: string };
