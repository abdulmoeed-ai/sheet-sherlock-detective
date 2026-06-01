export const API_BASE_URL = process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:8000";
export const APP_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8080";
export const RUN_ID = process.env.PLAYWRIGHT_RUN_ID ?? `${Date.now()}`;
export const PASSWORD = "correct-horse-battery-staple";

export const MILLAT_COMPANY = "Millat Tractors Limited";
export const MILLAT_TICKER = "MTL";
export const MILLAT_SECTOR = "Industrial Engineering";
export const MILLAT_PERIOD = "FY2025";
export const MILLAT_FISCAL_YEAR = "2025";
export const MILLAT_PDF = "../backend_code/sample_docs/Millat - 2025.pdf";

export const STORAGE_DIR = "e2e/.auth";
export const STATE_FILE = "e2e/.auth/e2e-state.json";

export type RoleKey = "manager" | "analyst" | "cfo" | "admin";

export const ROLE_STORAGE: Record<RoleKey, string> = {
  manager: `${STORAGE_DIR}/manager.json`,
  analyst: `${STORAGE_DIR}/analyst.json`,
  cfo: `${STORAGE_DIR}/cfo.json`,
  admin: `${STORAGE_DIR}/admin.json`,
};
