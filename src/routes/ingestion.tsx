import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { cycleStore, useCycle } from "@/lib/cycle-store";
import { useSelectedProjectId } from "@/lib/project-store";
import { getSectorPack } from "@/lib/sector-packs";
import { IconTooltip } from "@/components/IconTooltip";
import {
  useAcknowledgeMappingRules,
  useStartExtraction,
  useUploadDocuments,
} from "@/hooks/use-project-actions";
import { readMappingRules } from "@/lib/api/projects";
import type { DocumentResponse, MappingRulesSummaryResponse } from "@/lib/api/types";
import { ApiError } from "@/lib/api/errors";
import {
  isExtractionResultsConflict,
  splitPdfFiles,
  type UploadFileStatus,
} from "@/lib/upload-documents";
import { toast } from "sonner";
import {
  CloudUpload,
  FileText,
  Trash2,
  Check,
  Loader2,
  AlertTriangle,
  RotateCw,
  X,
} from "lucide-react";

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
  const cycle = useCycle();
  const projectId = useSelectedProjectId();
  const uploadDocuments = useUploadDocuments(projectId ?? "__no_project__");
  const startExtractionMutation = useStartExtraction(projectId ?? "__no_project__");
  const [selectedUploads, setSelectedUploads] = useState<SelectedUpload[]>([]);
  const [rejectedFiles, setRejectedFiles] = useState<string[]>([]);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [pendingStartAfterAck, setPendingStartAfterAck] = useState(false);
  const [rerunModalOpen, setRerunModalOpen] = useState(false);

  // Reset transient modal state when a new cycle starts from the registry.
  useEffect(() => {
    setRerunModalOpen(false);
  }, [cycle.startedAt]);

  const openDiagnosis = () => {
    cycleStore.setStatus("diagnosis");
    navigate({ to: "/diagnosis" });
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
      await startExtractionMutation.mutateAsync(false);
      openDiagnosis();
    } catch (error) {
      if (isExtractionResultsConflict(error)) {
        setRerunModalOpen(true);
        return;
      }
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        error.message.includes("Acknowledge")
      ) {
        setPendingStartAfterAck(true);
        setRulesOpen(true);
        return;
      }
      toast.error(error instanceof Error ? error.message : "Unable to start extraction");
    }
  };

  const rerunExtraction = async () => {
    try {
      await startExtractionMutation.mutateAsync(true);
      setRerunModalOpen(false);
      openDiagnosis();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to re-run extraction");
    }
  };

  const handleFileSelection = (files: FileList | null) => {
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

  const uploadPending = uploadDocuments.isPending || startExtractionMutation.isPending;

  return (
    <PageShell
      title={`Ingestion — ${cycle.period} · ${cycle.company}`}
      subtitle="Upload source PDFs and trigger extraction"
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

      {rulesOpen && (
        <RulePackModal
          projectId={projectId}
          onClose={() => {
            setRulesOpen(false);
            setPendingStartAfterAck(false);
          }}
          onAcknowledged={
            pendingStartAfterAck
              ? () => {
                  setPendingStartAfterAck(false);
                  startIngestion();
                }
              : undefined
          }
        />
      )}
      {rerunModalOpen && (
        <RerunExtractionModal
          pending={startExtractionMutation.isPending}
          onClose={() => setRerunModalOpen(false)}
          onConfirm={rerunExtraction}
        />
      )}

      <StickyFooter
        fileCount={selectedUploads.length}
        uploadPending={uploadPending}
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

function RulePackModal({
  projectId,
  onClose,
  onAcknowledged,
}: {
  projectId: string | null;
  onClose: () => void;
  onAcknowledged?: () => void;
}) {
  const cycle = useCycle();
  const pack = getSectorPack(cycle.sector);
  const overrideSet = new Set(pack.sectorOverrides);
  const all = [...pack.sectorOverrides, ...pack.baseRules];
  const acknowledgeMutation = useAcknowledgeMappingRules(projectId ?? "__no_project__");
  const [summary, setSummary] = useState<MappingRulesSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    setSummaryLoading(true);
    readMappingRules(projectId)
      .then(setSummary)
      .catch(() => {})
      .finally(() => setSummaryLoading(false));
  }, [projectId]);

  const handleAcknowledge = async () => {
    if (!summary || !projectId) return;
    try {
      await acknowledgeMutation.mutateAsync({
        rulesHash: summary.rulesHash,
        rulesCount: summary.rulesCount,
        acknowledged: true,
      });
      toast.success("Data Mapping Rules acknowledged.");
      onClose();
      onAcknowledged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Acknowledgement failed.");
    }
  };

  const alreadyAcknowledged = summary?.acknowledged ?? false;
  const canAcknowledge = !!summary && !!projectId && !alreadyAcknowledged;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-start justify-between border-b px-5 py-4"
          style={{ borderColor: "var(--color-border-default)" }}
        >
          <div>
            <div
              className="text-[14px] font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              {pack.sector} · Data Mapping Rules
            </div>
            <div className="mt-0.5 text-[12px]" style={{ color: "var(--color-text-muted)" }}>
              {summaryLoading
                ? "Loading…"
                : summary
                  ? `${summary.rulesCount} active rules · ${summary.criticalCount} critical · ${summary.advisoryCount} advisory`
                  : `${pack.ruleCount} rules · ${pack.template} · ${pack.yearEnd} year-end · ${pack.currency}`}
            </div>
          </div>
          <IconTooltip label="Close">
            <button
              onClick={onClose}
              className="rounded p-1 hover:bg-[var(--color-tag-bg)]"
              aria-label="Close"
            >
              <X className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
            </button>
          </IconTooltip>
        </div>

        <div className="overflow-y-auto px-5 py-3">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {pack.macroVariables.map((m) => (
              <span
                key={m}
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: "var(--color-tag-bg)", color: "var(--color-accent-sparkle)" }}
              >
                {m}
              </span>
            ))}
            {pack.regulatoryTags.map((r) => (
              <span
                key={r}
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: "var(--color-warning-bg)", color: "var(--color-warning-fg)" }}
              >
                {r}
              </span>
            ))}
          </div>

          <table className="w-full text-[12px]">
            <thead>
              <tr
                className="text-left text-[10px] uppercase"
                style={{
                  color: "var(--color-text-muted)",
                  background: "var(--color-table-header)",
                }}
              >
                <th className="px-3 py-2">#</th>
                <th className="px-2 py-2">Rule</th>
                <th className="px-2 py-2">Type</th>
              </tr>
            </thead>
            <tbody>
              {all.map((rule, i) => {
                const isOverride = overrideSet.has(rule);
                return (
                  <tr
                    key={`${rule}-${i}`}
                    className="border-b"
                    style={{ borderColor: "var(--color-border-default)" }}
                  >
                    <td className="px-3 py-2 tnum text-[var(--color-text-muted)]">{i + 1}</td>
                    <td className="px-2 py-2">{rule}</td>
                    <td className="px-2 py-2">
                      {isOverride ? (
                        <span
                          className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{ background: "#EDE9FE", color: "var(--color-brand)" }}
                        >
                          Sector override
                        </span>
                      ) : (
                        <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                          Universal
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Acknowledge footer */}
        <div
          className="flex items-center justify-between border-t px-5 py-3"
          style={{ borderColor: "var(--color-border-default)" }}
        >
          {alreadyAcknowledged ? (
            <span
              className="flex items-center gap-1.5 text-[12px]"
              style={{ color: "var(--color-success)" }}
            >
              <Check className="h-3.5 w-3.5" />
              Rules acknowledged
              {summary?.acknowledgedAt
                ? ` · ${new Date(summary.acknowledgedAt).toLocaleString()}`
                : ""}
            </span>
          ) : (
            <span className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>
              Review all rules above, then acknowledge to begin extraction.
            </span>
          )}
          <button
            onClick={canAcknowledge ? handleAcknowledge : onClose}
            disabled={acknowledgeMutation.isPending || summaryLoading}
            className="inline-flex h-9 items-center gap-2 rounded-lg px-4 text-[13px] font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: "var(--color-brand)" }}
          >
            {acknowledgeMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : alreadyAcknowledged ? (
              <Check className="h-3.5 w-3.5" />
            ) : null}
            {alreadyAcknowledged
              ? onAcknowledged
                ? "Begin extraction →"
                : "Close"
              : onAcknowledged
                ? "Acknowledge and begin extraction →"
                : "Acknowledge rules"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StickyFooter({
  fileCount,
  uploadPending,
  hasProject,
  onStart,
}: {
  fileCount: number;
  uploadPending: boolean;
  hasProject: boolean;
  onStart: () => void;
}) {
  return (
    <div
      className="fixed bottom-0 left-[240px] right-0 z-20 flex h-16 items-center justify-between border-t bg-white px-8"
      style={{ borderColor: "var(--color-border-default)" }}
    >
      {!hasProject ? (
        <div className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
          Select or create a project before uploading reports.
        </div>
      ) : (
        <div aria-hidden="true" />
      )}
      <button
        onClick={onStart}
        disabled={!hasProject || !fileCount || uploadPending}
        className="h-10 rounded-lg px-5 text-[13px] font-semibold text-white transition-opacity disabled:opacity-50"
        style={{ background: "var(--color-brand)" }}
      >
        {uploadPending ? "Uploading reports..." : "Upload and start extraction ->"}
      </button>
    </div>
  );
}
