import { describe, expect, it } from "vitest";
import {
  ADD_DOCUMENTS_RERUN_DISCLOSURE,
  buildBaselineRefreshSummary,
  buildDiagnosisDocumentSelection,
  canConfirmDiagnosisDocumentRerun,
  canStartDiagnosisBaselineRefresh,
  filesPendingDiagnosisUpload,
  isDiagnosisBaselineRefreshLocked,
} from "./diagnosis-add-documents";

describe("diagnosis add-document helpers", () => {
  it("accepts PDF files and rejects non-PDF documentation", () => {
    const pdf = new File(["%PDF"], "annual-report.pdf", { type: "application/pdf" });
    const spreadsheet = new File(["xlsx"], "model.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const selection = buildDiagnosisDocumentSelection([pdf, spreadsheet]);

    expect(selection.accepted).toEqual([pdf]);
    expect(selection.rejectedNames).toEqual(["model.xlsx"]);
  });

  it("requires at least one selected PDF before confirming rerun", () => {
    expect(canConfirmDiagnosisDocumentRerun([])).toBe(false);
    expect(
      canConfirmDiagnosisDocumentRerun([
        new File(["%PDF"], "annual-report.pdf", { type: "application/pdf" }),
      ]),
    ).toBe(true);
  });

  it("does not re-upload files that already uploaded before a rerun retry", () => {
    const uploaded = new File(["%PDF"], "uploaded.pdf", { type: "application/pdf" });
    const pending = new File(["%PDF"], "pending.pdf", { type: "application/pdf" });

    expect(
      filesPendingDiagnosisUpload([uploaded, pending], {
        [`${uploaded.name}-${uploaded.size}-${uploaded.lastModified}`]: "uploaded",
      }),
    ).toEqual([pending]);
  });

  it("blocks baseline refresh for locked review states", () => {
    expect(isDiagnosisBaselineRefreshLocked("manager_review")).toBe(true);
    expect(isDiagnosisBaselineRefreshLocked("cfo_review")).toBe(true);
    expect(isDiagnosisBaselineRefreshLocked("approved")).toBe(true);
    expect(isDiagnosisBaselineRefreshLocked("in_diagnosis")).toBe(false);
    expect(canStartDiagnosisBaselineRefresh({ locked: false, dirty: false, projectId: "project-1" })).toBe(true);
    expect(canStartDiagnosisBaselineRefresh({ locked: true, dirty: false, projectId: "project-1" })).toBe(false);
    expect(canStartDiagnosisBaselineRefresh({ locked: false, dirty: true, projectId: "project-1" })).toBe(false);
    expect(canStartDiagnosisBaselineRefresh({ locked: false, dirty: false, projectId: null })).toBe(false);
  });

  it("explains that extraction reruns across all uploaded PDFs", () => {
    expect(ADD_DOCUMENTS_RERUN_DISCLOSURE).toContain("all uploaded PDFs");
    expect(ADD_DOCUMENTS_RERUN_DISCLOSURE).toContain("replace the current diagnosis baseline");
  });

  it("summarizes the refreshed diagnosis baseline from available workspace data", () => {
    expect(
      buildBaselineRefreshSummary({
        addedFileCount: 2,
        documentCount: 5,
        reviewProgress: { total: 42, reviewed: 7 },
        changedValueCount: 8,
        citationChangeCount: 3,
        addedFieldCount: 4,
        removedFieldCount: 2,
      }),
    ).toEqual({
      addedFileCount: 2,
      documentCount: 5,
      changedValueCount: 8,
      citationChangeCount: 3,
      addedFieldCount: 4,
      removedFieldCount: 2,
      reviewTotal: 42,
      reviewedCount: 7,
      pendingReviewCount: 35,
    });
  });
});
