import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageShell, Card, Badge } from "@/components/PageShell";
import { Button } from "@/components/Button";
import { ApiErrorDetails } from "@/components/ApiErrorDetails";
import { useCfoSignoff } from "@/hooks/use-project-actions";
import { useWorkspace } from "@/hooks/use-projects";
import { ApiError } from "@/lib/api/errors";
import { readLatestArchive, readLatestExecutiveBrief } from "@/lib/api/projects";
import type { ExecutiveBriefResponse, ModelArchiveResponse } from "@/lib/api/types";
import { queryKeys } from "@/lib/api/query-keys";
import { useSelectedProjectId } from "@/lib/project-store";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  FileText,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";

export const Route = createFileRoute("/sign-off")({
  head: () => ({
    meta: [
      { title: "CFO Sign-Off - finance" },
      {
        name: "description",
        content: "One-page executive brief and version-locked approval for the CFO.",
      },
    ],
  }),
  component: SignOff,
});

type JsonRecord = Record<string, unknown>;

function SignOff() {
  const projectId = useSelectedProjectId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [lastDecision, setLastDecision] = useState<"approved" | "rejected" | null>(null);

  const workspace = useWorkspace(projectId);
  const brief = useQuery({
    queryKey: projectId
      ? queryKeys.latestBrief(projectId)
      : ["projects", "none", "briefs", "latest"],
    queryFn: () => readLatestExecutiveBrief(projectId as string),
    enabled: !!projectId,
    retry: false,
  });
  const archive = useQuery({
    queryKey: projectId
      ? queryKeys.latestArchive(projectId)
      : ["projects", "none", "archive", "latest"],
    queryFn: () => readLatestArchive(projectId as string),
    enabled: !!projectId,
    retry: false,
  });
  const signoff = useCfoSignoff(projectId ?? "__no_project__");

  const project = workspace.data?.project;
  const payload = recordValue(brief.data?.payload);
  const header = recordValue(payload.header);
  const approvalStatus = recordValue(payload.approvalStatus);
  const company = project?.companyName ?? stringValue(header.company) ?? "Selected project";
  const period = project?.fiscalYear ?? stringValue(header.period) ?? "Current period";
  const projectStatus = project?.status ?? stringValue(approvalStatus.projectStatus) ?? "unknown";
  const isApproved =
    projectStatus === "approved" || archive.data?.status === "approved" || !!brief.data?.lockedAt;
  const isAwaitingCfo = projectStatus === "cfo_review";
  const briefMissing = isNotFound(brief.error);
  const blockingError = workspace.error ?? (!briefMissing ? brief.error : null);
  const isInitialLoading = !!projectId && (workspace.isLoading || brief.isLoading);
  const hasGeneratedBrief = brief.data?.status === "generated";
  const canApprove = !!projectId && isAwaitingCfo && hasGeneratedBrief && !signoff.isPending;
  const canReject = !!projectId && isAwaitingCfo && !signoff.isPending;

  const submitDecision = (approved: boolean) => {
    if (!projectId) return;
    signoff.mutate(
      {
        approved,
        note: note.trim() ? note.trim() : null,
        briefId: approved ? (brief.data?.id ?? null) : null,
      },
      {
        onSuccess: () => {
          setLastDecision(approved ? "approved" : "rejected");
          setNote("");
          queryClient.invalidateQueries({ queryKey: queryKeys.workspace(projectId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.latestBrief(projectId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.latestArchive(projectId) });
        },
      },
    );
  };

  return (
    <PageShell
      title={projectId ? `CFO Sign-Off - ${company} ${period}` : "CFO Sign-Off"}
      subtitle={
        projectId
          ? "One-page executive brief. Sign-off is version-locked and recorded in the audit trail."
          : "Select a workbook to review the latest executive brief."
      }
      hideProgress
      actions={
        !projectId ? (
          <Button variant="secondary" onClick={() => navigate({ to: "/registry" })}>
            <Archive className="h-4 w-4" /> Select project
          </Button>
        ) : isApproved ? (
          <Badge tone="success">
            <CheckCircle2 className="mr-1 inline h-3 w-3" /> Approved & locked
          </Badge>
        ) : (
          <>
            <Button variant="secondary" onClick={() => submitDecision(false)} disabled={!canReject}>
              <XCircle className="h-4 w-4" /> Request changes
            </Button>
            <Button onClick={() => submitDecision(true)} disabled={!canApprove}>
              <Lock className="h-4 w-4" /> Sign & lock version
            </Button>
          </>
        )
      }
    >
      {!projectId ? (
        <NoProjectState />
      ) : isInitialLoading ? (
        <LoadingState />
      ) : blockingError ? (
        <ErrorState
          title="CFO sign-off failed to load"
          message={errorMessage(blockingError)}
          onRetry={() => {
            workspace.refetch();
            brief.refetch();
            archive.refetch();
          }}
        />
      ) : (
        <>
          <DecisionBanner
            lastDecision={lastDecision}
            projectStatus={projectStatus}
            signoffMessage={signoff.data?.message}
            archive={archive.data}
            onAudit={() => navigate({ to: "/audit" })}
          />

          {signoff.error ? (
            <div className="mb-5">
              <ApiErrorDetails error={signoff.error} fallback="CFO sign-off request failed." />
            </div>
          ) : null}

          <Card className="mb-5">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--color-accent-sparkle)]" />
              <Badge tone="ai">Auto-generated executive brief</Badge>
              <Badge tone="neutral">{brief.data ? versionLabel(brief.data) : "No brief"}</Badge>
              <Badge tone={statusTone(projectStatus)}>{projectStatus}</Badge>
            </div>
            <h2 className="mt-2 text-[20px] font-bold">
              {company} - {period}
            </h2>
            {briefMissing ? (
              <MissingBriefState status={projectStatus} />
            ) : (
              <ExecutiveBrief brief={brief.data} />
            )}
          </Card>

          <div className="grid grid-cols-2 gap-5">
            <Card>
              <h3 className="mb-2 text-[15px] font-semibold">CFO decision note</h3>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional note for the audit trail..."
                className="min-h-28 w-full rounded-md border px-3 py-2 text-[13px] outline-none"
                style={{ borderColor: "var(--color-border-strong)" }}
                disabled={isApproved || signoff.isPending}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => submitDecision(false)}
                  disabled={!canReject}
                >
                  <XCircle className="h-4 w-4" /> Request changes
                </Button>
                <Button onClick={() => submitDecision(true)} disabled={!canApprove}>
                  <Lock className="h-4 w-4" /> Sign & lock version
                </Button>
              </div>
              <div className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                {decisionHint(projectStatus, hasGeneratedBrief)}
              </div>
            </Card>

            <ArchiveCard archive={archive} onAudit={() => navigate({ to: "/audit" })} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-5">
            <RiskCard payload={payload} />
            <GovernanceCard
              brief={brief.data}
              archive={archive.data}
              payload={payload}
              projectStatus={projectStatus}
            />
          </div>
        </>
      )}
    </PageShell>
  );
}

function ExecutiveBrief({ brief }: { brief?: ExecutiveBriefResponse }) {
  if (!brief) return null;

  const payload = recordValue(brief.payload);
  const narrative = recordValue(payload.narrative);
  const keyMetrics = arrayValue(payload.keyMetrics);
  const summary =
    stringValue(narrative.executiveSummary) ?? "Latest executive brief is ready for CFO review.";

  return (
    <>
      <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">{summary}</p>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {keyMetrics.length > 0 ? (
          keyMetrics.map((metric, index) => (
            <div
              key={`${stringValue(metric.name) ?? "metric"}-${index}`}
              className="rounded-lg border p-3"
              style={{ borderColor: "var(--color-border-default)" }}
            >
              <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
                {stringValue(metric.name) ?? "Metric"}
              </div>
              <div className="mt-1 text-[18px] font-bold tnum">{formatValue(metric.value)}</div>
              <div className="text-[11px] text-[var(--color-success-fg)]">
                {citationLabel(recordValue(metric.citation))}
              </div>
            </div>
          ))
        ) : (
          <div
            className="col-span-3 rounded-lg border border-dashed p-4 text-[13px] text-[var(--color-text-muted)]"
            style={{ borderColor: "var(--color-border-default)" }}
          >
            No key metrics were returned in the latest brief payload.
          </div>
        )}
      </div>
    </>
  );
}

function MissingBriefState({ status }: { status: string }) {
  return (
    <div
      className="mt-4 flex items-start gap-3 rounded-[10px] border border-dashed px-5 py-4"
      style={{ borderColor: "var(--color-border-default)" }}
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 text-[var(--color-warning-fg)]" />
      <div>
        <div className="text-[13px] font-semibold">
          No executive brief is available for this project.
        </div>
        <div className="mt-1 text-[12px] text-[var(--color-text-muted)]">
          Current project status is {status}. Generate an executive brief before CFO approval.
        </div>
      </div>
    </div>
  );
}

function DecisionBanner({
  lastDecision,
  projectStatus,
  signoffMessage,
  archive,
  onAudit,
}: {
  lastDecision: "approved" | "rejected" | null;
  projectStatus: string;
  signoffMessage?: string;
  archive?: ModelArchiveResponse;
  onAudit: () => void;
}) {
  const approved = lastDecision === "approved" || projectStatus === "approved";
  const rejected = lastDecision === "rejected" || projectStatus === "cfo_changes_requested";
  if (!approved && !rejected) return null;

  return (
    <div
      className="mb-5 flex items-center gap-3 rounded-[10px] border px-5 py-3.5"
      style={{
        background: approved ? "var(--color-success-bg)" : "var(--color-warning-bg)",
        borderColor: approved ? "var(--color-success-border)" : "#FCD34D",
      }}
    >
      {approved ? (
        <ShieldCheck className="h-5 w-5" style={{ color: "var(--color-success-fg)" }} />
      ) : (
        <AlertTriangle className="h-5 w-5" style={{ color: "var(--color-warning-fg)" }} />
      )}
      <div
        className="flex-1 text-[13px] font-semibold"
        style={{ color: approved ? "var(--color-success-fg)" : "var(--color-warning-fg)" }}
      >
        {signoffMessage ??
          (approved ? "CFO sign-off recorded and model version locked." : "CFO requested changes.")}
      </div>
      <Button variant="secondary" onClick={onAudit} disabled={!archive?.id}>
        <FileText className="h-4 w-4" /> View audit trail
      </Button>
    </div>
  );
}

function ArchiveCard({
  archive,
  onAudit,
}: {
  archive: ReturnType<typeof useQuery<ModelArchiveResponse, Error>>;
  onAudit: () => void;
}) {
  const archiveMissing = isNotFound(archive.error);
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold">Archive & audit</h3>
        {archive.data ? (
          <Badge tone={statusTone(archive.data.status)}>{archive.data.status}</Badge>
        ) : (
          <Badge tone="neutral">Pending</Badge>
        )}
      </div>
      {archive.isLoading ? (
        <div className="flex items-center gap-2 text-[13px] text-[var(--color-text-muted)]">
          <RefreshCw className="h-4 w-4 animate-spin" /> Checking latest archive...
        </div>
      ) : archive.data ? (
        <div className="space-y-2 text-[12px] text-[var(--color-text-secondary)]">
          <ArchiveRow label="Archive ID" value={archive.data.id} mono />
          <ArchiveRow label="Version" value={`v${archive.data.version}`} />
          <ArchiveRow label="Created" value={formatDate(archive.data.createdAt)} />
          <ArchiveRow
            label="Checksum"
            value={archive.data.checksumSha256.slice(0, 16) + "..."}
            mono
          />
          <div className="pt-2">
            <Button variant="secondary" onClick={onAudit}>
              <FileText className="h-4 w-4" /> Open audit trail
            </Button>
          </div>
        </div>
      ) : archiveMissing ? (
        <div className="text-[13px] text-[var(--color-text-muted)]">
          No archive has been created yet. The audit export link becomes available after approval.
        </div>
      ) : archive.error ? (
        <div className="flex items-start gap-2 text-[13px] text-[var(--color-danger-fg)]">
          <AlertTriangle className="mt-0.5 h-4 w-4" /> {errorMessage(archive.error)}
        </div>
      ) : (
        <div className="text-[13px] text-[var(--color-text-muted)]">Archive status is pending.</div>
      )}
    </Card>
  );
}

function RiskCard({ payload }: { payload: JsonRecord }) {
  const narrative = recordValue(payload.narrative);
  const risks = stringValue(narrative.risksAndCaveats);
  const drivers = stringValue(narrative.performanceDrivers);
  const outlook = stringValue(narrative.forecastOutlook);
  const items = [risks, drivers, outlook].filter(Boolean);

  return (
    <Card>
      <h3 className="mb-2 text-[15px] font-semibold">Key risks (Prediction Agent)</h3>
      {items.length > 0 ? (
        <ul className="space-y-2 text-[13px]">
          {items.map((item, index) => (
            <li key={index}>- {item}</li>
          ))}
        </ul>
      ) : (
        <div className="text-[13px] text-[var(--color-text-muted)]">
          No risk narrative was returned in the latest brief.
        </div>
      )}
    </Card>
  );
}

function GovernanceCard({
  brief,
  archive,
  payload,
  projectStatus,
}: {
  brief?: ExecutiveBriefResponse;
  archive?: ModelArchiveResponse;
  payload: JsonRecord;
  projectStatus: string;
}) {
  const threeStatement = recordValue(payload.threeStatementStatus);
  const openReviewItems = recordValue(payload.openReviewItems);
  const sourceCoverage = recordValue(payload.sourceCoverage);
  const checks = [
    ["Project status", projectStatus],
    ["Executive brief", brief ? `${brief.status} v${brief.version}` : "missing"],
    ["3-statement check", stringValue(threeStatement.status) ?? "not_run"],
    ["Open review comments", formatValue(openReviewItems.commentsOpen ?? 0)],
    ["Cited sources", formatValue(sourceCoverage.citedSourceCount ?? 0)],
    ["Audit archive", archive ? `${archive.status} v${archive.version}` : "pending"],
  ];

  return (
    <Card>
      <h3 className="mb-2 text-[15px] font-semibold">Governance checklist</h3>
      <ul className="space-y-2 text-[13px]">
        {checks.map(([label, value]) => (
          <li key={label}>
            <CheckCircle2 className="mr-1 inline h-4 w-4 text-[var(--color-success-fg)]" /> {label}:{" "}
            {value}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function NoProjectState() {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <Archive className="mt-0.5 h-5 w-5 text-[var(--color-brand)]" />
        <div>
          <div className="text-[14px] font-semibold">No project selected</div>
          <div className="mt-1 text-[13px] text-[var(--color-text-muted)]">
            Select a workbook to load its CFO sign-off pack.
          </div>
        </div>
      </div>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="space-y-5">
      <Card>
        <div className="space-y-3 py-2">
          <div className="h-5 w-52 animate-pulse rounded-md bg-[var(--color-tag-bg)]" />
          <div className="h-4 w-full animate-pulse rounded-md bg-[var(--color-tag-bg)]" />
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-20 animate-pulse rounded-lg bg-[var(--color-tag-bg)]" />
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

function ErrorState({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card>
      <div
        className="flex items-center gap-3 rounded-[10px] border px-5 py-4"
        style={{ borderColor: "#FCA5A5" }}
      >
        <AlertTriangle className="h-5 w-5 text-[var(--color-danger-fg)]" />
        <div className="flex-1">
          <div className="text-[13px] font-semibold text-[var(--color-danger-fg)]">{title}</div>
          <div className="mt-1 text-[12px] text-[var(--color-text-muted)]">{message}</div>
        </div>
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      </div>
    </Card>
  );
}

function ArchiveRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className={mono ? "font-mono" : "font-semibold"}>{value}</span>
    </div>
  );
}

function recordValue(value: unknown): JsonRecord {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function arrayValue(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.map(recordValue).filter((item) => Object.keys(item).length > 0)
    : [];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function formatValue(value: unknown): string {
  if (value == null || value === "") return "n/a";
  if (typeof value === "number")
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function citationLabel(citation: JsonRecord): string {
  if (citation.sourceType === "unavailable") return "Citation unavailable";
  const parts = [
    stringValue(citation.sheet),
    stringValue(citation.cell),
    citation.page ? `p.${formatValue(citation.page)}` : undefined,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" - ") : "Source cited";
}

function versionLabel(brief: ExecutiveBriefResponse): string {
  return `Brief v${brief.version}${brief.lockedAt ? " locked" : ""}`;
}

function statusTone(status: string): "neutral" | "success" | "danger" | "warning" | "info" | "ai" {
  if (status === "approved" || status === "generated" || status === "locked") return "success";
  if (status === "cfo_review" || status === "manager_review" || status === "pending")
    return "warning";
  if (
    status.includes("rejected") ||
    status.includes("changes_requested") ||
    status.includes("failed")
  )
    return "danger";
  if (status === "unknown") return "neutral";
  return "info";
}

function decisionHint(projectStatus: string, hasGeneratedBrief: boolean): string {
  if (projectStatus === "approved") return "This project is already approved and locked.";
  if (projectStatus === "cfo_changes_requested")
    return "Changes have been requested and recorded in the audit trail.";
  if (projectStatus !== "cfo_review")
    return "CFO decisions are enabled only when the project is awaiting CFO review.";
  if (!hasGeneratedBrief)
    return "Approval requires a generated executive brief; rejection can still be recorded.";
  return "Approval locks this brief version and creates the archive audit package.";
}

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected request failure.";
}
