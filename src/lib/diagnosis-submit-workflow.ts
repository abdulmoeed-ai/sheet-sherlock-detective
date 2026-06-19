export function canSubmitDiagnosisForManagerReview({
  projectId,
  pending,
}: {
  projectId?: string | null;
  pending: boolean;
}) {
  return Boolean(projectId) && !pending;
}

export function diagnosisManagerSubmitButtonLabel({
  dirty,
  pending,
}: {
  dirty: boolean;
  pending: boolean;
}) {
  if (pending) return "Submitting...";
  return dirty ? "Save & Submit to Manager" : "Submit to Manager";
}

export function diagnosisManagerSubmitBlockedReason({ projectId }: { projectId?: string | null }) {
  if (!projectId) return "Open a workbook version before submitting for Manager review.";
  return null;
}
