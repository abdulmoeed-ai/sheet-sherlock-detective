import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell, Card, Badge } from "@/components/PageShell";
import { Button } from "@/components/Button";
import {
  MessagesSquare,
  CheckCircle2,
  Clock,
  ArrowRight,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { cycleStore } from "@/lib/cycle-store";
import {
  useAcknowledgeAnalysisRequest,
  useAnalysisRequests,
  useConvertAnalysisRequestToProject,
} from "@/hooks/use-analysis-requests";
import { setSelectedProjectId } from "@/lib/project-store";
import type { AnalysisRequestResponse } from "@/lib/api/types";

export const Route = createFileRoute("/inbox")({
  head: () => ({
    meta: [
      { title: "Inbox · Teams Requests — Sheet Sherlock" },
      {
        name: "description",
        content: "Requests sent by Finance Manager via Microsoft Teams integration.",
      },
    ],
  }),
  component: Inbox,
});

type RequestStatus = "pending" | "acknowledged" | "converted";

function Inbox() {
  const navigate = useNavigate();
  const requests = useAnalysisRequests();
  const acknowledgeRequest = useAcknowledgeAnalysisRequest();
  const convertRequest = useConvertAnalysisRequestToProject();
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const items = requests.data ?? [];
  const openCount = items.filter((i) => requestStatus(i) === "pending").length;
  const readyCount = items.filter((i) => requestStatus(i) === "acknowledged").length;
  const convertedCount = items.filter((i) => requestStatus(i) === "converted").length;
  const visibleError = actionError ?? (requests.error ? errorMessage(requests.error) : null);

  const accept = async (r: AnalysisRequestResponse) => {
    setActionError(null);
    setActiveRequestId(r.id);
    try {
      await acknowledgeRequest.mutateAsync(r.id);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setActiveRequestId(null);
    }
  };

  const beginOrContinue = async (r: AnalysisRequestResponse) => {
    setActionError(null);
    setActiveRequestId(r.id);
    try {
      const projectId = r.projectId ?? (await convertRequest.mutateAsync(r.id)).projectId;
      if (!projectId) {
        throw new Error("Backend did not return a project id for this request.");
      }
      setSelectedProjectId(projectId);
      cycleStore.startCycle({
        sector: r.sector ?? "Unassigned sector",
        company: r.companyName,
        period: r.fiscalYear ?? "Current period",
      });
      navigate({ to: "/registry" });
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setActiveRequestId(null);
    }
  };

  return (
    <PageShell
      title="Inbox · Teams Requests"
      subtitle="Requests forwarded by your Finance Manager via Microsoft Teams. Accept, then begin or continue the cycle."
      hideProgress
    >
      {visibleError ? (
        <Card className="mb-5 border-(--color-danger) bg-(--color-danger-bg)">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-(--color-danger)" />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-(--color-danger)">
                Inbox request failed
              </div>
              <div className="mt-1 text-[13px] text-(--color-danger-fg)">{visibleError}</div>
            </div>
            {requests.error ? (
              <Button variant="secondary" onClick={() => requests.refetch()}>
                Retry
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      <div className="mb-5 grid grid-cols-3 gap-4">
        {[
          ["Open requests", openCount.toString()],
          ["Ready to begin", readyCount.toString()],
          ["Converted", convertedCount.toString()],
        ].map(([k, v]) => (
          <Card key={k}>
            <div className="text-[12px] uppercase tracking-wider text-(--color-text-secondary)">
              {k}
            </div>
            <div className="mt-2 text-[24px] font-bold tnum">{v}</div>
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        {requests.isLoading ? (
          <Card>
            <div className="flex items-center gap-2 text-[13px] text-(--color-text-secondary)">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading manager requests...
            </div>
          </Card>
        ) : null}

        {!requests.isLoading && items.length === 0 ? (
          <Card>
            <div className="text-[15px] font-semibold text-(--color-text-primary)">
              No manager requests
            </div>
            <p className="mt-1 text-[13px] text-(--color-text-secondary)">
              New analysis requests assigned to you will appear here.
            </p>
          </Card>
        ) : null}

        {items.map((r) => (
          <Card key={r.id}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge tone={statusTone(requestStatus(r))}>{statusLabel(requestStatus(r))}</Badge>
                  <Badge tone={priorityTone(r.priority)}>{r.priority}</Badge>
                  <Badge tone="neutral">Teams</Badge>
                  <span className="text-[12px] text-(--color-text-muted)">
                    {shortId(r.id)} · {formatDate(r.createdAt)}
                  </span>
                </div>
                <div className="mt-2 text-[15px] font-semibold text-(--color-text-primary)">
                  {r.companyName} {r.companySymbol ? `(${r.companySymbol})` : ""} ·{" "}
                  {r.fiscalYear ?? "Current FY"}
                </div>
                <div className="text-[12px] text-(--color-text-muted)">
                  {r.sector ?? "Sector not specified"} · from Finance Manager
                  {r.dueDate ? ` · due ${formatDate(r.dueDate)}` : ""}
                </div>
                <p className="mt-2 text-[13px] text-(--color-text-secondary)">
                  "
                  {r.note ||
                    `Please run the ${r.fiscalYear ?? "current"} cycle for ${r.companyName}.`}
                  "
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {requestStatus(r) === "pending" ? (
                  <Button onClick={() => accept(r)} disabled={activeRequestId === r.id}>
                    {activeRequestId === r.id && acknowledgeRequest.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Accept
                  </Button>
                ) : requestStatus(r) === "acknowledged" ? (
                  <Button onClick={() => beginOrContinue(r)} disabled={activeRequestId === r.id}>
                    {activeRequestId === r.id && convertRequest.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                    Begin
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => beginOrContinue(r)}
                    disabled={activeRequestId === r.id}
                  >
                    <Clock className="h-4 w-4" /> Continue
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}

function requestStatus(request: AnalysisRequestResponse): RequestStatus {
  if (request.status === "acknowledged" || request.status === "converted") return request.status;
  return "pending";
}

function statusLabel(status: RequestStatus): string {
  if (status === "pending") return "PENDING";
  if (status === "acknowledged") return "ACKNOWLEDGED";
  return "CONVERTED";
}

function statusTone(status: RequestStatus): "info" | "warning" | "success" {
  if (status === "pending") return "info";
  if (status === "acknowledged") return "warning";
  return "success";
}

function priorityTone(
  priority: AnalysisRequestResponse["priority"],
): "neutral" | "warning" | "danger" {
  if (priority === "urgent" || priority === "high") return "danger";
  if (priority === "normal") return "warning";
  return "neutral";
}

function shortId(id: string): string {
  return id.length > 12 ? `REQ-${id.slice(0, 8)}` : id;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "The backend returned an unexpected error.";
}
