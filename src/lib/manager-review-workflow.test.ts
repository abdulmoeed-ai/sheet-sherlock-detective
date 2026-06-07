import { describe, expect, it } from "bun:test";
import {
  managerApprovalButtonLabel,
  managerReviewSubtitle,
  managerReviewVersionLockMessage,
  routeAfterManagerApproval,
} from "./manager-review-workflow";

describe("manager review workflow copy", () => {
  it("treats manager approval as final instead of routing to CFO sign-off", () => {
    expect(managerApprovalButtonLabel()).toBe("Approve & Lock Model");
    expect(managerReviewSubtitle(true)).toBe(
      "Structured review pack from the backend workspace. Approve to lock this model as the final version, or send back with comments.",
    );
    expect(managerReviewVersionLockMessage()).toBe(
      "This pack is version-locked when the Finance Manager approves it.",
    );
    expect(routeAfterManagerApproval()).toBeNull();
  });
});
