import { clearAuthTokens, getAccessToken, getRefreshToken, setAuthTokens } from "@/lib/auth-store";
import { apiUrl } from "./config";
import { ApiError } from "./errors";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  rawBody?: BodyInit;
  skipAuthRetry?: boolean;
};

let refreshPromise: Promise<boolean> | null = null;

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetchWithAuthRetry(path, options);
  return parseResponse<T>(response);
}

export async function apiBlob(path: string): Promise<Blob> {
  const response = await fetchWithAuthRetry(path);
  if (!response.ok) {
    const payload = await safeJson(response);
    throw new ApiError(response.status, backendMessage(payload, response.status), payload);
  }
  return response.blob();
}

export async function apiStream(path: string, options: RequestOptions = {}): Promise<Response> {
  const response = await fetchWithAuthRetry(path, options);
  if (!response.ok) {
    const payload = await safeJson(response);
    throw new ApiError(response.status, backendMessage(payload, response.status), payload);
  }
  return response;
}

async function fetchWithAuthRetry(path: string, options: RequestOptions = {}): Promise<Response> {
  const response = await fetchWithAuth(path, options);
  if (!shouldRetryAuth(path, options, response)) return response;
  const refreshed = await refreshAccessTokenOnce();
  if (!refreshed) return response;
  return fetchWithAuth(path, { ...options, skipAuthRetry: true });
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

function shouldRetryAuth(path: string, options: RequestOptions, response: Response) {
  return response.status === 401 && !options.skipAuthRetry && !path.startsWith("/api/auth/");
}

async function refreshAccessTokenOnce(): Promise<boolean> {
  refreshPromise ??= refreshAccessToken().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
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
