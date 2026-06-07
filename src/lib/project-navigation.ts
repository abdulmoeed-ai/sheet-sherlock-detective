import type { BackendRole } from "@/lib/api/types";

const INGESTION_STATUSES = new Set([
  "draft",
  "created",
  "setup",
  "documents_uploaded",
  "extracting",
  "extraction_failed",
]);

export type ProjectOpenTarget = "ingestion" | "diagnosis" | "review";

export function projectOpenTarget({
  role,
  status,
}: {
  role: BackendRole;
  status: string;
}): ProjectOpenTarget {
  if (INGESTION_STATUSES.has(status)) return "ingestion";
  return "diagnosis";
}
