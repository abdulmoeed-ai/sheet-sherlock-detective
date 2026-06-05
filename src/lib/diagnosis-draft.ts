export function hasDiagnosisDraftChanges({
  draftValue,
  pendingWorkbookEditCount,
}: {
  draftValue: string;
  pendingWorkbookEditCount: number;
}) {
  return draftValue.trim() !== "" || pendingWorkbookEditCount > 0;
}

export type DiagnosisDraftSaveState = {
  dirty: boolean;
  saving: boolean;
  savedVersionLabel?: string | null;
};

export function diagnosisDraftSaveLabel(state: DiagnosisDraftSaveState) {
  if (state.saving) return "Saving draft";
  if (state.dirty) return "Unsaved draft";
  if (state.savedVersionLabel) return `Saved ${state.savedVersionLabel}`;
  return "No draft changes";
}

export function workbookDraftSaveSnapshot<T>(draftSnapshot: T | null, serverWorkbook: T): T {
  return draftSnapshot ?? serverWorkbook;
}
