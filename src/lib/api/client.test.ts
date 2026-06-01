import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAuthTokens, setAuthTokens } from "@/lib/auth-store";
import { apiFetch } from "./client";

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
});
