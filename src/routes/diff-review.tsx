import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Loader2, X } from "lucide-react";
import { PageShell, Card, Badge } from "@/components/PageShell";
import { Button } from "@/components/Button";
import { useSelectedProjectId } from "@/lib/project-store";
import { useWorkspace } from "@/hooks/use-projects";
import { useReviewCell } from "@/hooks/use-project-actions";
import { reviewRows } from "@/lib/mappers/workspace";

export const Route = createFileRoute("/diff-review")({
  head: () => ({
    meta: [
      { title: "Diff Review — Sheet Sherlock" },
      { name: "description", content: "Review backend extraction diffs." },
    ],
  }),
  component: DiffReview,
});

function DiffReview() {
  const navigate = useNavigate();
  const projectId = useSelectedProjectId();
  const workspace = useWorkspace(projectId);
  const reviewCell = useReviewCell(projectId ?? "");
  const rows = reviewRows(workspace.data);

  const accept = (fieldId: string) => reviewCell.mutate({ fieldId, input: { action: "accept" } });
  const flag = (fieldId: string) =>
    reviewCell.mutate({ fieldId, input: { action: "flag", note: "Flagged from diff review." } });

  return (
    <PageShell
      title="Diff Review"
      subtitle="Approve or flag backend review cells before diagnosis."
    >
      {!projectId ? (
        <Card>No project selected.</Card>
      ) : (
        <div className="space-y-5">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">{rows.length} backend review rows</h2>
              {workspace.isLoading && (
                <Loader2 className="h-4 w-4 animate-spin text-[var(--color-brand)]" />
              )}
            </div>
            {rows.length === 0 ? (
              <div className="text-[13px] text-[var(--color-text-muted)]">
                No review rows are available yet. Run extraction first.
              </div>
            ) : (
              <table className="w-full text-[12px]">
                <thead>
                  <tr
                    className="text-left text-[10px] uppercase"
                    style={{
                      background: "var(--color-table-header)",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    <th className="px-3 py-2">Cell</th>
                    <th>Sheet</th>
                    <th>Field</th>
                    <th className="text-right">Old</th>
                    <th className="text-right">New</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.fieldId}
                      className="border-b"
                      style={{ borderColor: "var(--color-border-default)" }}
                    >
                      <td className="px-3 py-2 font-mono">{row.cell}</td>
                      <td>{row.sheet}</td>
                      <td>{row.field}</td>
                      <td className="text-right tnum text-[var(--color-text-muted)]">
                        {row.oldValue}
                      </td>
                      <td className="text-right tnum font-semibold">{row.newValue}</td>
                      <td>{row.source}</td>
                      <td>
                        <Badge
                          tone={
                            row.status === "accepted" || row.status === "closed"
                              ? "success"
                              : row.status === "flagged"
                                ? "warning"
                                : "info"
                          }
                        >
                          {row.status}
                        </Badge>
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => accept(row.fieldId)}
                            className="rounded border p-1"
                            style={{ borderColor: "var(--color-success)" }}
                          >
                            <Check className="h-3.5 w-3.5 text-[var(--color-success-fg)]" />
                          </button>
                          <button
                            onClick={() => flag(row.fieldId)}
                            className="rounded border p-1"
                            style={{ borderColor: "var(--color-danger-border)" }}
                          >
                            <X className="h-3.5 w-3.5 text-[var(--color-danger-fg)]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          <div className="flex justify-end">
            <Button onClick={() => navigate({ to: "/diagnosis" })}>Open Diagnosis</Button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
