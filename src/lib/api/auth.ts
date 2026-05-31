export const HUMAN_ROLES = ["finance_analyst", "finance_manager", "cfo", "admin"] as const;

export type HumanRole = (typeof HUMAN_ROLES)[number];

export type User = {
  id: string;
  email: string;
  name: string;
  role: HumanRole;
};

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = LoginPayload & {
  name: string;
  role: HumanRole;
};

export const roleOptions: Array<{ value: HumanRole; label: string; summary: string }> = [
  {
    value: "finance_analyst",
    label: "Finance Analyst",
    summary: "Runs source selection, extraction review, diagnosis, forecasting, and assumptions preparation.",
  },
  {
    value: "finance_manager",
    label: "Finance Manager",
    summary: "Initiates analysis requests and reviews model packs before CFO review.",
  },
  {
    value: "cfo",
    label: "CFO / Finance Director",
    summary: "Performs final read-only review and sign-off for the model and audit trail.",
  },
  {
    value: "admin",
    label: "Admin",
    summary: "Manages users, source registry settings, templates, and system configuration.",
  },
];

export const selfServiceRoleOptions = roleOptions.filter((option) => option.value !== "admin");

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status);
  }

  return response.json() as Promise<T>;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") {
      return body.detail;
    }
    if (Array.isArray(body.detail) && body.detail[0]?.msg) {
      return String(body.detail[0].msg);
    }
  } catch {
    // Fall back to status text below.
  }

  return response.statusText || "Request failed.";
}

export async function registerUser(payload: RegisterPayload): Promise<User> {
  return requestJson<User>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginUser(payload: LoginPayload): Promise<TokenResponse> {
  return requestJson<TokenResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getCurrentUser(accessToken: string): Promise<User> {
  return requestJson<User>("/api/auth/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
