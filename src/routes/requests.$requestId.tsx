import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cycleStore } from "@/lib/cycle-store";
import {
  acknowledgeAnalysisRequest,
  convertAnalysisRequestToProject,
  getAnalysisRequest,
  type AnalysisRequestResponse,
} from "@/lib/api/projects";

export const Route = createFileRoute("/requests/$requestId")({
  head: () => ({
    meta: [
      { title: "Request Detail — Sheet Sherlock" },
      { name: "description", content: "Acknowledge analysis requests and convert them to extraction projects." },
    ],
  }),
  component: RequestDetailPage,
});

function RequestDetailPage() {
  const { requestId } = Route.useParams();
  const [request, setRequest] = useState<AnalysisRequestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function refreshRequest() {
    setError(null);
    try {
      setRequest(await getAnalysisRequest(requestId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load request.");
    }
  }

  useEffect(() => {
    void refreshRequest();
  }, [requestId]);

  async function acknowledge() {
    setPending(true);
    setError(null);
    try {
      setRequest(await acknowledgeAnalysisRequest(requestId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not acknowledge request.");
    } finally {
      setPending(false);
    }
  }

  async function convert() {
    setPending(true);
    setError(null);
    try {
      const converted = await convertAnalysisRequestToProject(requestId);
      setRequest(converted);
      if (converted.projectId) {
        cycleStore.startCycle({
          sector: converted.sector ?? "Industrial Engineering",
          company: converted.companyName,
          period: converted.fiscalYear ?? "FY2025",
        });
        cycleStore.setProjectId(converted.projectId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not convert request.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div data-testid="request-detail" className="max-w-4xl rounded-lg border bg-white p-5" style={{ borderColor: "var(--color-border-default)" }}>
      <Link to="/requests" className="text-[12px] font-semibold text-brand">
        Back to requests
      </Link>
      {error ? (
        <div className="mt-3 rounded-md border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger-fg">{error}</div>
      ) : null}
      {!request ? (
        <div className="mt-5 text-sm text-text-muted">Loading request...</div>
      ) : (
        <div className="mt-5 grid gap-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-text-primary">
                {request.companyName} {request.companySymbol ? `(${request.companySymbol})` : ""}
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                {request.sector ?? "Sector pending"} · {request.fiscalYear ?? "Period pending"} · {request.template}
              </p>
            </div>
            <div className="text-right">
              <div data-testid="request-status" className="rounded-md bg-tag-bg px-3 py-1.5 text-[12px] font-semibold text-brand">
                {request.status}
              </div>
              <div className="mt-2 text-[11px] text-text-muted">{request.emailStatus}</div>
            </div>
          </div>

          <dl className="grid gap-3 rounded-md bg-table-header p-4 sm:grid-cols-2">
            <KV label="Assigned Analyst" value={request.assignedAnalystEmail} />
            <KV label="Priority" value={request.priority} />
            <KV label="Due Date" value={request.dueDate ?? "Not set"} />
            <KV label="Request ID" value={request.id} />
          </dl>

          {request.note ? (
            <div className="rounded-md border px-4 py-3 text-sm text-text-secondary" style={{ borderColor: "var(--color-border-default)" }}>
              {request.note}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button data-testid="request-acknowledge" type="button" onClick={acknowledge} disabled={pending || !!request.acknowledgedAt}>
              {request.acknowledgedAt ? "Acknowledged" : "Acknowledge"}
            </Button>
            <Button data-testid="request-convert-project" type="button" onClick={convert} disabled={pending || !!request.projectId}>
              {request.projectId ? "Project created" : "Convert to project"}
            </Button>
            {request.projectId ? (
              <Link
                to="/ingestion"
                className="inline-flex h-9 items-center justify-center rounded-md border px-3 text-[12px] font-semibold text-text-secondary"
                style={{ borderColor: "var(--color-border-strong)" }}
              >
                Continue ingestion
              </Link>
            ) : null}
          </div>

          {request.projectId ? (
            <div className="rounded-md bg-success-bg px-3 py-2 text-sm text-success-fg">
              Project ID <span data-testid="request-project-id">{request.projectId}</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase text-text-muted">{label}</dt>
      <dd className="mt-1 text-[13px] font-semibold text-text-primary">{value}</dd>
    </div>
  );
}
