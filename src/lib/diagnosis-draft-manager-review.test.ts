import { describe, expect, it } from "vitest";
import {
  draftManagerReviewSuccessMessage,
  draftManagerReviewTarget,
} from "./diagnosis-draft-manager-review";

describe("diagnosis draft manager review helpers", () => {
  it("submits the newly created version when draft save creates one", () => {
    const target = draftManagerReviewTarget({
      currentProjectId: "project-1",
      savedVersionId: "project-2",
    });

    expect(target).toEqual({ projectId: "project-2", createdNewVersion: true });
    expect(draftManagerReviewSuccessMessage(target!)).toBe(
      "Draft saved and submitted to Manager review.",
    );
  });

  it("submits the current project when no new version is created", () => {
    const target = draftManagerReviewTarget({
      currentProjectId: "project-1",
      savedVersionId: null,
    });

    expect(target).toEqual({ projectId: "project-1", createdNewVersion: false });
    expect(draftManagerReviewSuccessMessage(target!)).toBe("Draft submitted to Manager review.");
  });

  it("returns null when no project is open", () => {
    expect(draftManagerReviewTarget({ currentProjectId: "", savedVersionId: null })).toBeNull();
  });
});
