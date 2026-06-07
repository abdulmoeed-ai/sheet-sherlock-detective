import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageShell, Card, Badge } from "@/components/PageShell";
import { Button } from "@/components/Button";
import { ApiErrorDetails } from "@/components/ApiErrorDetails";
import { ManagerRequestPanel } from "@/components/manager/ManagerRequestPanel";
import { ManagerReviewDetailHeader } from "@/components/manager/ManagerReviewDetailHeader";
import { ManagerReviewQueue } from "@/components/manager/ManagerReviewQueue";
import { cycleStore, useCycle } from "@/lib/cycle-store";
import { queryKeys } from "@/lib/api/query-keys";
import { listComments, readLatestExecutiveBrief } from "@/lib/api/projects";
import type { ReviewCommentResponse, WorkspaceResponse } from "@/lib/api/types";
import { auditRows, dashboardMetrics } from "@/lib/mappers/workspace";
import {
  managerApprovalButtonLabel,
  managerReviewSubtitle,
  managerReviewVersionLockMessage,
  routeAfterManagerApproval,
} from "@/lib/manager-review-workflow";
import {
  useCreateComment,
  useDeleteComment,
  useManagerDecision,
  useReopenComment,
  useResolveComment,
  useUpdateComment,
} from "@/hooks/use-project-actions";
import { useProjects, useWorkspace } from "@/hooks/use-projects";
import {
  clearSelectedProjectId,
  setSelectedProjectId,
  useSelectedProjectId,
} from "@/lib/project-store";
import {
  CheckCircle2,
  MessageSquare,
  Send,
  RotateCcw,
  FileCheck,
  Loader2,
  Edit3,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Manager Review - finance" },
      {
        name: "description",
        content:
          "Structured Finance Manager review pack: KPI summary, diff log, override log, inline comments.",
      },
    ],
  }),
  component: Review,
});

const FALLBACK_KPIS = [
  { label: "Revenue (FY25)", value: "PKR 54,800M", delta: "+8.4% YoY" },
  { label: "EBITDA Margin", value: "23.6%", delta: "+120 bps" },
  { label: "Gross Margin", value: "31.2%", delta: "+90 bps" },
  { label: "Operating CF", value: "PKR 11,420M", delta: "+4.1% YoY" },
  { label: "Net Debt / EBITDA", value: "0.42x", delta: "-0.08x" },
  { label: "Free Cash Flow", value: "PKR 7,650M", delta: "+6.0% YoY" },
];

const FALLBACK_DIFFS = [
  {
    id: "fallback-bs-d42",
    cell: "BS!D42",
    field: "Inventory",
    before: "6,040M",
    after: "1,840M",
    tier: "blocked",
    reason: "OCR digit transposition (p.74)",
  },
  {
    id: "fallback-is-c18",
    cell: "IS!C18",
    field: "EBITDA",
    before: "12,400M",
    after: "12,900M",
    tier: "flagged",
    reason: "Restated prior-year confirmed",
  },
  {
    id: "fallback-is-c24",
    cell: "IS!C24",
    field: "Net Profit",
    before: "8,190M",
    after: "8,210M",
    tier: "auto",
    reason: "Within 2% tolerance",
  },
];

const FALLBACK_OVERRIDES = [
  {
    id: "fallback-override-1",
    who: "Ayesha S.",
    cell: "BS!D42",
    action: "Accepted AI correction 6,040M -> 1,840M",
    reason: "OCR p.74 confirmed",
    at: "10:14",
  },
  {
    id: "fallback-override-2",
    who: "Ayesha S.",
    cell: "IS!C18",
    action: "Confirmed flagged diff",
    reason: "Tied to Note 21 restatement",
    at: "10:18",
  },
];

type KpiCard = { label: string; value: string; delta?: string };
type DiffRow = {
  id: string;
  cell: string;
  field: string;
  before: string;
  after: string;
  tier: string;
  reason: string;
};
type OverrideRow = {
  id: string;
  who: string;
  cell: string;
  action: string;
  reason: string;
  at: string;
};
type CommentRow = {
  id: string;
  author: string;
  text: string;
  at: string;
  status: string;
  target?: string;
  fieldId?: string | null;
  templateCell?: string | null;
  sheetName?: string | null;
};
type LooseRecord = Record<string, unknown>;

function Review() {
  const cycle = useCycle();
  const navigate = useNavigate();
  const projectId = useSelectedProjectId();
  const projects = useProjects();
  const workspace = useWorkspace(projectId);
  const managerDecision = useManagerDecision(projectId ?? "");
  const createComment = useCreateComment(projectId ?? "");
  const updateComment = useUpdateComment(projectId ?? "");
  const resolveComment = useResolveComment(projectId ?? "");
  const reopenComment = useReopenComment(projectId ?? "");
  const deleteComment = useDeleteComment(projectId ?? "");
  const [draft, setDraft] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");

  const commentsQuery = useQuery({
    queryKey: projectId ? queryKeys.comments(projectId) : ["projects", "none", "comments"],
    queryFn: () => listComments(projectId as string),
    enabled: !!projectId,
    retry: false,
  });
  const brief = useQuery({
    queryKey: projectId
      ? queryKeys.latestBrief(projectId)
      : ["projects", "none", "briefs", "latest"],
    queryFn: () => readLatestExecutiveBrief(projectId as string),
    enabled: !!projectId,
    retry: false,
  });

  const kpis = useMemo(() => metricCards(workspace.data), [workspace.data]);
  const diffs = useMemo(() => diffRows(workspace.data), [workspace.data]);
  const overrides = useMemo(() => overrideRows(workspace.data), [workspace.data]);
  const comments = useMemo(() => commentRows(commentsQuery.data), [commentsQuery.data]);
  const commentsSummary = isRecord(workspace.data?.review?.comments)
    ? workspace.data.review.comments
    : null;
  const project = workspace.data?.project;
  const decisionPending = managerDecision.isPending;
  const commentPending =
    createComment.isPending ||
    updateComment.isPending ||
    resolveComment.isPending ||
    reopenComment.isPending ||
    deleteComment.isPending;
  const actionDisabled = !projectId || workspace.isLoading || decisionPending;
  const pageError =
    workspace.error instanceof Error
      ? workspace.error.message
      : "Unable to load manager review workspace.";
  const commentsError =
    commentsQuery.error instanceof Error ? commentsQuery.error.message : "Unable to load comments.";
  const mutationError =
    managerDecision.error ??
    createComment.error ??
    updateComment.error ??
    resolveComment.error ??
    reopenComment.error ??
    deleteComment.error ??
    null;

  const submit = async () => {
    if (!projectId || !draft.trim()) return;
    await createComment.mutateAsync({ body: draft.trim(), sheetName: "Manager Review" });
    setDraft("");
  };

  const startEdit = (comment: CommentRow) => {
    setEditingCommentId(comment.id);
    setEditingBody(comment.text);
  };

  const saveEdit = async (comment: CommentRow) => {
    if (!projectId || !editingBody.trim()) return;
    await updateComment.mutateAsync({
      commentId: comment.id,
      input: {
        body: editingBody.trim(),
        fieldId: comment.fieldId ?? null,
        templateCell: comment.templateCell ?? null,
        sheetName: comment.sheetName ?? null,
      },
    });
    setEditingCommentId(null);
    setEditingBody("");
  };

  const sendBack = async () => {
    if (!projectId) return;
    await managerDecision.mutateAsync({
      action: "send_back",
      note: draft.trim() || "Returned for analyst updates.",
    });
    cycleStore.setStatus("review");
  };

  const approve = async () => {
    if (!projectId) return;
    cycleStore.setStatus("review");
    await managerDecision.mutateAsync({ action: "approve", note: draft.trim() || null });
    cycleStore.setStatus("approved");
    await brief.refetch();
    const nextRoute = routeAfterManagerApproval();
    if (nextRoute) {
      navigate({ to: nextRoute });
    }
  };

  return (
    <PageShell
      title={
        projectId
          ? `Manager Review · ${project?.companyName || cycle.company || "Selected Workbook"} ${project?.fiscalYear || cycle.period || ""}`
          : "Review Queue"
      }
      subtitle={managerReviewSubtitle(Boolean(projectId))}
      hideProgress
      actions={
        projectId && !workspace.isError ? (
          <>
            <Button variant="secondary" onClick={sendBack} disabled={actionDisabled}>
              {decisionPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}{" "}
              Send Back to Analyst
            </Button>
            <Button onClick={approve} disabled={actionDisabled}>
              {decisionPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}{" "}
              {managerApprovalButtonLabel()}
            </Button>
          </>
        ) : null
      }
    >
      {!projectId ? (
        <div className="space-y-5">
          <ManagerRequestPanel />
          <ManagerReviewQueue
            projects={projects.data ?? []}
            loading={projects.isLoading}
            onOpen={(id) => {
              setSelectedProjectId(id);
              navigate({ to: "/review" });
            }}
          />
        </div>
      ) : workspace.isLoading ? (
        <Card>
          <div className="flex items-center gap-2 text-[13px] text-[var(--color-text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading manager review pack...
          </div>
        </Card>
      ) : workspace.isError ? (
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div className="rounded-md bg-[var(--color-danger-bg)] px-3 py-2 text-[13px] text-[var(--color-danger-fg)]">
              {pageError}
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                clearSelectedProjectId();
                navigate({ to: "/review" });
              }}
            >
              Back to Review Queue
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {mutationError ? (
            <div className="mb-5">
              <ApiErrorDetails error={mutationError} fallback="Manager review request failed." />
            </div>
          ) : null}

          {project ? <ManagerReviewDetailHeader project={project} /> : null}

          <Card className="mb-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-[15px] font-semibold">Approval Status</h3>
                <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                  Workbook approval status and generated review pack details.
                </p>
              </div>
              {brief.isLoading ? (
                <Badge tone="neutral">Checking brief</Badge>
              ) : brief.data ? (
                <Badge tone={brief.data.status === "generated" ? "success" : "info"}>
                  {brief.data.status}
                </Badge>
              ) : (
                <Badge tone="warning">No brief yet</Badge>
              )}
            </div>
            {brief.data ? (
              <div className="mt-3 grid grid-cols-3 gap-3 text-[12px]">
                <div>
                  <div className="text-[var(--color-text-muted)]">Brief ID</div>
                  <div className="mt-1 font-mono">{brief.data.id}</div>
                </div>
                <div>
                  <div className="text-[var(--color-text-muted)]">Version</div>
                  <div className="mt-1 font-semibold">{brief.data.version}</div>
                </div>
                <div>
                  <div className="text-[var(--color-text-muted)]">Generated</div>
                  <div className="mt-1">{formatDate(brief.data.createdAt)}</div>
                </div>
              </div>
            ) : null}
          </Card>

          <Card className="mb-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold">Key Financial Summary</h3>
              <Badge tone="info">Source-backed</Badge>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {kpis.map((kpi) => (
                <div
                  key={kpi.label}
                  className="rounded-lg border p-4"
                  style={{ borderColor: "var(--color-border-default)" }}
                >
                  <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
                    {kpi.label}
                  </div>
                  <div className="mt-1 text-[20px] font-bold tnum">{kpi.value}</div>
                  {kpi.delta ? (
                    <div className="text-[11px] text-[var(--color-success-fg)]">{kpi.delta}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-5">
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[15px] font-semibold">Model Changes ({diffs.length})</h3>
                <Badge tone="info">Changes</Badge>
              </div>
              <table className="w-full text-[12px]">
                <thead className="border-b text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                  <tr>
                    <th className="py-2 text-left">Cell</th>
                    <th className="text-left">Field</th>
                    <th className="text-right">Before</th>
                    <th className="text-right">After</th>
                    <th className="text-left">Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {diffs.map((diff) => (
                    <tr key={diff.id} className="border-b last:border-0">
                      <td className="py-2 font-mono">{diff.cell}</td>
                      <td>
                        <div>{diff.field}</div>
                        <div className="text-[10px] text-[var(--color-text-muted)]">
                          {diff.reason}
                        </div>
                      </td>
                      <td className="text-right tnum">{diff.before}</td>
                      <td className="text-right tnum font-semibold">{diff.after}</td>
                      <td>
                        <Badge tone={tierTone(diff.tier)}>{diff.tier.toUpperCase()}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[15px] font-semibold">Analyst Adjustments</h3>
                <Badge tone="info">Adjustments</Badge>
              </div>
              <ol className="space-y-3">
                {overrides.map((override) => (
                  <li
                    key={override.id}
                    className="rounded-md border p-3"
                    style={{ borderColor: "var(--color-border-default)" }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold">{override.who}</span>
                      <span className="text-[11px] text-[var(--color-text-muted)]">
                        {override.at}
                      </span>
                    </div>
                    <div className="mt-1 text-[12px]">
                      <span className="font-mono font-semibold">{override.cell}</span> ·{" "}
                      {override.action}
                    </div>
                    <div className="text-[11px] text-[var(--color-text-muted)]">
                      Reason: {override.reason}
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          </div>

          <Card className="mt-5">
            <div className="mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[var(--color-brand)]" />
              <h3 className="text-[15px] font-semibold">Review Comments</h3>
              {commentsSummary?.open !== undefined ? (
                <Badge tone="info">{String(commentsSummary.open)} open</Badge>
              ) : null}
            </div>
            {commentsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-[13px] text-[var(--color-text-muted)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading comments...
              </div>
            ) : commentsQuery.isError ? (
              <div className="rounded-md bg-[var(--color-danger-bg)] px-3 py-2 text-[12px] text-[var(--color-danger-fg)]">
                {commentsError}
              </div>
            ) : comments.length === 0 ? (
              <div
                className="rounded-md border bg-[var(--color-table-row-alt)] p-3 text-[13px] text-[var(--color-text-secondary)]"
                style={{ borderColor: "var(--color-border-default)" }}
              >
                No review comments have been added yet.
              </div>
            ) : (
              <ol className="space-y-2">
                {comments.map((comment) => (
                  <li
                    key={comment.id}
                    className="rounded-md border bg-[var(--color-table-row-alt)] p-3"
                    style={{ borderColor: "var(--color-border-default)" }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold">{comment.author}</span>
                      <span className="text-[11px] text-[var(--color-text-muted)]">
                        {comment.at}
                      </span>
                    </div>
                    {editingCommentId === comment.id ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={editingBody}
                          onChange={(event) => setEditingBody(event.target.value)}
                          className="min-h-[72px] w-full rounded-md border px-3 py-2 text-[13px]"
                          style={{ borderColor: "var(--color-border-strong)" }}
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setEditingCommentId(null);
                              setEditingBody("");
                            }}
                            disabled={commentPending}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={() => saveEdit(comment)}
                            disabled={!editingBody.trim() || commentPending}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1 text-[13px]">{comment.text}</div>
                    )}
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
                      <Badge tone={comment.status === "resolved" ? "success" : "warning"}>
                        {comment.status}
                      </Badge>
                      {comment.target ? <span>{comment.target}</span> : null}
                    </div>
                    {editingCommentId !== comment.id ? (
                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => startEdit(comment)}
                          disabled={commentPending}
                        >
                          <Edit3 className="h-4 w-4" />
                          Edit
                        </Button>
                        {comment.status === "resolved" ? (
                          <Button
                            variant="secondary"
                            onClick={() => reopenComment.mutate(comment.id)}
                            disabled={commentPending}
                          >
                            Reopen
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            onClick={() => resolveComment.mutate(comment.id)}
                            disabled={commentPending}
                          >
                            Resolve
                          </Button>
                        )}
                        <Button
                          variant="danger"
                          onClick={() => deleteComment.mutate(comment.id)}
                          disabled={commentPending}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
            <div className="mt-3 flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Add review comment..."
                className="h-9 flex-1 rounded-md border px-3 text-[13px]"
                style={{ borderColor: "var(--color-border-strong)" }}
              />
              <Button onClick={submit} disabled={!draft.trim() || commentPending}>
                {commentPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}{" "}
                Post
              </Button>
            </div>
          </Card>

          <div className="mt-5 flex items-center gap-2 text-[12px] text-[var(--color-text-muted)]">
            <FileCheck className="h-4 w-4" />
            {managerReviewVersionLockMessage()}
          </div>
        </>
      )}
    </PageShell>
  );
}

function metricCards(workspace?: WorkspaceResponse): KpiCard[] {
  const metrics = dashboardMetrics(workspace);
  if (metrics.length === 0) return FALLBACK_KPIS;

  const rawMetrics = firstArray(
    workspace?.dashboard?.metrics,
    workspace?.dashboard?.kpis,
    workspace?.dashboard?.cards,
    workspace?.dashboard?.summary,
  );
  return metrics.map((metric, index) => ({
    label: metric.label,
    value: metric.value,
    delta:
      metric.delta ??
      stringValue(
        rawMetrics[index]?.period ?? rawMetrics[index]?.subtitle ?? rawMetrics[index]?.description,
        undefined,
      ),
  }));
}

function diffRows(workspace?: WorkspaceResponse): DiffRow[] {
  const rows = firstArray(
    workspace?.review?.rows,
    workspace?.review?.diffRows,
    workspace?.review?.changes,
    workspace?.review?.items,
  );
  const diffs = rows.flatMap((row, rowIndex) => flattenReviewRow(row, rowIndex)).slice(0, 8);
  return diffs.length > 0 ? diffs : FALLBACK_DIFFS;
}

function flattenReviewRow(row: LooseRecord, rowIndex: number): DiffRow[] {
  if (isRecord(row.cells)) {
    return Object.entries(row.cells).map(([period, cell], cellIndex) =>
      diffFromCell(row, isRecord(cell) ? cell : {}, `${rowIndex}-${period}-${cellIndex}`, period),
    );
  }
  return [diffFromCell(row, row, String(rowIndex), stringValue(row.period ?? row.year, ""))];
}

function diffFromCell(row: LooseRecord, cell: LooseRecord, id: string, period: string): DiffRow {
  const history = records(cell.history);
  const latestChange = [...history]
    .reverse()
    .find((entry) => stringValue(entry.action, "") !== "" && entry.action !== "source");
  const field = stringValue(row.label ?? row.field ?? row.name ?? cell.label, "Field");
  const sheet = stringValue(
    row.sheetName ?? row.sheet ?? cell.sheetName ?? cell.templateSheet,
    "Model",
  );
  const cellRef = stringValue(
    cell.templateCell ?? row.templateCell ?? row.cell ?? row.address,
    sheet,
  );
  const reason = firstString(
    latestChange?.note,
    firstArrayValue(cell.reasons),
    cell.source,
    row.reason,
    "Backend review row",
  );

  return {
    id: stringValue(cell.fieldId ?? row.fieldId ?? row.id, `diff-${id}`),
    cell: cellRef.includes("!") ? cellRef : `${sheet}!${cellRef}`,
    field: period ? `${field} (${period})` : field,
    before: firstString(latestChange?.oldValue, cell.oldValue, row.oldValue, "Source"),
    after: firstString(
      latestChange?.newValue,
      cell.newValue,
      cell.value,
      row.newValue,
      row.value,
      "-",
    ),
    tier: statusTier(
      stringValue(cell.status ?? row.status, "pending"),
      Number(cell.confidence ?? row.confidence ?? 0),
    ),
    reason,
  };
}

function overrideRows(workspace?: WorkspaceResponse): OverrideRow[] {
  const revisionOverrides = reviewRevisionOverrides(workspace);
  if (revisionOverrides.length > 0) return revisionOverrides.slice(0, 5);

  const events = auditRows(workspace)
    .filter((event) => /review|override|edit|decision|comment/i.test(event.action))
    .slice(-5)
    .reverse()
    .map((event) => ({
      id: event.id,
      who: event.actor,
      cell: firstString(event.payload?.templateCell, event.payload?.fieldId, "Project"),
      action: event.action.replaceAll("_", " "),
      reason: firstString(event.payload?.note, event.payload?.status, "Audit event"),
      at: formatDate(event.timestamp),
    }));

  return events.length > 0 ? events : FALLBACK_OVERRIDES;
}

function reviewRevisionOverrides(workspace?: WorkspaceResponse): OverrideRow[] {
  const rows = firstArray(workspace?.review?.rows);
  return rows.flatMap((row, rowIndex) => {
    if (!isRecord(row.cells)) return [];
    return Object.entries(row.cells).flatMap(([period, cell], cellIndex) => {
      const currentCell = isRecord(cell) ? cell : {};
      const history = records(currentCell.history);
      return history
        .filter((entry) => stringValue(entry.action, "") !== "" && entry.action !== "source")
        .map((entry, historyIndex) => {
          const sheet = stringValue(row.sheetName ?? currentCell.templateSheet, "Model");
          const cellRef = stringValue(currentCell.templateCell, sheet);
          return {
            id: stringValue(entry.id, `override-${rowIndex}-${cellIndex}-${historyIndex}`),
            who: stringValue(entry.actor, "Analyst"),
            cell: cellRef.includes("!") ? cellRef : `${sheet}!${cellRef}`,
            action: `${stringValue(entry.action, "updated")} ${stringValue(row.label, "field")} ${period}`,
            reason: firstString(
              entry.note,
              firstArrayValue(currentCell.reasons),
              "Review cell history",
            ),
            at: formatDate(stringValue(entry.createdAt, "")),
          };
        });
    });
  });
}

function commentRows(rawComments?: ReviewCommentResponse[] | LooseRecord[]): CommentRow[] {
  return (rawComments ?? []).map((comment, index) => {
    const item = comment as LooseRecord;
    const target = firstString(item.templateCell, item.sheetName, item.fieldId, "");
    return {
      id: stringValue(item.id, `comment-${index}`),
      author: stringValue(item.actor ?? item.author ?? item.user, "Reviewer"),
      text: stringValue(item.body ?? item.text ?? item.comment, ""),
      at: formatDate(stringValue(item.createdAt ?? item.updatedAt, "")),
      status: stringValue(item.status, "open"),
      target: target || undefined,
      fieldId: stringOrNull(item.fieldId),
      templateCell: stringOrNull(item.templateCell),
      sheetName: stringOrNull(item.sheetName),
    };
  });
}

function hasReviewRows(workspace?: WorkspaceResponse): boolean {
  return (
    firstArray(
      workspace?.review?.rows,
      workspace?.review?.diffRows,
      workspace?.review?.changes,
      workspace?.review?.items,
    ).length > 0
  );
}

function tierTone(tier: string): "success" | "warning" | "danger" | "info" {
  if (["auto", "accepted", "approved", "closed"].includes(tier)) return "success";
  if (["flagged", "pending", "open", "review"].includes(tier)) return "warning";
  if (["blocked", "rejected", "error", "failed"].includes(tier)) return "danger";
  return "info";
}

function statusTier(status: string, confidence: number): string {
  const normalized = status.toLowerCase();
  if (["accepted", "approved", "edited", "auto"].includes(normalized))
    return normalized === "edited" ? "flagged" : "auto";
  if (["rejected", "blocked", "failed", "error"].includes(normalized)) return "blocked";
  if (confidence > 0 && confidence < 70) return "flagged";
  return normalized || "pending";
}

function formatDate(value: string): string {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function firstArray(...values: unknown[]): LooseRecord[] {
  for (const value of values) {
    if (Array.isArray(value)) return value.filter(isRecord);
  }
  return [];
}

function firstArrayValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : undefined;
}

function records(value: unknown): LooseRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function isRecord(value: unknown): value is LooseRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return String(value);
  }
  return "";
}

function stringValue(value: unknown, fallback: string): string;
function stringValue(value: unknown, fallback: undefined): string | undefined;
function stringValue(value: unknown, fallback: string | undefined): string | undefined {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}
