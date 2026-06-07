export type DraftManagerReviewTarget = {
  projectId: string;
  createdNewVersion: boolean;
};

export function draftManagerReviewTarget({
  currentProjectId,
  savedVersionId,
}: {
  currentProjectId?: string | null;
  savedVersionId?: string | null;
}): DraftManagerReviewTarget | null {
  const projectId = (savedVersionId || currentProjectId || "").trim();
  if (!projectId) return null;
  return {
    projectId,
    createdNewVersion: Boolean(savedVersionId),
  };
}

export function draftManagerReviewSuccessMessage(target: DraftManagerReviewTarget) {
  return target.createdNewVersion
    ? "Draft saved and submitted to Manager review."
    : "Draft submitted to Manager review.";
}
