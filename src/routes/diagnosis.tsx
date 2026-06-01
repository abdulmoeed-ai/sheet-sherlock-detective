import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Loader2, MessageSquare, RefreshCw, Send, X } from "lucide-react";
import { PageShell, Card, Badge } from "@/components/PageShell";
import { Button } from "@/components/Button";
import { ApiErrorDetails } from "@/components/ApiErrorDetails";
import { useSelectedProjectId } from "@/lib/project-store";
import { useWorkspace } from "@/hooks/use-projects";
import {
  useAcceptDiagnosis,
  useCreateComment,
  useDecideDiagnosis,
  useReopenComment,
  useResolveComment,
  useRunDiagnosis,
} from "@/hooks/use-project-actions";
import { workbookSheets } from "@/lib/mappers/workspace";
import { queryKeys } from "@/lib/api/query-keys";
import { listComments } from "@/lib/api/projects";

export const Route = createFileRoute("/diagnosis")({
  head: () => ({
    meta: [
      { title: "Diagnosis — Sheet Sherlock" },
      { name: "description", content: "Backend balance sheet diagnosis workflow." },
    ],
  }),
  component: Diagnosis,
});

function Diagnosis() {
  const navigate = useNavigate();
  const projectId = useSelectedProjectId();
  const workspace = useWorkspace(projectId);
  const runDiagnosis = useRunDiagnosis(projectId ?? "");
  const acceptDiagnosis = useAcceptDiagnosis(projectId ?? "");
  const decideDiagnosis = useDecideDiagnosis(projectId ?? "");
  const createComment = useCreateComment(projectId ?? "");
  const resolveComment = useResolveComment(projectId ?? "");
  const reopenComment = useReopenComment(projectId ?? "");
  const [commentDraft, setCommentDraft] = useState("");
  const [reasonCodes, setReasonCodes] = useState<Record<string, string>>({});
  const sheets = workbookSheets(workspace.data);
  const diagnosis = workspace.data?.balanceSheetDiagnosis;
  const candidates = Array.isArray(diagnosis?.candidates)
    ? diagnosis.candidates.filter(isRecord)
    : [];
  const commentsQuery = useQuery({
    queryKey: projectId ? queryKeys.comments(projectId) : ["projects", "none", "comments"],
    queryFn: () => listComments(projectId as string),
    enabled: !!projectId,
    retry: false,
  });
  const error =
    runDiagnosis.error ??
    acceptDiagnosis.error ??
    decideDiagnosis.error ??
    createComment.error ??
    resolveComment.error ??
    reopenComment.error;

  const submitComment = async () => {
    if (!projectId || !commentDraft.trim()) return;
    await createComment.mutateAsync({ body: commentDraft.trim(), sheetName: "Diagnosis" });
    setCommentDraft("");
  };

  return (
    <PageShell title="Diagnosis" subtitle="Run and resolve backend balance-sheet diagnosis.">
      {!projectId ? (
        <Card>No project selected.</Card>
      ) : (
        <div className="space-y-5">
          {error && <ApiErrorDetails error={error} fallback="Diagnosis request failed." />}
          <div className="grid grid-cols-4 gap-4">
            <Metric label="Sheets" value={sheets.length} />
            <Metric label="Candidates" value={candidates.length} />
            <Metric label="Status" value={String(diagnosis?.status ?? "not run")} />
            <Metric label="Imbalance" value={String(diagnosis?.imbalanceAmount ?? "-")} />
          </div>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[15px] font-semibold">Balance sheet diagnosis</h2>
                <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
                  Run the backend diagnosis engine after review cells are resolved.
                </p>
              </div>
              <Button onClick={() => runDiagnosis.mutate()} disabled={runDiagnosis.isPending}>
                {runDiagnosis.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Run diagnosis
              </Button>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-[15px] font-semibold">Candidates</h2>
            {candidates.length === 0 ? (
              <div className="text-[13px] text-[var(--color-text-muted)]">
                No diagnosis candidates available.
              </div>
            ) : (
              <div className="space-y-3">
                {candidates.map((candidate, index) => {
                  const id = String(candidate.id ?? candidate.candidateId ?? index);
                  const reasonCode = reasonCodes[id] ?? "human_override";
                  return (
                    <div
                      key={id}
                      className="rounded-md border p-3"
                      style={{ borderColor: "var(--color-border-default)" }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[13px] font-semibold">
                            {String(
                              candidate.label ?? candidate.fieldLabel ?? `Candidate ${index + 1}`,
                            )}
                          </div>
                          <div className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                            {String(
                              candidate.reason ?? candidate.explanation ?? "Backend candidate",
                            )}
                          </div>
                        </div>
                        <Badge tone="warning">
                          {String(candidate.classification ?? "candidate")}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                        <label className="flex items-center gap-2 text-[12px] text-[var(--color-text-muted)]">
                          Reason
                          <select
                            value={reasonCode}
                            onChange={(event) =>
                              setReasonCodes((current) => ({
                                ...current,
                                [id]: event.target.value,
                              }))
                            }
                            className="h-9 rounded-md border bg-white px-2 text-[12px]"
                            style={{ borderColor: "var(--color-border-strong)" }}
                          >
                            <option value="human_override">Human override</option>
                            <option value="source_mismatch">Source mismatch</option>
                            <option value="not_material">Not material</option>
                            <option value="duplicate_candidate">Duplicate candidate</option>
                          </select>
                        </label>
                        <Button variant="secondary" onClick={() => acceptDiagnosis.mutate(id)}>
                          <CheckCircle2 className="h-4 w-4" />
                          Accept
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() =>
                            decideDiagnosis.mutate({
                              candidateId: id,
                              input: {
                                action: "reject",
                                reasonCode,
                                classification: String(candidate.classification ?? "unknown"),
                                note: "Rejected from frontend diagnosis review.",
                              },
                            })
                          }
                        >
                          <X className="h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <div className="mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[var(--color-brand)]" />
              <h2 className="text-[15px] font-semibold">Diagnosis comments</h2>
            </div>
            {commentsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-[13px] text-[var(--color-text-muted)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading comments...
              </div>
            ) : commentsQuery.isError ? (
              <ApiErrorDetails error={commentsQuery.error} fallback="Unable to load comments." />
            ) : (commentsQuery.data ?? []).length === 0 ? (
              <div className="text-[13px] text-[var(--color-text-muted)]">
                No comments have been added yet.
              </div>
            ) : (
              <ol className="space-y-2">
                {(commentsQuery.data ?? []).map((comment) => (
                  <li
                    key={comment.id}
                    className="rounded-md border bg-[var(--color-table-row-alt)] p-3"
                    style={{ borderColor: "var(--color-border-default)" }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[12px] font-semibold">{comment.actor}</span>
                      <span className="text-[11px] text-[var(--color-text-muted)]">
                        {formatDate(comment.createdAt)}
                      </span>
                    </div>
                    <div className="mt-1 text-[13px]">{comment.body}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
                      <Badge tone={comment.status === "resolved" ? "success" : "warning"}>
                        {comment.status}
                      </Badge>
                      {commentTarget(comment) ? <span>{commentTarget(comment)}</span> : null}
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      {comment.status === "resolved" ? (
                        <Button
                          variant="secondary"
                          onClick={() => reopenComment.mutate(comment.id)}
                          disabled={reopenComment.isPending}
                        >
                          Reopen
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          onClick={() => resolveComment.mutate(comment.id)}
                          disabled={resolveComment.isPending}
                        >
                          Resolve
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <div className="mt-3 flex gap-2">
              <input
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                placeholder="Add diagnosis context for the review trail..."
                className="h-9 flex-1 rounded-md border px-3 text-[13px]"
                style={{ borderColor: "var(--color-border-strong)" }}
              />
              <Button
                onClick={submitComment}
                disabled={!commentDraft.trim() || createComment.isPending}
              >
                {createComment.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Post
              </Button>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-[15px] font-semibold">Workbook preview</h2>
            {sheets.length === 0 ? (
              <div className="text-[13px] text-[var(--color-text-muted)]">
                No workbook preview available yet.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {sheets.map((sheet) => (
                  <Badge key={sheet.name} tone="neutral">
                    {sheet.name} · {sheet.rows.length} rows
                  </Badge>
                ))}
              </div>
            )}
          </Card>
          <div className="flex justify-end">
            <Button onClick={() => navigate({ to: "/forecast" })}>Open Forecast</Button>
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
      <div className="mt-2 text-[20px] font-bold tnum">{value}</div>
    </Card>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function commentTarget(comment: {
  fieldId?: string | null;
  templateCell?: string | null;
  sheetName?: string | null;
}) {
  return comment.templateCell ?? comment.sheetName ?? comment.fieldId ?? "";
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
