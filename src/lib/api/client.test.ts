import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAuthTokens, setAuthTokens } from "@/lib/auth-store";
import { apiBlob, apiFetch, apiStream } from "./client";

describe("apiFetch", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    clearAuthTokens();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it("adds a bearer token when one is stored", async () => {
    setAuthTokens({ accessToken: "access-1", refreshToken: "refresh-1" });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await apiFetch<{ ok: boolean }>("/api/projects");

    expect(new Headers(fetchMock.mock.calls[0][1].headers).get("Authorization")).toBe(
      "Bearer access-1",
    );
  });

  it("throws the backend detail string when the backend returns an error", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ detail: "Only PDF files are supported." }), { status: 400 }),
      ) as unknown as typeof fetch;

    await expect(apiFetch("/api/projects/p1/documents")).rejects.toMatchObject({
      status: 400,
      message: "Only PDF files are supported.",
    });
  });

  it("refreshes an expired access token and retries JSON requests once", async () => {
    setAuthTokens({ accessToken: "expired-access", refreshToken: "refresh-1" });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "Could not validate credentials." }), { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-2", refresh_token: "refresh-2" }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(apiFetch<{ ok: boolean }>("/api/projects")).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get("Authorization")).toBe("Bearer expired-access");
    expect(fetchMock.mock.calls[1][0]).toContain("/api/auth/refresh");
    expect(new Headers(fetchMock.mock.calls[2][1].headers).get("Authorization")).toBe("Bearer access-2");
  });

  it("does not recursively refresh auth endpoints", async () => {
    setAuthTokens({ accessToken: "expired-access", refreshToken: "refresh-1" });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ detail: "Invalid credentials." }), { status: 401 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(apiFetch("/api/auth/login", { method: "POST", body: {} })).rejects.toMatchObject({
      status: 401,
      message: "Invalid credentials.",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes and retries blob downloads", async () => {
    setAuthTokens({ accessToken: "expired-access", refreshToken: "refresh-1" });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "Expired" }), { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-2", refresh_token: "refresh-2" }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response("xlsx-bytes", { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const blob = await apiBlob("/api/projects/p1/exports/e1/download");

    expect(await blob.text()).toBe("xlsx-bytes");
    expect(new Headers(fetchMock.mock.calls[2][1].headers).get("Authorization")).toBe("Bearer access-2");
  });

  it("refreshes and retries streaming requests", async () => {
    setAuthTokens({ accessToken: "expired-access", refreshToken: "refresh-1" });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "Expired" }), { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-2", refresh_token: "refresh-2" }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response("event: final\ndata: {}\n\n", { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await apiStream("/api/projects/p1/ask-ai", {
      method: "POST",
      body: { question: "Why?" },
    });

    expect(await response.text()).toContain("event: final");
    expect(new Headers(fetchMock.mock.calls[2][1].headers).get("Authorization")).toBe("Bearer access-2");
  });

  it("coalesces simultaneous refresh attempts", async () => {
    setAuthTokens({ accessToken: "expired-access", refreshToken: "refresh-1" });
    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      const path = String(url);
      if (path.includes("/api/auth/refresh")) {
        return Promise.resolve(
          new Response(JSON.stringify({ access_token: "access-2", refresh_token: "refresh-2" }), { status: 200 }),
        );
      }
      if (fetchMock.mock.calls.length <= 2) {
        return Promise.resolve(new Response(JSON.stringify({ detail: "Expired" }), { status: 401 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await Promise.all([apiFetch("/api/projects"), apiFetch("/api/analysis-requests")]);

    const refreshCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/auth/refresh"));
    expect(refreshCalls).toHaveLength(1);
  });
});
