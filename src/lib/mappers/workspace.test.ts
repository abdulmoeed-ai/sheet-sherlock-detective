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

  it("prefers friendly audit messages while preserving payloads", () => {
    expect(
      auditRows({
        auditEvents: [
          {
            id: "audit-1",
            action: "diagnosis_baseline_replaced",
            message: "Diagnosis baseline replaced across 3 PDF(s)",
            actor: "system",
            createdAt: "2026-06-06T12:30:00+00:00",
            payload: { document_count: 3 },
          },
        ],
      }),
    ).toEqual([
      {
        id: "audit-1",
        timestamp: "2026-06-06T12:30:00+00:00",
        actor: "system",
        action: "Diagnosis baseline replaced across 3 PDF(s)",
        payload: { document_count: 3 },
      },
    ]);
  });
});
