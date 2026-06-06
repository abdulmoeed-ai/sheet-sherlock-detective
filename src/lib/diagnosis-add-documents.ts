import { splitPdfFiles } from "@/lib/upload-documents";
import type { ReviewProgress } from "@/lib/api/types";

export const ADD_DOCUMENTS_RERUN_DISCLOSURE =
  "Uploading additional PDFs will rerun extraction across all uploaded PDFs and replace the current diagnosis baseline.";

export function buildDiagnosisDocumentSelection(files: Iterable<File>) {
  const { accepted, rejected } = splitPdfFiles(files);
  return {
    accepted,
    rejectedNames: rejected.map((file) => file.name),
  };
}

export function canConfirmDiagnosisDocumentRerun(files: File[]) {
  return files.length > 0;
}

export function filesPendingDiagnosisUpload(
  files: File[],
  uploadStatuses: Record<string, string | undefined>,
) {
  return files.filter((file) => uploadStatuses[fileKey(file)] !== "uploaded");
}

export function canStartDiagnosisBaselineRefresh({
  locked,
  dirty,
  projectId,
}: {
  locked: boolean;
  dirty: boolean;
  projectId?: string | null;
}) {
  return Boolean(projectId) && !locked && !dirty;
}

export function isDiagnosisBaselineRefreshLocked(status?: string | null) {
  return status === "manager_review" || status === "cfo_review" || status === "approved";
}

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export interface BaselineRefreshSummary {
  addedFileCount: number;
  documentCount: number;
  changedValueCount: number | null;
  citationChangeCount: number | null;
  addedFieldCount: number | null;
  removedFieldCount: number | null;
  reviewTotal: number;
  reviewedCount: number;
  pendingReviewCount: number;
}

export function buildBaselineRefreshSummary({
  addedFileCount,
  documentCount,
  reviewProgress,
  changedValueCount = null,
  citationChangeCount = null,
  addedFieldCount = null,
  removedFieldCount = null,
}: {
  addedFileCount: number;
  documentCount: number;
  reviewProgress?: ReviewProgress | null;
  changedValueCount?: number | null;
  citationChangeCount?: number | null;
  addedFieldCount?: number | null;
  removedFieldCount?: number | null;
}): BaselineRefreshSummary {
  const reviewTotal = reviewProgress?.total ?? 0;
  const reviewedCount = reviewProgress?.reviewed ?? 0;
  return {
    addedFileCount,
    documentCount,
    changedValueCount,
    citationChangeCount,
    addedFieldCount,
    removedFieldCount,
    reviewTotal,
    reviewedCount,
    pendingReviewCount: Math.max(0, reviewTotal - reviewedCount),
  };
}
