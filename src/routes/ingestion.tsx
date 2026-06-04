import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { cycleStore, useCycle } from "@/lib/cycle-store";
import { useSelectedProjectId } from "@/lib/project-store";
import { IconTooltip } from "@/components/IconTooltip";
import { useStartExtraction, useUploadDocuments } from "@/hooks/use-project-actions";
import { readExtractionJob, readWorkspace } from "@/lib/api/projects";
import { queryKeys } from "@/lib/api/query-keys";
import type { DocumentResponse, ExtractionJobResponse } from "@/lib/api/types";
import { waitForExtractionCompletion } from "@/lib/extraction-job";
import {
  isExtractionResultsConflict,
  splitPdfFiles,
  type UploadFileStatus,
} from "@/lib/upload-documents";
import { toast } from "sonner";
import { CloudUpload, FileText, Trash2, Loader2, AlertTriangle, RotateCw, X } from "lucide-react";

export const Route = createFileRoute("/ingestion")({
  head: () => ({
    meta: [
      { title: "Ingestion — Sheet Sherlock" },
      {
        name: "description",
        content: "Upload PSX filings and trigger project extraction.",
      },
    ],
  }),
  component: Ingestion,
});

type SelectedUpload = {
  file: File;
  status: "pending" | "uploading" | "uploaded" | "failed";
  message?: string;
  document?: DocumentResponse;
};

function Ingestion() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cycle = useCycle();
  const projectId = useSelectedProjectId();
  const uploadDocuments = useUploadDocuments(projectId ?? "__no_project__");
  const startExtractionMutation = useStartExtraction(projectId ?? "__no_project__");
  const [selectedUploads, setSelectedUploads] = useState<SelectedUpload[]>([]);
  const [rejectedFiles, setRejectedFiles] = useState<string[]>([]);
  const [rerunModalOpen, setRerunModalOpen] = useState(false);
  const [extractionPending, setExtractionPending] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState<ExtractionJobResponse | null>(null);

  // Reset transient modal state when a new cycle starts from the registry.
  useEffect(() => {
    setRerunModalOpen(false);
  }, [cycle.startedAt]);

  const openDiagnosis = (id: string) => {
    cycleStore.setStatus("diagnosis");
    navigate({ to: "/diagnosis/$projectId", params: { projectId: id } });
  };

  const startIngestion = async () => {
    if (!projectId) {
      toast.error("Select or create a project before uploading reports.");
      return;
    }
    const filesToUpload = selectedUploads
      .filter((item) => item.status !== "uploaded")
      .map((item) => item.file);
    if (!selectedUploads.length) return;
    if (filesToUpload.length) {
      const result = await uploadDocuments.mutateAsync({
        files: filesToUpload,
        onStatus: updateUploadStatus,
      });
      if (result.failed) {
        toast.error(`Upload failed for ${result.failed.file.name}: ${result.failed.message}`);
        return;
      }
      cycleStore.setDocumentIds(result.uploaded.map((document) => document.id).filter(Boolean));
    }
    try {
      setExtractionPending(true);
      setExtractionProgress(null);
      const job = await startExtractionMutation.mutateAsync(false);
      await waitForExtractionCompletion({
        projectId,
        initialJob: job,
        readJob: readExtractionJob,
        onProgress: setExtractionProgress,
      });
      await refreshExtractedProject(projectId);
      openDiagnosis(projectId);
    } catch (error) {
      if (isExtractionResultsConflict(error)) {
        setRerunModalOpen(true);
        return;
      }
      toast.error(error instanceof Error ? error.message : "Unable to start extraction");
    } finally {
      setExtractionPending(false);
    }
  };

  const rerunExtraction = async () => {
    if (!projectId) return;
    try {
      setExtractionPending(true);
      setExtractionProgress(null);
      const job = await startExtractionMutation.mutateAsync(true);
      await waitForExtractionCompletion({
        projectId,
        initialJob: job,
        readJob: readExtractionJob,
        onProgress: setExtractionProgress,
      });
      await refreshExtractedProject(projectId);
      setRerunModalOpen(false);
      openDiagnosis(projectId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to re-run extraction");
    } finally {
      setExtractionPending(false);
    }
  };

  const handleFileSelection = (files: FileList | null) => {
    setExtractionProgress(null);
    const { accepted, rejected } = splitPdfFiles(Array.from(files ?? []));
    if (rejected.length) {
      setRejectedFiles(rejected.map((file) => file.name));
      toast.error("Only PDF reports are supported for extraction.");
    } else {
      setRejectedFiles([]);
    }
    if (!accepted.length) return;
    setSelectedUploads((current) => {
      const existingKeys = new Set(current.map((item) => fileKey(item.file)));
      const next = accepted
        .filter((file) => !existingKeys.has(fileKey(file)))
        .map((file): SelectedUpload => ({ file, status: "pending" }));
      return [...current, ...next];
    });
  };

  const updateUploadStatus = (status: UploadFileStatus<DocumentResponse>) => {
    setSelectedUploads((current) =>
      current.map((item) => {
        if (fileKey(item.file) !== fileKey(status.file)) return item;
        if (status.status === "uploaded") {
          return { ...item, status: "uploaded", document: status.document, message: undefined };
        }
        if (status.status === "failed") {
          return { ...item, status: "failed", message: status.message };
        }
        return { ...item, status: status.status, message: undefined };
      }),
    );
  };

  const removeSelectedFile = (file: File) => {
    setSelectedUploads((current) => current.filter((item) => fileKey(item.file) !== fileKey(file)));
  };

  const uploadPending =
    uploadDocuments.isPending || startExtractionMutation.isPending || extractionPending;
  const uploadSummary = uploadProgressSummary(selectedUploads);

  const refreshExtractedProject = async (id: string) => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.workspace(id) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    await queryClient.fetchQuery({
      queryKey: queryKeys.workspace(id),
      queryFn: () => readWorkspace(id),
      staleTime: 0,
    });
  };

  return (
    <PageShell
      title={`Ingestion — ${cycle.period} · ${cycle.company}`}
      subtitle="Upload source PDFs and trigger extraction"
      hideProgress
    >
      <div className="pb-24">
        {/* Upload zone */}
        <div
          className="mb-5 rounded-xl border bg-white p-6"
          style={{ borderColor: "var(--color-border-default)" }}
        >
          <div
            className="mb-4 text-[13px] font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Upload PSX Annual Report / Filing
          </div>

          {!selectedUploads.length ? (
            <label
              className="block cursor-pointer rounded-[10px] px-6 py-9 text-center transition-colors"
              style={{ border: "2px dashed var(--color-brand)", background: "transparent" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--color-tag-bg)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <CloudUpload
                className="mx-auto h-7 w-7"
                style={{ color: "var(--color-text-muted)" }}
              />
              <div className="mt-3 text-[14px]">
                <span className="font-bold" style={{ color: "var(--color-brand)" }}>
                  Click to upload
                </span>{" "}
                <span style={{ color: "var(--color-text-secondary)" }}>or drag and drop</span>
              </div>
              <div className="mt-1 text-[12px]" style={{ color: "var(--color-text-muted)" }}>
                Select one or more PDF annual reports (max. 50MB each)
              </div>
              <input
                type="file"
                multiple
                className="hidden"
                accept="application/pdf,.pdf"
                onChange={(e) => {
                  handleFileSelection(e.target.files);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          ) : (
            <div className="space-y-2">
              {selectedUploads.map((item) => (
                <div
                  key={fileKey(item.file)}
                  className="flex items-center gap-3 rounded-lg border px-4 py-3"
                  style={{ borderColor: "var(--color-border-default)" }}
                >
                  <FileText
                    className="h-8 w-8 rounded-md p-1.5"
                    style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate text-[14px] font-medium"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {item.file.name}
                    </div>
                    <div className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>
                      {(item.file.size / (1024 * 1024)).toFixed(1)} MB · {uploadStatusLabel(item)}
                    </div>
                    {item.status === "failed" && item.message ? (
                      <div className="mt-1 text-[11px]" style={{ color: "var(--color-danger)" }}>
                        {item.message}
                      </div>
                    ) : null}
                  </div>
                  {item.status === "uploading" ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      style={{ color: "var(--color-brand)" }}
                    />
                  ) : (
                    <IconTooltip label="Remove PDF">
                      <button
                        onClick={() => removeSelectedFile(item.file)}
                        disabled={uploadPending}
                        className="rounded-md p-1.5 hover:bg-[var(--color-tag-bg)] disabled:opacity-50"
                        aria-label="Remove PDF"
                      >
                        <Trash2 className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
                      </button>
                    </IconTooltip>
                  )}
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <label
                  className="inline-flex h-8 cursor-pointer items-center rounded-md border px-3 text-[12px] font-semibold"
                  style={{
                    borderColor: "var(--color-border-default)",
                    color: "var(--color-brand)",
                  }}
                >
                  Add more PDFs
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    accept="application/pdf,.pdf"
                    onChange={(e) => {
                      handleFileSelection(e.target.files);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
                <button
                  onClick={() => setSelectedUploads([])}
                  disabled={uploadPending}
                  className="h-8 rounded-md border px-3 text-[12px] font-semibold disabled:opacity-50"
                  style={{
                    borderColor: "var(--color-border-default)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {rejectedFiles.length ? (
            <div
              className="mt-3 flex items-start gap-2 rounded-md border px-3 py-2 text-[12px]"
              style={{ borderColor: "var(--color-danger)", color: "var(--color-danger)" }}
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Rejected non-PDF file{rejectedFiles.length === 1 ? "" : "s"}:{" "}
                {rejectedFiles.join(", ")}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {rerunModalOpen && (
        <RerunExtractionModal
          pending={startExtractionMutation.isPending || extractionPending}
          onClose={() => setRerunModalOpen(false)}
          onConfirm={rerunExtraction}
        />
      )}

      <StickyFooter
        fileCount={selectedUploads.length}
        uploadPending={uploadPending}
        uploadSummary={uploadSummary}
        extractionProgress={extractionProgress}
        hasProject={!!projectId}
        onStart={startIngestion}
      />
    </PageShell>
  );
}

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function uploadStatusLabel(item: SelectedUpload) {
  if (item.status === "uploaded") return "uploaded";
  if (item.status === "uploading") return "uploading";
  if (item.status === "failed") return "upload failed";
  return "ready for upload";
}

function uploadProgressSummary(items: SelectedUpload[]) {
  const total = items.length;
  const uploaded = items.filter((item) => item.status === "uploaded").length;
  const uploading = items.find((item) => item.status === "uploading")?.file.name ?? null;
  const failed = items.find((item) => item.status === "failed")?.file.name ?? null;
  return { total, uploaded, uploading, failed };
}

function RerunExtractionModal({
  pending,
  onClose,
  onConfirm,
}: {
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6"
      onClick={pending ? undefined : onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="rounded-lg p-2" style={{ background: "var(--color-warning-bg)" }}>
            <AlertTriangle className="h-5 w-5" style={{ color: "var(--color-warning-fg)" }} />
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="text-[15px] font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              Replace existing extraction results?
            </div>
            <div
              className="mt-2 text-[13px] leading-5"
              style={{ color: "var(--color-text-secondary)" }}
            >
              This project already has generated values in Diagnosis. Re-running extraction will
              replace the prior generated values with results from the currently uploaded reports.
            </div>
          </div>
          <IconTooltip label="Close">
            <button
              onClick={onClose}
              disabled={pending}
              className="rounded p-1 hover:bg-[var(--color-tag-bg)] disabled:opacity-50"
              aria-label="Close"
            >
              <X className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
            </button>
          </IconTooltip>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={pending}
            className="h-9 rounded-md border px-3 text-[13px] font-semibold disabled:opacity-50"
            style={{
              borderColor: "var(--color-border-default)",
              color: "var(--color-text-secondary)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={pending}
            className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-[13px] font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--color-brand)" }}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCw className="h-4 w-4" />
            )}
            Re-run Extraction
          </button>
        </div>
      </div>
    </div>
  );
}

function StickyFooter({
  fileCount,
  uploadPending,
  uploadSummary,
  extractionProgress,
  hasProject,
  onStart,
}: {
  fileCount: number;
  uploadPending: boolean;
  uploadSummary: ReturnType<typeof uploadProgressSummary>;
  extractionProgress: ExtractionJobResponse | null;
  hasProject: boolean;
  onStart: () => void;
}) {
  const extractionPercent = Math.max(0, Math.min(100, extractionProgress?.percent ?? 0));
  const showProgress = uploadPending || extractionProgress;
  const progressPercent =
    extractionProgress && extractionPercent > 0
      ? extractionPercent
      : uploadSummary.total
        ? Math.round((uploadSummary.uploaded / uploadSummary.total) * 100)
        : 0;
  const progressLabel = extractionProgress
    ? extractionProgress.message || "Extracting reports."
    : uploadSummary.failed
      ? `Upload failed: ${uploadSummary.failed}`
      : uploadSummary.uploading
        ? `Uploading ${uploadSummary.uploaded + 1} of ${uploadSummary.total}: ${uploadSummary.uploading}`
        : uploadSummary.total
          ? `${uploadSummary.uploaded} of ${uploadSummary.total} report uploads complete`
          : "";

  return (
    <div
      className="fixed bottom-0 left-[240px] right-0 z-20 flex min-h-16 items-center justify-between gap-6 border-t bg-white px-8 py-2"
      style={{ borderColor: "var(--color-border-default)" }}
    >
      {!hasProject ? (
        <div className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
          Select or create a project before uploading reports.
        </div>
      ) : (
        <div className="min-w-0 flex-1">
          {showProgress && progressLabel ? (
            <div className="max-w-xl">
              <div className="mb-1 flex items-center justify-between gap-3 text-[12px]">
                <span
                  className="truncate font-medium"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {progressLabel}
                </span>
                <span className="shrink-0 tnum" style={{ color: "var(--color-text-muted)" }}>
                  {progressPercent}%
                </span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full"
                style={{ background: "var(--color-border-default)" }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${progressPercent}%`, background: "var(--color-brand)" }}
                />
              </div>
            </div>
          ) : null}
        </div>
      )}
      <button
        onClick={onStart}
        disabled={!hasProject || !fileCount || uploadPending}
        className="h-10 rounded-lg px-5 text-[13px] font-semibold text-white transition-opacity disabled:opacity-50"
        style={{ background: "var(--color-brand)" }}
      >
        {uploadPending ? "Extracting reports..." : "Upload and start extraction ->"}
      </button>
    </div>
  );
}
