import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, Loader2, Send, Sparkles } from "lucide-react";
import { PageShell, Card, Badge } from "@/components/PageShell";
import { Button } from "@/components/Button";
import { ApiErrorDetails } from "@/components/ApiErrorDetails";
import { useSelectedProjectId } from "@/lib/project-store";
import { useWorkspace } from "@/hooks/use-projects";
import { useGenerateAssumptions, useSubmitForManagerReview } from "@/hooks/use-project-actions";
import { getStoredForecast } from "@/lib/forecast-store";
import type { AssumptionsGenerateResponse, ForecastRunResponse } from "@/lib/api/types";

export const Route = createFileRoute("/assumptions")({
  head: () => ({
    meta: [
      { title: "Assumptions — Sheet Sherlock" },
      { name: "description", content: "Backend-generated assumptions sheet." },
    ],
  }),
  component: Assumptions,
});

function Assumptions() {
  const navigate = useNavigate();
  const projectId = useSelectedProjectId();
  const workspace = useWorkspace(projectId);
  const generate = useGenerateAssumptions(projectId ?? "");
  const submit = useSubmitForManagerReview(projectId ?? "");
  const [assumptions, setAssumptions] = useState<AssumptionsGenerateResponse | null>(null);
  const [forecastContext, setForecastContext] = useState<ForecastRunResponse | null>(() =>
    projectId ? getStoredForecast(projectId) : null,
  );
  const [note, setNote] = useState("Ready for manager review.");

  useEffect(() => {
    setForecastContext(projectId ? getStoredForecast(projectId) : null);
  }, [projectId]);

  const runGenerate = async () => {
    const result = await generate.mutateAsync({
      includeForecastDrivers: true,
      forecast: forecastContext as unknown as Record<string, unknown> | null,
    });
    setAssumptions(result);
  };

  const submitReview = async () => {
    await submit.mutateAsync(note);
    navigate({ to: "/audit" });
  };

  const error = generate.error ?? submit.error;

  return (
    <PageShell
      title="Assumptions"
      subtitle={
        workspace.data?.project.companyName ?? "Generate backend assumptions and submit for review."
      }
    >
      {!projectId ? (
        <Card>No project selected.</Card>
      ) : (
        <div className="space-y-5 pb-24">
          {error && <ApiErrorDetails error={error} fallback="Request failed." />}
          <Card>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[var(--color-accent-sparkle)]" />
                <h2 className="text-[15px] font-semibold">Assumptions generation</h2>
                <Badge tone={forecastContext ? "success" : "warning"}>
                  {forecastContext ? "Forecast context attached" : "No forecast context"}
                </Badge>
              </div>
              <Button onClick={runGenerate} disabled={generate.isPending}>
                {generate.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                Generate
              </Button>
            </div>
          </Card>
          {assumptions ? (
            <Card>
              <div className="mb-3 flex items-center gap-2">
                <Badge tone="success">{assumptions.status}</Badge>
                <span className="text-[12px] text-[var(--color-text-muted)]">
                  {assumptions.rows.length} rows · {assumptions.generatedAt}
                </span>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr
                    className="text-left text-[10px] uppercase"
                    style={{
                      background: "var(--color-table-header)",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    <th className="px-3 py-2">#</th>
                    <th>Assumption</th>
                    <th>Value</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {assumptions.rows.map((row, index) => (
                    <tr
                      key={index}
                      className="border-b"
                      style={{ borderColor: "var(--color-border-default)" }}
                    >
                      <td className="px-3 py-2">{index + 1}</td>
                      <td>{String(row.name ?? row.label ?? row.assumption ?? "Assumption")}</td>
                      <td className="font-semibold">{String(row.value ?? row.amount ?? "-")}</td>
                      <td className="text-[var(--color-text-muted)]">
                        {String(row.source ?? row.sourceName ?? "Backend")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ) : (
            <Card>
              <div className="text-[13px] text-[var(--color-text-muted)]">
                No assumptions generated yet.
              </div>
            </Card>
          )}
          <Card>
            <label>
              <span className="mb-1 block text-[12px] font-semibold text-[var(--color-text-secondary)]">
                Submission note
              </span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="min-h-[80px] w-full rounded-md border px-3 py-2 text-[13px]"
                style={{ borderColor: "var(--color-border-strong)" }}
              />
            </label>
            <div className="mt-3 flex justify-end">
              <Button onClick={submitReview} disabled={submit.isPending}>
                {submit.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Submit for Manager review
              </Button>
            </div>
          </Card>
        </div>
      )}
    </PageShell>
  );
}
