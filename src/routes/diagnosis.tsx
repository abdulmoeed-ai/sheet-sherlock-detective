import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, X } from "lucide-react";
import { PageShell, Card, Badge } from "@/components/PageShell";
import { Button } from "@/components/Button";
import { useSelectedProjectId } from "@/lib/project-store";
import { useWorkspace } from "@/hooks/use-projects";
import {
  useAcceptDiagnosis,
  useDecideDiagnosis,
  useRunDiagnosis,
} from "@/hooks/use-project-actions";
import { workbookSheets } from "@/lib/mappers/workspace";

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
  const sheets = workbookSheets(workspace.data);
  const diagnosis = workspace.data?.balanceSheetDiagnosis;
  const candidates = Array.isArray(diagnosis?.candidates)
    ? diagnosis.candidates.filter(isRecord)
    : [];
  const error = runDiagnosis.error ?? acceptDiagnosis.error ?? decideDiagnosis.error;

  return (
    <PageShell title="Diagnosis" subtitle="Run and resolve backend balance-sheet diagnosis.">
      {!projectId ? (
        <Card>No project selected.</Card>
      ) : (
        <div className="space-y-5">
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-[var(--color-danger-bg)] px-3 py-2 text-[13px] text-[var(--color-danger-fg)]">
              <AlertTriangle className="h-4 w-4" />
              {error instanceof Error ? error.message : "Diagnosis request failed."}
            </div>
          )}
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
                      <div className="mt-3 flex justify-end gap-2">
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
                                reasonCode: "human_override",
                                classification: "unknown",
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
