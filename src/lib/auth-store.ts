const ACCESS_KEY = "sheet_sherlock_access_token";
const REFRESH_KEY = "sheet_sherlock_refresh_token";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function setAuthTokens(tokens: AuthTokens): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  window.localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
}

export function clearAuthTokens(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}
