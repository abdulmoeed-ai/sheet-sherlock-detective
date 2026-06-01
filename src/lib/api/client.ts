import { clearAuthTokens, getAccessToken, getRefreshToken, setAuthTokens } from "@/lib/auth-store";
import { apiUrl } from "./config";
import { ApiError } from "./errors";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  rawBody?: BodyInit;
  skipAuthRetry?: boolean;
};

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetchWithAuth(path, options);
  if (!response.ok && response.status === 401 && !options.skipAuthRetry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const retry = await fetchWithAuth(path, { ...options, skipAuthRetry: true });
      return parseResponse<T>(retry);
    }
  }
  return parseResponse<T>(response);
}

export async function apiBlob(path: string): Promise<Blob> {
  const response = await fetchWithAuth(path);
  if (!response.ok) {
    const payload = await safeJson(response);
    throw new ApiError(response.status, backendMessage(payload, response.status), payload);
  }
  return response.blob();
}

export async function apiStream(path: string, options: RequestOptions = {}): Promise<Response> {
  const response = await fetchWithAuth(path, options);
  if (!response.ok) {
    const payload = await safeJson(response);
    throw new ApiError(response.status, backendMessage(payload, response.status), payload);
  }
  return response;
}

async function fetchWithAuth(path: string, options: RequestOptions = {}): Promise<Response> {
  const token = getAccessToken();
  const hasFormBody = options.rawBody instanceof FormData;
  const headers: Record<string, string> = {
    ...(hasFormBody ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string> | undefined),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(apiUrl(path), {
    ...options,
    headers,
    body:
      options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
  });
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await safeJson(response);
    throw new ApiError(response.status, backendMessage(payload, response.status), payload);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  const response = await fetch(apiUrl("/api/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) {
    clearAuthTokens();
    return false;
  }
  const payload = (await response.json()) as { access_token: string; refresh_token: string };
  setAuthTokens({ accessToken: payload.access_token, refreshToken: payload.refresh_token });
  return true;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function backendMessage(payload: unknown, status: number): string {
  if (!isRecord(payload)) return `Request failed with ${status}`;
  const detail = payload.detail;
  if (typeof detail === "string") return detail;
  if (isRecord(detail) && typeof detail.message === "string") return detail.message;
  return `Request failed with ${status}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
