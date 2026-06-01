// Mock Model Registry — Phase 0b silent lookup + version timeline.
// Versioning scheme: [TICKER]_[FY]_v[N].

export type RegistryStatus = "draft" | "in-review" | "approved" | "locked";

export interface ModelVersion {
  id: string;          // e.g. MTL_FY2025_v1
  ticker: string;
  fy: string;
  version: number;
  status: RegistryStatus;
  completeness: number; // 0–100
  lastEditedBy: string;
  lastEditedAt: string;
}

const seed: ModelVersion[] = [
  { id: "MTL_FY2025_v1", ticker: "MTL", fy: "FY2025", version: 1, status: "draft", completeness: 62, lastEditedBy: "Ayesha S.", lastEditedAt: "2026-05-19 16:04" },
  { id: "MTL_FY2024_v3", ticker: "MTL", fy: "FY2024", version: 3, status: "approved", completeness: 100, lastEditedBy: "Bilal R. (CFO)", lastEditedAt: "2025-09-12 11:21" },
  { id: "MTL_FY2024_v2", ticker: "MTL", fy: "FY2024", version: 2, status: "locked", completeness: 100, lastEditedBy: "Bilal R. (CFO)", lastEditedAt: "2025-09-10 09:45" },
  { id: "MTL_FY2024_v1", ticker: "MTL", fy: "FY2024", version: 1, status: "locked", completeness: 100, lastEditedBy: "Ayesha S.", lastEditedAt: "2025-09-02 14:12" },
  { id: "MCB_FY2024_v2", ticker: "MCB", fy: "FY2024", version: 2, status: "in-review", completeness: 94, lastEditedBy: "Hira T.", lastEditedAt: "2026-04-30 17:50" },
  { id: "EFERT_FY2024_v1", ticker: "EFERT", fy: "FY2024", version: 1, status: "approved", completeness: 100, lastEditedBy: "Bilal R. (CFO)", lastEditedAt: "2025-11-04 10:00" },
];

export const modelRegistry = {
  all: () => seed.slice().sort((a, b) => b.lastEditedAt.localeCompare(a.lastEditedAt)),
  forCompany: (ticker: string) =>
    seed.filter((v) => v.ticker === ticker).sort((a, b) => b.version - a.version),
  lookup: (ticker: string, fy: string) =>
    seed.filter((v) => v.ticker === ticker && v.fy === fy).sort((a, b) => b.version - a.version),
};

export function statusLabel(s: RegistryStatus): string {
  return s === "in-review" ? "In Review" : s.charAt(0).toUpperCase() + s.slice(1);
}
export function statusTone(s: RegistryStatus): "neutral" | "warning" | "success" | "info" {
  return s === "approved" || s === "locked"
    ? "success"
    : s === "in-review"
    ? "warning"
    : "info";
}
