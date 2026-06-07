// @vitest-environment jsdom

import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAskAiStream } from "./use-ask-ai-stream";

const askAiMock = vi.fn();
const askAiForecastMock = vi.fn();
const readAskAiSseStreamMock = vi.fn();

vi.mock("@/lib/api/projects", () => ({
  askAi: (...args: unknown[]) => askAiMock(...args),
  askAiForecast: (...args: unknown[]) => askAiForecastMock(...args),
}));

vi.mock("@/lib/api/ask-ai-stream", () => ({
  readAskAiSseStream: (...args: unknown[]) => readAskAiSseStreamMock(...args),
}));

describe("useAskAiStream", () => {
  beforeEach(() => {
    askAiMock.mockReset();
    askAiForecastMock.mockReset();
    readAskAiSseStreamMock.mockReset();
    askAiMock.mockResolvedValue(new Response(""));
    askAiForecastMock.mockResolvedValue(new Response(""));
    readAskAiSseStreamMock.mockResolvedValue({ answer: "ok" });
  });

  it("uses the forecast stream endpoint on the forecast route even when a project is selected", async () => {
    const { result } = renderHook(() => useAskAiStream("project-1"));

    await act(async () => {
      await result.current.sendQuestion({
        question: "Continue the forecast",
        routePath: "/forecast",
        sessionId: "chat-1",
      });
    });

    expect(askAiForecastMock).toHaveBeenCalledTimes(1);
    expect(askAiForecastMock).toHaveBeenCalledWith(
      {
        question: "Continue the forecast",
        routePath: "/forecast",
        sessionId: "chat-1",
      },
      {},
    );
    expect(askAiMock).not.toHaveBeenCalled();
  });

  it("uses the project stream endpoint on non-forecast routes when a project is selected", async () => {
    const { result } = renderHook(() => useAskAiStream("project-1"));

    await act(async () => {
      await result.current.sendQuestion({
        question: "Explain this model",
        routePath: "/diagnosis/project-1",
      });
    });

    expect(askAiMock).toHaveBeenCalledTimes(1);
    expect(askAiMock).toHaveBeenCalledWith(
      "project-1",
      {
        question: "Explain this model",
        routePath: "/diagnosis/project-1",
      },
      {},
    );
    expect(askAiForecastMock).not.toHaveBeenCalled();
  });
});
