import type { TokenResponse, User } from "@/lib/api/auth";

const ACCESS_TOKEN_KEY = "sheet_sherlock_access_token";
const REFRESH_TOKEN_KEY = "sheet_sherlock_refresh_token";
const USER_KEY = "sheet_sherlock_user";

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: User;
};

export function loadSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
  const userJson = window.localStorage.getItem(USER_KEY);
  if (!accessToken || !refreshToken || !userJson) {
    return null;
  }

  try {
    return {
      accessToken,
      refreshToken,
      user: JSON.parse(userJson) as User,
    };
  } catch {
    clearSession();
    return null;
  }
}

export function saveSession(tokens: TokenResponse, user: User): AuthSession {
  const session = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    user,
  };

  window.localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  return session;
}

export function clearSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}
