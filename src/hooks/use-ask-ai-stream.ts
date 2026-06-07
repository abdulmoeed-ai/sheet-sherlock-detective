import { useCallback, useState } from "react";
import { askAi, askAiForecast } from "@/lib/api/projects";
import {
  readAskAiSseStream,
  type AskAiFinalResponse,
  type AskAiStreamCallbacks,
} from "@/lib/api/ask-ai-stream";

export function useAskAiStream(projectId: string | null) {
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendQuestion = useCallback(
    async (
      input: Record<string, unknown>,
      options: AskAiStreamCallbacks = {},
      requestOptions: { signal?: AbortSignal; projectIdOverride?: string | null } = {},
    ): Promise<AskAiFinalResponse | null> => {
      const effectiveProjectId = requestOptions.projectIdOverride ?? projectId;
      const routePath = typeof input.routePath === "string" ? input.routePath : null;
      const useForecastRoute = !effectiveProjectId && routePath === "/forecast";
      if (!effectiveProjectId) {
        if (!useForecastRoute) {
          setError("Select a project before using Ask AI.");
          return null;
        }
      }
      setLoading(true);
      setError(null);
      setAnswer("");
      try {
        const response = useForecastRoute
          ? await askAiForecast(input, requestOptions)
          : await askAi(effectiveProjectId as string, input, requestOptions);
        return await readAskAiSseStream(response, {
          ...options,
          onChunk: (nextAnswer) => {
            setAnswer(nextAnswer);
            options.onChunk?.(nextAnswer);
          },
          onError: (event) => {
            setError(event.message);
            options.onError?.(event);
          },
        });
      } catch (err) {
        if (requestOptions.signal?.aborted) {
          return null;
        }
        const message = err instanceof Error ? err.message : "Ask AI request failed.";
        setError(message);
        options.onError?.({ message, code: "request_failed" });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [projectId],
  );

  return { answer, error, loading, sendQuestion };
}
