import type { APIRequestContext } from "@playwright/test";
import { expect } from "@playwright/test";
import { API_BASE_URL, PASSWORD, RUN_ID } from "./constants";

export type HumanRole = "finance_analyst" | "finance_manager" | "cfo" | "admin";

export type User = {
  id: string;
  email: string;
  name: string;
  role: HumanRole;
};

export type Tokens = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type RoleSession = {
  user: User;
  tokens: Tokens;
};

export function emailFor(role: string): string {
  return `sheet-sherlock-${role}-${RUN_ID}@example.com`;
}

export async function registerAndLogin(
  request: APIRequestContext,
  input: { role: Exclude<HumanRole, "admin">; name: string; email?: string },
): Promise<RoleSession> {
  const email = input.email ?? emailFor(input.role);
  const register = await request.post(`${API_BASE_URL}/api/auth/register`, {
    data: {
      email,
      name: input.name,
      password: PASSWORD,
      role: input.role,
    },
  });
  expect([201, 409]).toContain(register.status());

  const login = await request.post(`${API_BASE_URL}/api/auth/login`, {
    data: { email, password: PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const tokens = (await login.json()) as Tokens;
  const me = await request.get(`${API_BASE_URL}/api/auth/me`, {
    headers: authHeaders(tokens.access_token),
  });
  expect(me.ok()).toBeTruthy();
  return { user: (await me.json()) as User, tokens };
}

export async function loginExisting(
  request: APIRequestContext,
  input: { email: string; password: string },
): Promise<RoleSession> {
  const login = await request.post(`${API_BASE_URL}/api/auth/login`, {
    data: input,
  });
  expect(login.ok()).toBeTruthy();
  const tokens = (await login.json()) as Tokens;
  const me = await request.get(`${API_BASE_URL}/api/auth/me`, {
    headers: authHeaders(tokens.access_token),
  });
  expect(me.ok()).toBeTruthy();
  return { user: (await me.json()) as User, tokens };
}

export function authHeaders(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

export async function expectOk(response: { ok(): boolean; status(): number; text(): Promise<string> }): Promise<void> {
  if (!response.ok()) {
    throw new Error(`Expected OK response, got ${response.status()}: ${await response.text()}`);
  }
}
