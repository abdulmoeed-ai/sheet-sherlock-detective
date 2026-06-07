import { describe, expect, it } from "bun:test";
import {
  managerApprovalButtonLabel,
  managerReviewSubtitle,
  managerReviewVersionLockMessage,
  routeAfterManagerApproval,
} from "./manager-review-workflow";

describe("manager review workflow copy", () => {
  it("treats manager approval as final instead of routing to CFO sign-off", () => {
    expect(managerApprovalButtonLabel()).toBe("Approve Workbook");
    expect(managerReviewSubtitle(true)).toBe(
      "Review the analyst submission, add comments where needed, then approve the workbook or send it back.",
    );
    expect(managerReviewVersionLockMessage()).toBe(
      "Approval marks this workbook as the final approved version.",
    );
    expect(routeAfterManagerApproval()).toBeNull();
  });
});
