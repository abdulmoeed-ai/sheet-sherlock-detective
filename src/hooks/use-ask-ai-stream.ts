import { useCallback, useState } from "react";
import { askAi } from "@/lib/api/projects";

interface SendQuestionOptions {
  onChunk?: (answer: string) => void;
}

export function useAskAiStream(projectId: string | null) {
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendQuestion = useCallback(
    async (input: Record<string, unknown>, options: SendQuestionOptions = {}) => {
      if (!projectId) {
        setError("Select a project before using Ask AI.");
        return "";
      }
      setLoading(true);
      setError(null);
      setAnswer("");
      try {
        const response = await askAi(projectId, input);
        const reader = response.body?.getReader();
        if (!reader) return "";
        const decoder = new TextDecoder();
        let full = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          full += chunk;
          setAnswer(full);
          options.onChunk?.(full);
        }
        return full;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Ask AI request failed.";
        setError(message);
        return "";
      } finally {
        setLoading(false);
      }
    },
    [projectId],
  );

  return { answer, error, loading, sendQuestion };
}
