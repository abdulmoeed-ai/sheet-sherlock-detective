import { beforeEach, describe, expect, it, vi } from "vitest";
import { askAiForecast } from "./projects";

describe("askAiForecast", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it("streams forecast chat requests without a project id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("event: final\ndata: {}\n\n"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await askAiForecast({ question: "Forecast cement sector margins", routePath: "/forecast" });

    expect(fetchMock.mock.calls[0][0]).toContain("/api/ask-ai/forecast");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
  });
});
