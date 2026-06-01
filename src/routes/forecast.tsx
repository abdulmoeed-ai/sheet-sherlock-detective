import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, Loader2, Play, Sparkles } from "lucide-react";
import { PageShell, Card, Badge } from "@/components/PageShell";
import { Button } from "@/components/Button";
import { useSelectedProjectId } from "@/lib/project-store";
import { useWorkspace } from "@/hooks/use-projects";
import { useRunForecast } from "@/hooks/use-project-actions";
import type { ForecastRunResponse } from "@/lib/api/types";

export const Route = createFileRoute("/forecast")({
  head: () => ({
    meta: [
      { title: "5-Year Forecast — Sheet Sherlock" },
      { name: "description", content: "Backend scenario forecasting with citations." },
    ],
  }),
  component: Forecast,
});

function Forecast() {
  const navigate = useNavigate();
  const projectId = useSelectedProjectId();
  const workspace = useWorkspace(projectId);
  const runForecast = useRunForecast(projectId ?? "");
  const [forecast, setForecast] = useState<ForecastRunResponse | null>(null);
  const [projectionYears, setProjectionYears] = useState(5);
  const [query, setQuery] = useState("Build base, bull, and bear revenue scenarios.");

  const run = async () => {
    const result = await runForecast.mutateAsync({
      query,
      sourceGroup: "forecast",
      projectionYears,
    });
    setForecast(result);
  };

  return (
    <PageShell
      title="5-Year Forecast"
      subtitle={
        workspace.data?.project.companyName ?? "Run a backend forecast for the selected project."
      }
    >
      {!projectId ? (
        <Card>No project selected.</Card>
      ) : (
        <div className="space-y-5 pb-24">
          {runForecast.error && (
            <div className="flex items-center gap-2 rounded-md bg-[var(--color-danger-bg)] px-3 py-2 text-[13px] text-[var(--color-danger-fg)]">
              <AlertTriangle className="h-4 w-4" />
              {runForecast.error instanceof Error ? runForecast.error.message : "Forecast failed."}
            </div>
          )}

          <Card>
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--color-accent-sparkle)]" />
              <h2 className="text-[15px] font-semibold">Forecast run</h2>
            </div>
            <div className="grid grid-cols-[1fr_160px_auto] gap-3">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-10 rounded-md border px-3 text-[13px]"
                style={{ borderColor: "var(--color-border-strong)" }}
              />
              <input
                type="number"
                min={1}
                max={5}
                value={projectionYears}
                onChange={(event) => setProjectionYears(Number(event.target.value))}
                className="h-10 rounded-md border px-3 text-[13px]"
                style={{ borderColor: "var(--color-border-strong)" }}
              />
              <Button onClick={run} disabled={runForecast.isPending}>
                {runForecast.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Run
              </Button>
            </div>
          </Card>

          {forecast ? (
            <>
              <div className="grid grid-cols-3 gap-4">
                <Metric label="Status" value={forecast.status} />
                <Metric label="Source status" value={forecast.sourceStatus} />
                <Metric label="Years" value={forecast.projectionYears} />
              </div>
              <Card>
                <h2 className="mb-3 text-[15px] font-semibold">Scenarios</h2>
                <div className="grid grid-cols-3 gap-3">
                  {forecast.scenarios.map((scenario, index) => (
                    <div
                      key={String(scenario.id ?? scenario.name ?? index)}
                      className="rounded-md border p-3"
                      style={{ borderColor: "var(--color-border-default)" }}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[13px] font-semibold">
                          {String(scenario.name ?? scenario.id ?? `Scenario ${index + 1}`)}
                        </span>
                        <Badge tone="info">API</Badge>
                      </div>
                      <pre className="max-h-[180px] overflow-auto text-[11px] text-[var(--color-text-muted)]">
                        {JSON.stringify(scenario, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </Card>
              <Card>
                <h2 className="mb-3 text-[15px] font-semibold">Assumptions and citations</h2>
                <div className="grid grid-cols-2 gap-4">
                  <pre className="max-h-[260px] overflow-auto rounded-md bg-[var(--color-table-header)] p-3 text-[11px]">
                    {JSON.stringify(forecast.assumptions, null, 2)}
                  </pre>
                  <pre className="max-h-[260px] overflow-auto rounded-md bg-[var(--color-table-header)] p-3 text-[11px]">
                    {JSON.stringify(forecast.citations, null, 2)}
                  </pre>
                </div>
              </Card>
              <div className="flex justify-end">
                <Button onClick={() => navigate({ to: "/assumptions" })}>
                  Generate assumptions
                </Button>
              </div>
            </>
          ) : (
            <Card>
              <div className="text-[13px] text-[var(--color-text-muted)]">No forecast run yet.</div>
            </Card>
          )}
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
