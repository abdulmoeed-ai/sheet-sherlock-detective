import { describe, expect, it } from "bun:test";
import {
  dashboardProjectStatusLabel,
  dashboardProjectStatusTone,
  isFinalApprovedStatus,
  projectStatusLabel,
} from "./project-status-workflow";

describe("project status workflow", () => {
  it("treats only approved as final approved", () => {
    expect(isFinalApprovedStatus("approved")).toBe(true);
    expect(isFinalApprovedStatus("cfo_review")).toBe(false);
  });

  it("keeps cfo_review as legacy wording instead of current happy path", () => {
    expect(projectStatusLabel("cfo_review")).toBe("Legacy CFO Review");
    expect(dashboardProjectStatusLabel("cfo_review")).toBe("Legacy CFO Review");
    expect(dashboardProjectStatusTone("cfo_review")).toBe("warning");
  });

  it("uses manager-final approval labels for current statuses", () => {
    expect(projectStatusLabel("manager_review")).toBe("Submitted to Manager");
    expect(projectStatusLabel("approved")).toBe("Approved");
    expect(dashboardProjectStatusLabel("approved")).toBe("Approved");
    expect(dashboardProjectStatusTone("approved")).toBe("success");
  });
});
