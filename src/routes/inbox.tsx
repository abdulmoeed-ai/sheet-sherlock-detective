import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PaginationControls } from "@/components/PaginationControls";
import { PageShell, Card, Badge } from "@/components/PageShell";
import { Button } from "@/components/Button";
import {
  MessagesSquare,
  CheckCircle2,
  Clock,
  ArrowRight,
  AlertTriangle,
  Loader2,
  ClipboardList,
  FolderOpen,
} from "lucide-react";
import { cycleStore } from "@/lib/cycle-store";
import {
  useAcknowledgeAnalysisRequest,
  useAnalysisRequests,
  useConvertAnalysisRequestToProject,
} from "@/hooks/use-analysis-requests";
import { setSelectedProjectId } from "@/lib/project-store";
import { paginateItems } from "@/lib/pagination";
import {
  dashboardProjectStatusLabel,
  dashboardProjectStatusTone,
  isFinalApprovedStatus,
} from "@/lib/project-status-workflow";
import { useProjects } from "@/hooks/use-projects";
import type { AnalysisRequestResponse, ProjectResponse } from "@/lib/api/types";

export const Route = createFileRoute("/inbox")({
  head: () => ({
    meta: [
      { title: "Analysis Requests — finance" },
      {
        name: "description",
        content: "Analysis requests assigned by Finance Manager.",
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
  const [page, setPage] = useState(1);
  const [projectSearch, setProjectSearch] = useState("");
  const [projectPage, setProjectPage] = useState(1);
  const projects = useProjects();

  const items = useMemo(() => requests.data ?? [], [requests.data]);
  const paginatedItems = useMemo(() => paginateItems(items, page), [items, page]);
  const projectList = useMemo(() => projects.data ?? [], [projects.data]);
  const pendingRequests = items.filter((r) => requestStatus(r) === "pending");
  const approvedWorkbookCount = projectList.filter((project) =>
    isFinalApprovedStatus(project.status),
  ).length;
  const filteredProjects = useMemo(() => {
    const query = projectSearch.trim().toLowerCase();
    if (!query) return projectList;
    return projectList.filter((project) =>
      [
        project.companyName,
        project.projectLabel,
        project.sector,
        project.fiscalYear,
        dashboardProjectStatusLabel(project.status),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [projectList, projectSearch]);
  const paginatedProjects = useMemo(
    () => paginateItems(filteredProjects, projectPage),
    [filteredProjects, projectPage],
  );
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
      title="Analysis Requests"
      subtitle="Analysis requests for a company, or against a workbook can be found here"
      hideProgress
    >
      {visibleError ? (
        <Card className="mb-5 border-(--color-danger) bg-(--color-danger-bg)">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-(--color-danger)" />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-(--color-danger)">
                Analysis request failed
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
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-[var(--color-brand)]" />
          <h2 className="text-[16px] font-semibold text-[var(--color-text-primary)]">
            Assigned Requests
          </h2>
        </div>

        {requests.isLoading ? (
          <Card>
            <div className="flex items-center gap-2 text-[13px] text-(--color-text-secondary)">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading analysis requests...
            </div>
          </Card>
        ) : null}

        {!requests.isLoading && items.length === 0 ? (
          <Card>
            <div className="text-[15px] font-semibold text-(--color-text-primary)">
              No analysis requests
            </div>
            <p className="mt-1 text-[13px] text-(--color-text-secondary)">
              New analysis requests assigned to you will appear here.
            </p>
          </Card>
        ) : null}

        {paginatedItems.map((r) => (
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
        <PaginationControls
          totalItems={items.length}
          page={page}
          onPageChange={setPage}
          label="requests"
        />
      </div>

      <div className="mt-7 space-y-5">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-[var(--color-brand)]" />
            <h2 className="text-[17px] font-semibold text-[var(--color-text-primary)]">
              My Tasks Overview
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <TaskStatCard label="Projects" value={projectList.length} />
          <TaskStatCard label="Pending requests" value={pendingRequests.length} />
          <TaskStatCard label="Approved Workbooks" value={approvedWorkbookCount} />
        </div>

        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-[var(--color-brand)]" />
              <h2 className="text-[16px] font-semibold">Related Workbooks & Projects</h2>
            </div>
            <input
              value={projectSearch}
              onChange={(event) => {
                setProjectSearch(event.target.value);
                setProjectPage(1);
              }}
              placeholder="Search projects"
              className="h-9 w-full max-w-[320px] rounded-md border bg-white px-3 text-[13px] outline-none transition focus:border-[var(--color-brand)]"
              style={{ borderColor: "var(--color-border-default)" }}
            />
          </div>
          {projects.isLoading ? (
            <div className="text-[13px] text-[var(--color-text-muted)]">Loading projects...</div>
          ) : projectList.length === 0 ? (
            <EmptyProjectState message="No projects are available for this account." />
          ) : filteredProjects.length === 0 ? (
            <EmptyProjectState message="No projects match that search." />
          ) : (
            <div className="space-y-2">
              {paginatedProjects.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  onOpen={() => {
                    setSelectedProjectId(project.id);
                    navigate({ to: "/registry" });
                  }}
                />
              ))}
              <PaginationControls
                totalItems={filteredProjects.length}
                page={projectPage}
                onPageChange={setProjectPage}
                label="projects"
              />
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  );
}

function TaskStatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <div className="text-[12px] uppercase tracking-wider text-[var(--color-text-secondary)]">
        {label}
      </div>
      <div className="mt-2 text-[24px] font-bold tnum">{value}</div>
    </Card>
  );
}

function ProjectRow({ project, onOpen }: { project: ProjectResponse; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center justify-between rounded-md border px-4 py-3 text-left hover:bg-[var(--color-tag-bg)]"
      style={{ borderColor: "var(--color-border-default)" }}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold">{project.companyName}</span>
          <Badge tone={dashboardProjectStatusTone(project.status)}>
            {dashboardProjectStatusLabel(project.status)}
          </Badge>
        </div>
        <div className="mt-1 text-[11px] text-[var(--color-text-muted)]">
          {project.fiscalYear ?? "Current period"}
          {project.sector ? ` · ${project.sector}` : ""}
          {project.projectLabel ? ` · ${project.projectLabel}` : ""}
          {" · "}Last edited {formatProjectDate(project.updatedAt)}
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-[var(--color-text-muted)]" />
    </button>
  );
}

function EmptyProjectState({ message }: { message: string }) {
  return (
    <div
      className="rounded-md border px-4 py-5 text-[13px] text-[var(--color-text-secondary)]"
      style={{ borderColor: "var(--color-border-default)" }}
    >
      {message}
    </div>
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

function formatProjectDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "The backend returned an unexpected error.";
}
