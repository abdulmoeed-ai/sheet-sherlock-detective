export function managerApprovalButtonLabel() {
  return "Approve Workbook";
}

export function managerReviewSubtitle(hasProject: boolean) {
  if (!hasProject) return "Create analysis requests and review submitted workbooks.";
  return "Review the analyst submission, add comments where needed, then approve the workbook or send it back.";
}

export function managerReviewVersionLockMessage() {
  return "Approval marks this workbook as the final approved version.";
}

export function routeAfterManagerApproval(): null {
  return null;
}
