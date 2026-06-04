import { apiFetch } from "./client";

export interface SourceRegistryResponse {
  sources: Array<Record<string, unknown>>;
}

export function readSourceRegistry() {
  return apiFetch<SourceRegistryResponse>("/api/source-registry");
}
