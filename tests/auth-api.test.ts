import { afterEach, describe, expect, it } from "bun:test";
import { getCurrentUser, loginUser, registerUser } from "../src/lib/api/auth";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("auth api client", () => {
  it("sends role when registering a user", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: "user-1",
            email: "analyst@example.com",
            name: "Analyst",
            role: "finance_manager",
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        ),
      );
    }) as typeof fetch;

    const user = await registerUser({
      email: "analyst@example.com",
      name: "Analyst",
      password: "correct-horse-battery-staple",
      role: "finance_manager",
    });

    expect(user.role).toBe("finance_manager");
    expect(requests[0].url).toEndWith("/api/auth/register");
    expect(JSON.parse(String(requests[0].init?.body))).toEqual({
      email: "analyst@example.com",
      name: "Analyst",
      password: "correct-horse-battery-staple",
      role: "finance_manager",
    });
  });

  it("uses bearer auth for current user lookup", async () => {
    let authorizationHeader: string | undefined;
    globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
      authorizationHeader = (init?.headers as Record<string, string>).Authorization;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: "user-1",
            email: "cfo@example.com",
            name: "CFO",
            role: "cfo",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    }) as typeof fetch;

    const user = await getCurrentUser("access-token");

    expect(user.role).toBe("cfo");
    expect(authorizationHeader).toBe("Bearer access-token");
  });

  it("surfaces backend auth errors", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(JSON.stringify({ detail: "Invalid email or password." }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      )) as typeof fetch;

    await expect(loginUser({ email: "analyst@example.com", password: "bad-password" })).rejects.toThrow(
      "Invalid email or password.",
    );
  });
});
