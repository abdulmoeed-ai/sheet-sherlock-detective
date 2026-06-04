import { apiFetch } from "./client";
import type { BackendRole, TokenResponse, UserRead } from "./types";

export function registerUser(input: {
  email: string;
  name: string;
  password: string;
  role: Extract<BackendRole, "finance_analyst" | "finance_manager" | "cfo">;
}) {
  return apiFetch<UserRead>("/api/auth/register", { method: "POST", body: input });
}

export function loginUser(input: { email: string; password: string }) {
  return apiFetch<TokenResponse>("/api/auth/login", { method: "POST", body: input });
}

export function refreshToken(refreshToken: string) {
  return apiFetch<TokenResponse>("/api/auth/refresh", {
    method: "POST",
    body: { refresh_token: refreshToken },
  });
}

export function readCurrentUser() {
  return apiFetch<UserRead>("/api/auth/me");
}
