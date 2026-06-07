import { describe, expect, it } from "bun:test";
import {
  canSubmitDiagnosisForManagerReview,
  diagnosisManagerSubmitBlockedReason,
  diagnosisManagerSubmitButtonLabel,
} from "./diagnosis-submit-workflow";

describe("diagnosis manager submit workflow", () => {
  it("requires an open project and no active submission before submitting", () => {
    expect(
      canSubmitDiagnosisForManagerReview({ projectId: "project-1", pending: false }),
    ).toBe(true);
    expect(canSubmitDiagnosisForManagerReview({ projectId: "", pending: false })).toBe(false);
    expect(
      canSubmitDiagnosisForManagerReview({ projectId: "project-1", pending: true }),
    ).toBe(false);
  });

  it("uses save-then-submit language for the manager handoff", () => {
    expect(diagnosisManagerSubmitButtonLabel({ dirty: false, pending: false })).toBe(
      "Submit to Manager",
    );
    expect(diagnosisManagerSubmitButtonLabel({ dirty: true, pending: false })).toBe(
      "Save & Submit to Manager",
    );
    expect(diagnosisManagerSubmitButtonLabel({ dirty: true, pending: true })).toBe(
      "Submitting...",
    );
    expect(diagnosisManagerSubmitBlockedReason({ projectId: "" })).toBe(
      "Open a workbook version before submitting for Manager review.",
    );
    expect(diagnosisManagerSubmitBlockedReason({ projectId: "project-1" })).toBeNull();
  });
});
