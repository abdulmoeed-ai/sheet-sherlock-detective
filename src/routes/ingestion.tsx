import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { cycleStore, useCycle } from "@/lib/cycle-store";
import { useSelectedProjectId } from "@/lib/project-store";
import { getSectorPack } from "@/lib/sector-packs";
import { SourcePreview, type SourceRef } from "@/components/SourcePreviewPanel";
import { useStartExtraction, useUploadDocuments } from "@/hooks/use-project-actions";
import type { DocumentResponse } from "@/lib/api/types";
import { isExtractionResultsConflict, splitPdfFiles, type UploadFileStatus } from "@/lib/upload-documents";
import { toast } from "sonner";
import {
  CloudUpload,
  FileText,
  Trash2,
  Check,
  Loader2,
  AlertTriangle,
  RotateCw,
  Minus,
  ChevronDown,
  ChevronRight,
  X,
  Layers,
} from "lucide-react";

export const Route = createFileRoute("/ingestion")({
  head: () => ({
    meta: [
      { title: "Ingestion — Sheet Sherlock" },
      { name: "description", content: "Upload PSX filings and ingest from 13 live data sources with OCR confidence scoring." },
    ],
  }),
  component: Ingestion,
});

type SourceStatus = "live" | "stale" | "down";

interface ManifestField {
  field: string;
  value: string;
  sheet: string;
  cell: string;
  confidence: number;
  timestamp: string;
}

interface Source {
  name: string;
  status: SourceStatus;
  updated: string;
  manifest: ManifestField[];
}

const SOURCES: Source[] = [
  {
    name: "PSX",
    status: "live",
    updated: "Updated 1h ago",
    manifest: [
      { field: "Revenue FY2025", value: "PKR 54,800,000", sheet: "IS", cell: "C12", confidence: 97, timestamp: "10:42:18" },
      { field: "EBITDA", value: "PKR 12,900,000", sheet: "IS", cell: "C18", confidence: 94, timestamp: "10:42:19" },
      { field: "Net Profit", value: "PKR 8,210,000", sheet: "IS", cell: "C24", confidence: 92, timestamp: "10:42:19" },
      { field: "EPS", value: "PKR 110.41", sheet: "IS", cell: "C28", confidence: 95, timestamp: "10:42:20" },
    ],
  },
  {
    name: "ADB",
    status: "live",
    updated: "Updated 6h ago",
    manifest: [
      { field: "GDP growth (FY25)", value: "2.7%", sheet: "Macro", cell: "B4", confidence: 90, timestamp: "10:42:21" },
      { field: "Agri GDP growth", value: "6.3%", sheet: "Macro", cell: "B5", confidence: 88, timestamp: "10:42:21" },
    ],
  },
  {
    name: "Bloomberg",
    status: "live",
    updated: "Updated 30m ago",
    manifest: [
      { field: "MTL share price", value: "PKR 942.50", sheet: "Market", cell: "C3", confidence: 99, timestamp: "10:42:22" },
      { field: "Market cap", value: "PKR 70.1B", sheet: "Market", cell: "C5", confidence: 98, timestamp: "10:42:22" },
      { field: "30-day vol", value: "0.184M", sheet: "Market", cell: "C7", confidence: 96, timestamp: "10:42:23" },
    ],
  },
  {
    name: "SBP",
    status: "stale",
    updated: "Updated 3d ago — check schedule",
    manifest: [
      { field: "KIBOR 6M", value: "11.84%", sheet: "Macro", cell: "B10", confidence: 71, timestamp: "10:42:24" },
      { field: "Policy rate", value: "11.00%", sheet: "Macro", cell: "B11", confidence: 88, timestamp: "10:42:24" },
    ],
  },
  {
    name: "PBS",
    status: "live",
    updated: "Updated 1d ago",
    manifest: [
      { field: "CPI YoY", value: "4.1%", sheet: "Macro", cell: "B14", confidence: 93, timestamp: "10:42:25" },
      { field: "Core inflation", value: "8.4%", sheet: "Macro", cell: "B15", confidence: 90, timestamp: "10:42:25" },
    ],
  },
  {
    name: "WSJ",
    status: "live",
    updated: "Updated 4h ago",
    manifest: [
      { field: "Brent crude", value: "USD 72.40", sheet: "Macro", cell: "B20", confidence: 94, timestamp: "10:42:26" },
    ],
  },
  {
    name: "APCMA",
    status: "live",
    updated: "Updated 2h ago",
    manifest: [
      { field: "Cement dispatches", value: "44.5 Mt", sheet: "Sector", cell: "B6", confidence: 91, timestamp: "10:42:27" },
    ],
  },
  {
    name: "NEPRA",
    status: "down",
    updated: "Unreachable — credential may have expired",
    manifest: [],
  },
  {
    name: "AKD Securities",
    status: "live",
    updated: "Updated 5h ago",
    manifest: [
      { field: "Sector EPS forecast", value: "PKR 142.10", sheet: "Forecast", cell: "C40", confidence: 82, timestamp: "10:42:28" },
      { field: "Target price (MTL)", value: "PKR 1,180", sheet: "Forecast", cell: "C44", confidence: 78, timestamp: "10:42:28" },
    ],
  },
  {
    name: "Sarmaaya.pk",
    status: "live",
    updated: "Updated 12h ago",
    manifest: [
      { field: "Free float", value: "32.4%", sheet: "Market", cell: "C12", confidence: 86, timestamp: "10:42:29" },
      { field: "Foreign holding", value: "4.1%", sheet: "Market", cell: "C13", confidence: 84, timestamp: "10:42:29" },
    ],
  },
  {
    name: "SECP",
    status: "live",
    updated: "Updated 2d ago",
    manifest: [
      { field: "Board changes", value: "0 in FY25", sheet: "Governance", cell: "B3", confidence: 99, timestamp: "10:42:30" },
    ],
  },
  {
    name: "Topline Research",
    status: "live",
    updated: "Updated 8h ago",
    manifest: [
      { field: "Tractor unit forecast", value: "44,200 units", sheet: "Sector", cell: "B18", confidence: 76, timestamp: "10:42:31" },
    ],
  },
  {
    name: "MEPS / Trade data",
    status: "live",
    updated: "Updated 1d ago",
    manifest: [
      { field: "PKR/USD avg", value: "278.40", sheet: "Macro", cell: "B26", confidence: 95, timestamp: "10:42:32" },
    ],
  },
];

type FeedRow = {
  name: string;
  state: "pending" | "running" | "done" | "skipped";
  cells?: number;
  duration?: string;
};

type SelectedUpload = {
  file: File;
  status: "pending" | "uploading" | "uploaded" | "failed";
  message?: string;
  document?: DocumentResponse;
};

function Ingestion() {
  const navigate = useNavigate();
  const cycle = useCycle();
  const pack = getSectorPack(cycle.sector);
  const projectId = useSelectedProjectId();
  const uploadDocuments = useUploadDocuments(projectId ?? "__no_project__");
  const startExtractionMutation = useStartExtraction(projectId ?? "__no_project__");
  const [selectedUploads, setSelectedUploads] = useState<SelectedUpload[]>([]);
  const [rejectedFiles, setRejectedFiles] = useState<string[]>([]);
  const [threshold, setThreshold] = useState(85);
  const [running, setRunning] = useState(false);
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [feedDone, setFeedDone] = useState(false);
  const [ocrResolved, setOcrResolved] = useState<Record<number, boolean>>({});
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rerunModalOpen, setRerunModalOpen] = useState(false);

  const ocrIssues: SourceRef[] = [
    { doc: "MTL Annual Report 2025", page: 42, field: "Revenue FY2025", value: "PKR 54.8B", conf: 87, bbox: [20, 38, 56, 5] },
    { doc: "MTL Annual Report 2025", page: 71, field: "Total Assets", value: "PKR 112.4B", conf: 76, bbox: [22, 52, 52, 5] },
    { doc: "MTL Annual Report 2025", page: 58, field: "Net Profit", value: "PKR 8.2B", conf: 82, bbox: [24, 44, 50, 5] },
    { doc: "MTL Annual Report 2025", page: 64, field: "EBITDA", value: "PKR 12.9B", conf: 68, bbox: [20, 60, 58, 5] },
  ];
  const needsAction = ocrIssues.filter((o, i) => i > 0);
  const allResolved =
    feedDone && needsAction.every((_, i) => ocrResolved[i + 1]);

  useEffect(() => {
    if (!allResolved) return;
    const timer = window.setTimeout(() => {
      cycleStore.setStatus("diagnosis");
      navigate({ to: "/diagnosis" });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [allResolved, navigate]);

  const startFeed = () => {
    setRunning(true);
    setFeedDone(false);
    setOcrResolved({});
    const initial: FeedRow[] = SOURCES.map((s) => ({
      name: s.name,
      state: s.status === "down" ? "skipped" : "pending",
    }));
    setFeed(initial);

    let i = 0;
    const ordered = initial.map((r, idx) => ({ r, idx })).filter((x) => x.r.state !== "skipped");

    const tick = () => {
      if (i >= ordered.length) {
        setFeedDone(true);
        return;
      }
      const { idx } = ordered[i];
      setFeed((cur) => cur.map((r, j) => (j === idx ? { ...r, state: "running" } : r)));
      setTimeout(() => {
        setFeed((cur) =>
          cur.map((r, j) =>
            j === idx
              ? {
                  ...r,
                  state: "done",
                  cells: SOURCES[idx].manifest.length * 35 + Math.floor(Math.random() * 80),
                  duration: `${(1 + Math.random() * 4).toFixed(1)}s`,
                }
              : r,
          ),
        );
        i++;
        setTimeout(tick, 200);
      }, 500);
    };
    tick();
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
      cycleStore.setDocumentIds(
        result.uploaded
          .map((document) => document.id)
          .filter(Boolean),
      );
    }
    try {
      await startExtractionMutation.mutateAsync(false);
      startFeed();
    } catch (error) {
      if (isExtractionResultsConflict(error)) {
        setRerunModalOpen(true);
        return;
      }
      toast.error(error instanceof Error ? error.message : "Unable to start extraction");
    }
  };

  const rerunExtraction = async () => {
    try {
      await startExtractionMutation.mutateAsync(true);
      setRerunModalOpen(false);
      startFeed();
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

  const liveCount = SOURCES.filter((s) => s.status === "live").length;
  const staleCount = SOURCES.filter((s) => s.status === "stale").length;
  const downCount = SOURCES.filter((s) => s.status === "down").length;
  const uploadPending = uploadDocuments.isPending || startExtractionMutation.isPending;

  return (
    <PageShell
      title={`Ingestion — ${cycle.period} · ${cycle.company}`}
      subtitle="Upload source PDFs and trigger ingestion across 13 live data registries"
    >
      <div className="pb-24">
        {/* Active sector rule pack chip */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setRulesOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-[var(--color-tag-bg)]"
            style={{ borderColor: "var(--color-brand)", color: "var(--color-brand)" }}
          >
            <Layers className="h-3.5 w-3.5" />
            <span className="font-semibold">{pack.sector}</span>
            <span style={{ color: "var(--color-text-muted)" }}>·</span>
            <span>{pack.ruleCount} rules</span>
            <span style={{ color: "var(--color-text-muted)" }}>·</span>
            <span>{pack.template}</span>
            <span style={{ color: "var(--color-text-muted)" }}>·</span>
            <span>{pack.yearEnd} year-end</span>
          </button>
          <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
            Click to view rule pack
          </span>
        </div>

        {/* Upload zone */}
        <div className="mb-5 rounded-xl border bg-white p-6" style={{ borderColor: "var(--color-border-default)" }}>
          <div className="mb-4 text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Upload PSX Annual Report / Filing
          </div>

          {!selectedUploads.length ? (
            <label
              className="block cursor-pointer rounded-[10px] px-6 py-9 text-center transition-colors"
              style={{ border: "2px dashed var(--color-brand)", background: "transparent" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-tag-bg)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <CloudUpload className="mx-auto h-7 w-7" style={{ color: "var(--color-text-muted)" }} />
              <div className="mt-3 text-[14px]">
                <span className="font-bold" style={{ color: "var(--color-brand)" }}>Click to upload</span>{" "}
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
                <div key={fileKey(item.file)} className="flex items-center gap-3 rounded-lg border px-4 py-3" style={{ borderColor: "var(--color-border-default)" }}>
                  <FileText className="h-8 w-8 rounded-md p-1.5" style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium" style={{ color: "var(--color-text-primary)" }}>{item.file.name}</div>
                    <div className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>
                      {(item.file.size / (1024 * 1024)).toFixed(1)} MB · {uploadStatusLabel(item)}
                    </div>
                    {item.status === "failed" && item.message ? (
                      <div className="mt-1 text-[11px]" style={{ color: "var(--color-danger)" }}>{item.message}</div>
                    ) : null}
                  </div>
                  {item.status === "uploading" ? (
                    <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--color-brand)" }} />
                  ) : (
                    <button
                      onClick={() => removeSelectedFile(item.file)}
                      disabled={uploadPending}
                      className="rounded-md p-1.5 hover:bg-[var(--color-tag-bg)] disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
                    </button>
                  )}
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex h-8 cursor-pointer items-center rounded-md border px-3 text-[12px] font-semibold" style={{ borderColor: "var(--color-border-default)", color: "var(--color-brand)" }}>
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
                  style={{ borderColor: "var(--color-border-default)", color: "var(--color-text-secondary)" }}
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {rejectedFiles.length ? (
            <div className="mt-3 flex items-start gap-2 rounded-md border px-3 py-2 text-[12px]" style={{ borderColor: "var(--color-danger)", color: "var(--color-danger)" }}>
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Rejected non-PDF file{rejectedFiles.length === 1 ? "" : "s"}: {rejectedFiles.join(", ")}</span>
            </div>
          ) : null}

          {selectedUploads.length > 0 && (
            <div className="mt-4 flex items-center gap-3">
              <label className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>OCR confidence threshold:</label>
              <input
                type="range"
                min={70}
                max={99}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="flex-1 max-w-[260px]"
                style={{ accentColor: "var(--color-brand)" }}
              />
              <span className="text-[13px] font-semibold tnum" style={{ color: "var(--color-brand)" }}>{threshold}%</span>
              <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                Fields below this score route to manual review
              </span>
            </div>
          )}
        </div>

        {/* Source registry OR live feed */}
        {!running ? (
          <SourceRegistry sources={SOURCES} liveCount={liveCount} staleCount={staleCount} downCount={downCount} threshold={threshold} />
        ) : (
          <LiveFeed
            feed={feed}
            feedDone={feedDone}
            sources={SOURCES}
            threshold={threshold}
            ocrIssues={ocrIssues}
            ocrResolved={ocrResolved}
            setOcrResolved={setOcrResolved}
          />
        )}
      </div>

      {rulesOpen && <RulePackModal onClose={() => setRulesOpen(false)} />}
      {rerunModalOpen && (
        <RerunExtractionModal
          pending={startExtractionMutation.isPending}
          onClose={() => setRerunModalOpen(false)}
          onConfirm={rerunExtraction}
        />
      )}

      <StickyFooter
        running={running}
        fileCount={selectedUploads.length}
        uploadPending={uploadPending}
        hasProject={!!projectId}
        feed={feed}
        feedDone={feedDone}
        allResolved={allResolved}
        liveCount={liveCount}
        staleCount={staleCount}
        downCount={downCount}
        onStart={startIngestion}
        onOpenDiagnosis={() => {
          cycleStore.setStatus("diagnosis");
          navigate({ to: "/diagnosis" });
        }}
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
            <div className="text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Replace existing extraction results?
            </div>
            <div className="mt-2 text-[13px] leading-5" style={{ color: "var(--color-text-secondary)" }}>
              This project already has generated values in Diagnosis. Re-running extraction will replace the prior generated
              values with results from the currently uploaded reports.
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={pending}
            className="rounded p-1 hover:bg-[var(--color-tag-bg)] disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
          </button>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={pending}
            className="h-9 rounded-md border px-3 text-[13px] font-semibold disabled:opacity-50"
            style={{ borderColor: "var(--color-border-default)", color: "var(--color-text-secondary)" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={pending}
            className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-[13px] font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--color-brand)" }}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
            Re-run Extraction
          </button>
        </div>
      </div>
    </div>
  );
}

function RulePackModal({ onClose }: { onClose: () => void }) {
  const cycle = useCycle();
  const pack = getSectorPack(cycle.sector);
  const overrideSet = new Set(pack.sectorOverrides);
  const all = [...pack.sectorOverrides, ...pack.baseRules];

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
            <div className="text-[14px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
              {pack.sector} · Data Mapping Rules
            </div>
            <div className="mt-0.5 text-[12px]" style={{ color: "var(--color-text-muted)" }}>
              {pack.ruleCount} active rules · {pack.template} · {pack.yearEnd} year-end · {pack.currency}
            </div>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-[var(--color-tag-bg)]">
            <X className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
          </button>
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
                style={{ color: "var(--color-text-muted)", background: "var(--color-table-header)" }}
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
                  <tr key={`${rule}-${i}`} className="border-b" style={{ borderColor: "var(--color-border-default)" }}>
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
      </div>
    </div>
  );
}

function ConfPill({ v }: { v: number }) {
  const bg = v >= 90 ? "#E8F5E9" : v >= 70 ? "#FFF8E1" : "#FFEBEE";
  const fg = v >= 90 ? "#2E7D32" : v >= 70 ? "#B45309" : "#C62828";
  return (
    <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold tnum" style={{ background: bg, color: fg }}>
      {v}%
    </span>
  );
}

function SourceCard({ s, threshold }: { s: Source; threshold: number }) {
  const dot = s.status === "live" ? "#22C55E" : s.status === "stale" ? "#F59E0B" : "#EF4444";
  const key = `ss_src_open_${s.name}`;
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(key) === "1";
  });
  useEffect(() => {
    if (typeof window !== "undefined") window.sessionStorage.setItem(key, open ? "1" : "0");
  }, [open, key]);

  const lowConf = s.manifest.filter((f) => f.confidence < threshold);

  return (
    <div className="rounded-lg border bg-white" style={{ borderColor: "var(--color-border-default)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: dot, boxShadow: `0 0 0 3px ${dot}22` }} />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium" style={{ color: "var(--color-text-primary)" }}>{s.name}</div>
          <div className="text-[11px] truncate" style={{ color: "var(--color-text-muted)" }}>{s.updated}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
            {s.manifest.length === 0 ? "no data" : `${s.manifest.length} fields`}
            {lowConf.length > 0 && <span style={{ color: "#B45309" }}> · {lowConf.length} low</span>}
          </span>
          {s.status === "live" ? (
            <Check className="h-3.5 w-3.5" style={{ color: dot }} />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5" style={{ color: dot }} />
          )}
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" style={{ color: "var(--color-text-muted)" }} />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" style={{ color: "var(--color-text-muted)" }} />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t" style={{ borderColor: "var(--color-border-default)" }}>
          {s.manifest.length === 0 ? (
            <div className="px-3.5 py-4 text-[12px]" style={{ color: "var(--color-text-muted)" }}>
              No data extracted — source returned empty. Last successful extraction: 5 days ago.
            </div>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr
                  className="text-left text-[10px] uppercase"
                  style={{ color: "var(--color-text-muted)", background: "var(--color-table-header)" }}
                >
                  <th className="px-3 py-1.5">Field</th>
                  <th className="px-2 py-1.5">Extracted value</th>
                  <th className="px-2 py-1.5">Sheet</th>
                  <th className="px-2 py-1.5">Cell</th>
                  <th className="px-2 py-1.5">Conf</th>
                  <th className="px-2 py-1.5">Time</th>
                  <th className="px-2 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {s.manifest.slice(0, 12).map((f, i) => {
                  const low = f.confidence < threshold;
                  return (
                    <tr
                      key={i}
                      className="border-b"
                      style={{
                        borderColor: "#F3F4F6",
                        borderLeft: low ? "3px solid var(--color-warning)" : "3px solid transparent",
                      }}
                    >
                      <td className="px-3 py-1.5" style={{ color: "var(--color-text-primary)" }}>{f.field}</td>
                      <td className="px-2 py-1.5 tnum" style={{ color: "#1D4ED8" }}>{f.value}</td>
                      <td className="px-2 py-1.5 text-[11px]" style={{ color: "var(--color-text-muted)" }}>{f.sheet}</td>
                      <td className="px-2 py-1.5 font-mono text-[11px]" style={{ color: "var(--color-brand)" }}>{f.cell}</td>
                      <td className="px-2 py-1.5"><ConfPill v={f.confidence} /></td>
                      <td className="px-2 py-1.5 text-[11px]" style={{ color: "var(--color-text-muted)" }}>{f.timestamp}</td>
                      <td className="px-2 py-1.5 text-right">
                        <span className="text-[10px] font-semibold" style={{ color: "var(--color-brand)" }}>
                          Diagnosis
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {s.manifest.length > 12 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-2 text-[11px]" style={{ color: "var(--color-brand)" }}>
                      Show all {s.manifest.length} fields →
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryStrip({ sources, threshold }: { sources: Source[]; threshold: number }) {
  const totalFields = sources.reduce((a, s) => a + s.manifest.length, 0);
  const liveCount = sources.filter((s) => s.status === "live").length;
  const lowConfSources = sources.filter((s) => s.manifest.some((f) => f.confidence < threshold)).length;
  const emptySources = sources.filter((s) => s.manifest.length === 0).length;

  const Item = ({ label, value, tone }: { label: string; value: number; tone?: string }) => (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>{label}</span>
      <span className="text-[16px] font-bold tnum" style={{ color: tone ?? "var(--color-text-primary)" }}>{value}</span>
    </div>
  );

  return (
    <div
      className="mb-3 flex items-center gap-6 rounded-lg border bg-white px-4 py-3"
      style={{ borderColor: "var(--color-border-default)" }}
    >
      <Item label="Total fields" value={totalFields} />
      <Item label="Live sources" value={liveCount} tone="#16A34A" />
      <Item label="Low-conf sources" value={lowConfSources} tone="#B45309" />
      <Item label="Empty sources" value={emptySources} tone="#C62828" />
    </div>
  );
}

function SourceRegistry({
  sources,
  liveCount,
  staleCount,
  downCount,
  threshold,
}: {
  sources: Source[];
  liveCount: number;
  staleCount: number;
  downCount: number;
  threshold: number;
}) {
  return (
    <div className="rounded-xl border bg-white p-6" style={{ borderColor: "var(--color-border-default)" }}>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>Live Data Sources</div>
        <span
          className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
          style={{ background: "var(--color-success-bg)", color: "var(--color-success-fg)" }}
        >
          {sources.length} sources
        </span>
      </div>

      <SummaryStrip sources={sources} threshold={threshold} />

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {sources.map((s) => (
          <SourceCard key={s.name} s={s} threshold={threshold} />
        ))}
      </div>

      {(staleCount > 0 || downCount > 0) && (
        <div
          className="mt-4 flex items-start gap-2 rounded-md px-3.5 py-2.5 text-[12px]"
          style={{
            background: "var(--color-warning-bg)",
            borderLeft: "4px solid var(--color-warning)",
            color: "var(--color-warning-fg)",
          }}
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {downCount} source unreachable and {staleCount} stale. Ingestion will proceed with {liveCount} available sources.
            Admin can update credentials in Settings.
          </span>
        </div>
      )}
    </div>
  );
}

function LiveFeed({
  feed,
  feedDone,
  sources,
  threshold,
  ocrIssues,
  ocrResolved,
  setOcrResolved,
}: {
  feed: FeedRow[];
  feedDone: boolean;
  sources: Source[];
  threshold: number;
  ocrIssues: SourceRef[];
  ocrResolved: Record<number, boolean>;
  setOcrResolved: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
}) {
  return (
    <div className="rounded-xl border bg-white p-6" style={{ borderColor: "var(--color-border-default)" }}>
      <div className="mb-3 text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
        Ingestion in progress
      </div>
      <div className="divide-y" style={{ borderColor: "var(--color-border-default)" }}>
        {feed.map((row) => (
          <div key={row.name} className="flex items-center gap-3 py-2.5" style={{ borderBottomColor: "#F3F4F6" }}>
            {row.state === "running" && <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--color-brand)" }} />}
            {row.state === "done" && <Check className="h-4 w-4" style={{ color: "var(--color-success)" }} />}
            {row.state === "skipped" && <Minus className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />}
            {row.state === "pending" && <span className="h-4 w-4 rounded-full border" style={{ borderColor: "var(--color-border-strong)" }} />}
            <span className="text-[13px] font-medium" style={{ color: "var(--color-text-primary)" }}>{row.name}</span>
            <span className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>
              {row.state === "running" && "Extracting data..."}
              {row.state === "done" && `${row.cells} cells extracted`}
              {row.state === "skipped" && "Source unavailable — skipped"}
              {row.state === "pending" && "Queued"}
            </span>
            <span className="ml-auto text-[11px]" style={{ color: "var(--color-text-muted)" }}>
              {row.state === "done" ? `done · ${row.duration}` : ""}
            </span>
          </div>
        ))}
      </div>

      {feedDone && (
        <>
          {/* Per-source manifest reveal once ingestion completes */}
          <div className="mt-6">
            <div className="mb-3 text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Per-source ingestion manifest
            </div>
            <SummaryStrip sources={sources} threshold={threshold} />
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {sources.map((s) => (
                <SourceCard key={s.name} s={s} threshold={threshold} />
              ))}
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-3 text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
              OCR Quality Review — value · source snippet · action
            </div>
            <div className="space-y-2">
              {ocrIssues.map((o, idx) => {
                const resolved = idx === 0 || ocrResolved[idx];
                return (
                  <div
                    key={`${o.field}-${idx}`}
                    className="grid grid-cols-[1fr_280px_120px] gap-3 rounded-lg border p-3"
                    style={{
                      borderColor: "var(--color-border-default)",
                      opacity: resolved ? 0.6 : 1,
                      background: "#fff",
                    }}
                  >
                    <div>
                      <div className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>{o.field}</div>
                      <div className="mt-1 text-[16px] font-semibold tnum" style={{ color: "var(--color-text-primary)" }}>
                        {o.value}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <ConfPill v={o.conf} />
                        <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                          {o.doc} · p.{o.page}
                        </span>
                      </div>
                    </div>
                    <SourcePreview source={o} compact />
                    <div className="flex items-center justify-end">
                      {idx === 0 ? (
                        <span className="text-[11px]" style={{ color: "var(--color-success-fg)" }}>✓ auto-passed</span>
                      ) : resolved ? (
                        <span className="text-[11px]" style={{ color: "var(--color-success-fg)" }}>✓ resolved</span>
                      ) : (
                        <button
                          onClick={() => setOcrResolved((r) => ({ ...r, [idx]: true }))}
                          className="h-8 rounded-md px-3 text-[11px] font-semibold text-white"
                          style={{ background: "var(--color-brand)" }}
                        >
                          {o.conf >= 80 ? "Confirm" : "Edit"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StickyFooter({
  running,
  fileCount,
  uploadPending,
  hasProject,
  feed,
  feedDone,
  allResolved,
  liveCount,
  staleCount,
  downCount,
  onStart,
  onOpenDiagnosis,
}: {
  running: boolean;
  fileCount: number;
  uploadPending: boolean;
  hasProject: boolean;
  feed: FeedRow[];
  feedDone: boolean;
  allResolved: boolean;
  liveCount: number;
  staleCount: number;
  downCount: number;
  onStart: () => void;
  onOpenDiagnosis: () => void;
}) {
  const doneCount = feed.filter((r) => r.state === "done").length;
  const totalCount = feed.filter((r) => r.state !== "skipped").length;
  const pct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  return (
    <div
      className="fixed bottom-0 left-[240px] right-0 z-20 flex h-16 items-center justify-between border-t bg-white px-8"
      style={{ borderColor: "var(--color-border-default)" }}
    >
      {!running ? (
        <>
          <div className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
            {!hasProject ? "No project selected · " : fileCount ? `${fileCount} PDF${fileCount === 1 ? "" : "s"} selected · ` : "No PDF selected · "}
            13 sources ready ({liveCount} live, {staleCount} stale, {downCount} error)
          </div>
          <button
            onClick={onStart}
            disabled={!hasProject || !fileCount || uploadPending}
            className="h-10 rounded-lg px-5 text-[13px] font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: "var(--color-brand)" }}
          >
            {uploadPending ? "Uploading reports..." : "Upload and start extraction →"}
          </button>
        </>
      ) : (
        <>
          <div className="flex flex-1 items-center gap-4 pr-6">
            <div className="flex-1 max-w-md">
              <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: "var(--color-border-default)" }}>
                <div className="h-full transition-all" style={{ width: `${pct}%`, background: "var(--color-brand)" }} />
              </div>
            </div>
            <div className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
              {feedDone
                ? `Ingestion complete · ${allResolved ? "all clear" : "3 items need manual review"}`
                : `Ingesting… ${doneCount} of ${totalCount}`}
            </div>
          </div>
          <button
            onClick={onOpenDiagnosis}
            disabled={!allResolved}
            className="h-10 rounded-lg px-5 text-[13px] font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: "var(--color-brand)" }}
          >
            Open diagnosis →
          </button>
        </>
      )}
    </div>
  );
}
