import type { ProjectResponse } from "@/lib/api/types";
import { isFinalApprovedStatus } from "@/lib/project-status-workflow";

export type ManagerQueueItem = {
  id: string;
  companyName: string;
  sector: string;
  fiscalYear: string;
  status: string;
  statusLabel: string;
  updatedAt: string;
  projectLabel: string;
  reviewed: number;
  total: number;
  readinessLabel: string;
  primaryAction: "Review" | "Open";
};

const ANALYST_WORK_STATUSES = new Set([
  "initiated",
  "draft",
  "documents_uploaded",
  "extracting",
  "awaiting_review",
  "in_diagnosis",
  "extraction_failed",
]);

export function managerProjectStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    initiated: "Initiated",
    draft: "Draft",
    documents_uploaded: "Documents Uploaded",
    extracting: "Extracting",
    awaiting_review: "With Analyst",
    in_diagnosis: "In Diagnosis",
    extraction_failed: "Extraction Failed",
    manager_review: "Awaiting Manager Review",
    approved: "Approved",
    cfo_review: "Manager Review",
    cfo_changes_requested: "Changes Requested",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

export function buildManagerReviewQueue(projects: ProjectResponse[]): ManagerQueueItem[] {
  return projects
    .filter((project) => project.status === "manager_review")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((project) => {
      const reviewed = project.reviewProgress?.reviewed ?? 0;
      const total = project.reviewProgress?.total ?? 0;
      const complete = total > 0 && reviewed >= total;

      return {
        id: project.id,
        companyName: project.companyName,
        sector: project.sector ?? "Unassigned sector",
        fiscalYear: project.fiscalYear ?? "Current period",
        status: project.status,
        statusLabel: managerProjectStatusLabel(project.status),
        updatedAt: project.updatedAt,
        projectLabel: project.projectLabel ?? "Workbook review",
        reviewed,
        total,
        readinessLabel: complete
          ? "Ready to approve"
          : `${reviewed}/${total || "?"} fields reviewed`,
        primaryAction: "Review",
      };
    });
}

export function buildManagerDashboardCounts(projects: ProjectResponse[]) {
  return {
    awaitingReview: projects.filter((project) => project.status === "manager_review").length,
    sentBackOrAnalystWork: projects.filter((project) => ANALYST_WORK_STATUSES.has(project.status))
      .length,
    approvedWorkbooks: projects.filter((project) => isFinalApprovedStatus(project.status)).length,
  };
}
