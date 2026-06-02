import { ApiError } from "@/lib/api/errors";

export type UploadFileStatus<TDocument = unknown> =
  | { file: File; status: "pending" }
  | { file: File; status: "uploading" }
  | { file: File; status: "uploaded"; document: TDocument }
  | { file: File; status: "failed"; message: string };

export type UploadDocumentsResult<TDocument = unknown> = {
  uploaded: TDocument[];
  failed: { file: File; message: string } | null;
};

export function splitPdfFiles(files: Iterable<File>) {
  const accepted: File[] = [];
  const rejected: File[] = [];
  for (const file of files) {
    if (isPdfFile(file)) {
      accepted.push(file);
    } else {
      rejected.push(file);
    }
  }
  return { accepted, rejected };
}

export async function uploadDocumentsSequential<TDocument>(
  files: File[],
  upload: (file: File) => Promise<TDocument>,
  onStatus?: (status: UploadFileStatus<TDocument>) => void,
): Promise<UploadDocumentsResult<TDocument>> {
  const uploaded: TDocument[] = [];
  for (const file of files) {
    onStatus?.({ file, status: "uploading" });
    try {
      const document = await upload(file);
      uploaded.push(document);
      onStatus?.({ file, status: "uploaded", document });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      onStatus?.({ file, status: "failed", message });
      return { uploaded, failed: { file, message } };
    }
  }
  return { uploaded, failed: null };
}

export function isExtractionResultsConflict(error: unknown) {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    error.message.includes("already has extraction results") &&
    error.message.includes("force=true")
  );
}

function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}
