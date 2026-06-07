export function managerApprovalButtonLabel() {
  return "Approve & Lock Model";
}

export function managerReviewSubtitle(hasProject: boolean) {
  if (!hasProject) return "Select a project before reviewing the manager pack.";
  return "Structured review pack from the backend workspace. Approve to lock this model as the final version, or send back with comments.";
}

export function managerReviewVersionLockMessage() {
  return "This pack is version-locked when the Finance Manager approves it.";
}

export function routeAfterManagerApproval(): null {
  return null;
}
