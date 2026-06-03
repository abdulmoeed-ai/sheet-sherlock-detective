import { describe, expect, it } from "vitest";
import type { WorkspaceResponse } from "@/lib/api/types";
import { auditRows, dashboardMetrics, reviewRows, workbookSheets } from "./workspace";

const emptyWorkspace = {
  documents: [],
  review: {},
  auditEvents: [],
  exportPreview: {},
  dashboard: {},
} satisfies Partial<WorkspaceResponse>;

describe("workspace mappers", () => {
  it("returns empty collections when optional backend sections are absent", () => {
    expect(reviewRows(emptyWorkspace)).toEqual([]);
    expect(workbookSheets(emptyWorkspace)).toEqual([]);
    expect(auditRows(emptyWorkspace)).toEqual([]);
    expect(dashboardMetrics(emptyWorkspace)).toEqual([]);
  });
});
