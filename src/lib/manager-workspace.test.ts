import { describe, expect, test } from "bun:test";
import type { ProjectResponse } from "@/lib/api/types";
import {
  buildManagerDashboardCounts,
  buildManagerReviewQueue,
  managerProjectStatusLabel,
} from "@/lib/manager-workspace";

const project = (overrides: Partial<ProjectResponse>): ProjectResponse => ({
  id: "p1",
  companyName: "Lucky Cement Limited",
  sector: "Cement",
  fiscalYear: "FY2025",
  status: "manager_review",
  projectLabel: "FY2025 Annual Report Analysis",
  createdAt: "2026-06-01T10:00:00Z",
  updatedAt: "2026-06-07T10:00:00Z",
  currencyUnit: "PKR",
  template: "Cement - Template.xlsx",
  teamMembers: [],
  reviewProgress: { reviewed: 8, total: 10 },
  ...overrides,
});

describe("manager workspace", () => {
  test("builds queue from projects awaiting manager review", () => {
    const queue = buildManagerReviewQueue([
      project({ id: "awaiting", status: "manager_review" }),
      project({ id: "approved", status: "approved" }),
      project({ id: "draft", status: "draft" }),
    ]);

    expect(queue.map((item) => item.id)).toEqual(["awaiting"]);
    expect(queue[0].primaryAction).toBe("Review");
  });

  test("counts manager dashboard workload", () => {
    const counts = buildManagerDashboardCounts([
      project({ id: "a", status: "manager_review" }),
      project({ id: "b", status: "awaiting_review" }),
      project({ id: "c", status: "approved" }),
    ]);

    expect(counts.awaitingReview).toBe(1);
    expect(counts.sentBackOrAnalystWork).toBe(1);
    expect(counts.approvedWorkbooks).toBe(1);
  });

  test("uses manager-friendly labels", () => {
    expect(managerProjectStatusLabel("manager_review")).toBe("Awaiting Manager Review");
    expect(managerProjectStatusLabel("approved")).toBe("Approved");
    expect(managerProjectStatusLabel("cfo_review")).toBe("Manager Review");
  });
});
