export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function wsUrl(path: string): string {
  const base = new URL(API_BASE_URL);
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  base.pathname = path.startsWith("/") ? path : `/${path}`;
  base.search = "";
  return base.toString();
}
