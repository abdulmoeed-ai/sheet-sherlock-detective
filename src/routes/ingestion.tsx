import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, CloudUpload, FileText, Loader2, Radio } from "lucide-react";
import { PageShell, Card, Badge } from "@/components/PageShell";
import { Button } from "@/components/Button";
import { readSourceRegistry } from "@/lib/api/source-registry";
import { readExtractionJob, readMappingRules } from "@/lib/api/projects";
import { queryKeys } from "@/lib/api/query-keys";
import { useSelectedProjectId } from "@/lib/project-store";
import { useWorkspace } from "@/hooks/use-projects";
import {
  useAcknowledgeMappingRules,
  useStartExtraction,
  useUploadDocument,
} from "@/hooks/use-project-actions";
import { useProgressStream } from "@/hooks/use-progress-stream";
import { ApiError } from "@/lib/api/errors";

export const Route = createFileRoute("/ingestion")({
  head: () => ({
    meta: [
      { title: "Ingestion — Sheet Sherlock" },
      { name: "description", content: "Upload filings and run backend extraction." },
    ],
  }),
  component: Ingestion,
});

function Ingestion() {
  const navigate = useNavigate();
  const projectId = useSelectedProjectId();
  const workspace = useWorkspace(projectId);
  const sources = useQuery({ queryKey: queryKeys.sourceRegistry, queryFn: readSourceRegistry });
  const mappingRules = useQuery({
    queryKey: projectId ? queryKeys.mappingRules(projectId) : ["mapping-rules", "none"],
    queryFn: () => readMappingRules(projectId as string),
    enabled: !!projectId,
  });
  const upload = useUploadDocument(projectId ?? "");
  const startExtraction = useStartExtraction(projectId ?? "");
  const acknowledgeRules = useAcknowledgeMappingRules(projectId ?? "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const progress = useProgressStream(projectId);
  const job = useQuery({
    queryKey:
      projectId && jobId ? queryKeys.extractionJob(projectId, jobId) : ["extraction-job", "none"],
    queryFn: () => readExtractionJob(projectId as string, jobId as string),
    enabled: !!projectId && !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "completed" || status === "failed" ? false : 2000;
    },
  });

  const error =
    apiError(upload.error) ??
    apiError(startExtraction.error) ??
    apiError(acknowledgeRules.error) ??
    apiError(job.error);
  const documents = workspace.data?.documents ?? [];
  const latestJob = job.data;

  const runUpload = async () => {
    if (!selectedFile || !projectId) return;
    await upload.mutateAsync(selectedFile);
    setSelectedFile(null);
  };

  const runExtraction = async () => {
    if (!projectId) return;
    const nextJob = await startExtraction.mutateAsync(false);
    setJobId(nextJob.id);
  };

  const acknowledge = async () => {
    if (!mappingRules.data || !projectId) return;
    await acknowledgeRules.mutateAsync({
      rulesHash: mappingRules.data.rulesHash,
      rulesCount: mappingRules.data.rulesCount,
      acknowledged: true,
    });
  };

  return (
    <PageShell
      title="Ingestion"
      subtitle="Upload annual report PDFs, acknowledge mapping rules, and run extraction."
    >
      {!projectId ? (
        <Card>
          <div className="text-[13px] text-[var(--color-text-secondary)]">
            Select or convert a project before ingestion.
          </div>
        </Card>
      ) : (
        <div className="space-y-5">
          {error && (
            <div
              className="rounded-lg border px-4 py-3 text-[13px]"
              style={{
                borderColor: "var(--color-danger-border)",
                background: "var(--color-danger-bg)",
                color: "var(--color-danger-fg)",
              }}
            >
              {error}
            </div>
          )}

          <div className="grid grid-cols-4 gap-4">
            <Metric label="Documents" value={documents.length} />
            <Metric label="Sources" value={sources.data?.sources.length ?? 0} />
            <Metric label="Rules" value={mappingRules.data?.rulesCount ?? "-"} />
            <Metric
              label="Progress"
              value={latestJob?.percent ?? progress.lastEvent?.percent ?? 0}
            />
          </div>

          <Card>
            <div className="mb-3 flex items-center gap-2">
              <CloudUpload className="h-4 w-4 text-[var(--color-brand)]" />
              <h2 className="text-[15px] font-semibold">Upload PDF</h2>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                className="flex-1 rounded-md border px-3 py-2 text-[13px]"
                style={{ borderColor: "var(--color-border-strong)" }}
              />
              <Button onClick={runUpload} disabled={!selectedFile || upload.isPending}>
                {upload.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CloudUpload className="h-4 w-4" />
                )}
                Upload
              </Button>
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[var(--color-brand)]" />
                <h2 className="text-[15px] font-semibold">Mapping rules</h2>
              </div>
              <Badge tone={mappingRules.data?.acknowledged ? "success" : "warning"}>
                {mappingRules.data?.acknowledged ? "Acknowledged" : "Required"}
              </Badge>
            </div>
            <p className="text-[13px] text-[var(--color-text-secondary)]">
              {mappingRules.data
                ? `${mappingRules.data.enabledRulesCount}/${mappingRules.data.rulesCount} rules enabled.`
                : "Loading rules..."}
            </p>
            {!mappingRules.data?.acknowledged && mappingRules.data && (
              <div className="mt-3">
                <Button
                  variant="secondary"
                  onClick={acknowledge}
                  disabled={acknowledgeRules.isPending}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Acknowledge rules
                </Button>
              </div>
            )}
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-[var(--color-brand)]" />
                <h2 className="text-[15px] font-semibold">Extraction job</h2>
              </div>
              <Button
                onClick={runExtraction}
                disabled={!mappingRules.data?.acknowledged || startExtraction.isPending}
              >
                {startExtraction.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Radio className="h-4 w-4" />
                )}
                Start extraction
              </Button>
            </div>
            {latestJob ? (
              <div
                className="rounded-md border px-4 py-3"
                style={{ borderColor: "var(--color-border-default)" }}
              >
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-semibold">{latestJob.message}</div>
                  <Badge
                    tone={
                      latestJob.status === "failed"
                        ? "danger"
                        : latestJob.status === "completed"
                          ? "success"
                          : "info"
                    }
                  >
                    {latestJob.status}
                  </Badge>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-border-default)]">
                  <div
                    className="h-full bg-[var(--color-brand)]"
                    style={{ width: `${latestJob.percent}%` }}
                  />
                </div>
                {latestJob.error && (
                  <div className="mt-2 flex items-center gap-2 text-[12px] text-[var(--color-danger-fg)]">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {latestJob.error}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-[13px] text-[var(--color-text-muted)]">
                No extraction job started in this session.
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-[15px] font-semibold">Uploaded documents</h2>
            {documents.length === 0 ? (
              <div className="text-[13px] text-[var(--color-text-muted)]">
                No documents uploaded yet.
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((document) => (
                  <div
                    key={document.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                    style={{ borderColor: "var(--color-border-default)" }}
                  >
                    <div>
                      <div className="text-[13px] font-semibold">{document.filename}</div>
                      <div className="text-[11px] text-[var(--color-text-muted)]">
                        {document.pages} pages · {document.sizeMB} MB
                      </div>
                    </div>
                    <Badge tone="info">{document.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => navigate({ to: "/diff-review" })}>Open Diff Review</Button>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <div className="text-[12px] uppercase tracking-wider text-[var(--color-text-secondary)]">
        {label}
      </div>
      <div className="mt-2 text-[24px] font-bold tnum">{value}</div>
    </Card>
  );
}

function apiError(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Request failed.";
}
