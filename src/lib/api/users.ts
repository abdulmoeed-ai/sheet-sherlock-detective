import { apiFetch } from "./client";

export interface AnalystItem {
  email: string;
  name: string;
}

export interface PsxCompany {
  name: string;
  symbol: string;
  sector: string;
}

export function listAnalysts() {
  return apiFetch<AnalystItem[]>("/api/users/analysts");
}

export function listPsxCompanies() {
  return apiFetch<PsxCompany[]>("/api/psx/companies");
}
