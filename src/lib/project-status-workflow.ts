const ACTIVE_STATUSES = new Set([
  "draft",
  "setup",
  "created",
  "documents_uploaded",
  "extracting",
  "extraction_failed",
  "ready_for_diagnosis",
  "in_diagnosis",
  "awaiting_review",
  "manager_changes_requested",
  "cfo_changes_requested",
]);

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  setup: "Draft",
  created: "Draft",
  documents_uploaded: "Documents Uploaded",
  extracting: "Extracting",
  extraction_failed: "Extraction Failed",
  ready_for_diagnosis: "Ready for Diagnosis",
  in_diagnosis: "In Diagnosis",
  awaiting_review: "Ready for Diagnosis",
  manager_changes_requested: "Manager Changes Requested",
  manager_review: "Submitted to Manager",
  cfo_review: "Legacy CFO Review",
  cfo_changes_requested: "Legacy CFO Changes Requested",
  approved: "Approved",
};

export type ProjectStatusTone = "success" | "warning" | "info" | "neutral";
export type DashboardProjectStatusTone = ProjectStatusTone | "danger" | "ai";

export function isActiveProjectStatus(status: string) {
  return ACTIVE_STATUSES.has(status);
}

export function isFinalApprovedStatus(status: string) {
  return status === "approved";
}

export function projectStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.toUpperCase().replace(/_/g, " ");
}

export function projectStatusTone(status: string): ProjectStatusTone {
  if (status === "approved") return "success";
  if (status === "extraction_failed") return "warning";
  if (
    status === "draft" ||
    status === "setup" ||
    status === "created" ||
    status === "documents_uploaded"
  )
    return "info";
  if (
    status.includes("review") ||
    status === "ready_for_diagnosis" ||
    status === "in_diagnosis" ||
    status === "manager_changes_requested" ||
    status === "cfo_changes_requested"
  )
    return "warning";
  return "neutral";
}

export function dashboardProjectStatusLabel(status: string): string {
  if (status === "extracting") return "Extraction in Progress";
  return projectStatusLabel(status);
}

export function dashboardProjectStatusTone(status: string): DashboardProjectStatusTone {
  if (status === "approved") return "success";
  if (status === "cfo_review") return "warning";
  if (status.includes("failed") || status.includes("changes_requested")) return "danger";
  if (status === "extracting" || status.includes("review") || status.includes("diagnosis")) {
    return "info";
  }
  if (status === "documents_uploaded") return "ai";
  return "warning";
}
