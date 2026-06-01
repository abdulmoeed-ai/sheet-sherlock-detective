import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { ArrowRight, ClipboardList, FolderOpen, Loader2, Plus, ShieldCheck } from "lucide-react";
import { PageShell, Card, Badge } from "@/components/PageShell";
import { Button } from "@/components/Button";
import { ApiError } from "@/lib/api/errors";
import type { BackendRole } from "@/lib/api/types";
import type { AnalysisRequestCreateInput } from "@/lib/api/analysis-requests";
import { useCurrentUser } from "@/hooks/use-auth";
import { useAnalysisRequests, useCreateAnalysisRequest } from "@/hooks/use-analysis-requests";
import { useProjects } from "@/hooks/use-projects";
import { setSelectedProjectId } from "@/lib/project-store";
import { roleLabel } from "@/lib/role-access";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Sheet Sherlock" },
      { name: "description", content: "Role-aware Sheet Sherlock dashboard backed by the API." },
    ],
  }),
  component: Dashboard,
});

const blankRequest: AnalysisRequestCreateInput = {
  assignedAnalystEmail: "",
  companyName: "Millat Tractors Limited",
  companySymbol: "MTL",
  sector: "Engineering & Industrials",
  fiscalYear: "FY2025",
  template: "Millat - Template.xlsx",
  priority: "normal",
  dueDate: "",
  note: "",
};

function Dashboard() {
  const { data: user } = useCurrentUser();
  const role = user?.role ?? "finance_analyst";

  return (
    <PageShell
      title={`${roleLabel(role)} Dashboard`}
      subtitle="Live workspace entry point for your role."
      hideProgress={role !== "finance_analyst"}
    >
      {role === "finance_manager" ? <ManagerDashboard /> : <ProjectDashboard role={role} />}
    </PageShell>
  );
}

function ManagerDashboard() {
  const requests = useAnalysisRequests();
  const createRequest = useCreateAnalysisRequest();
  const [draft, setDraft] = useState<AnalysisRequestCreateInput>(blankRequest);
  const error =
    createRequest.error instanceof ApiError
      ? createRequest.error.message
      : createRequest.error instanceof Error
        ? createRequest.error.message
        : null;

  const counts = useMemo(() => {
    const items = requests.data ?? [];
    return {
      total: items.length,
      pending: items.filter((item) => item.status === "pending").length,
      converted: items.filter((item) => item.status === "converted").length,
    };
  }, [requests.data]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await createRequest.mutateAsync({
      ...draft,
      dueDate: draft.dueDate || null,
      note: draft.note || null,
    });
    setDraft(blankRequest);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total requests" value={counts.total} />
        <StatCard label="Pending" value={counts.pending} />
        <StatCard label="Converted" value={counts.converted} />
      </div>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-[var(--color-brand)]" />
          <h2 className="text-[16px] font-semibold">Request</h2>
          <Badge tone="info">Manager</Badge>
        </div>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <Field
            label="Assigned analyst email"
            value={draft.assignedAnalystEmail}
            onChange={(value) => setDraft({ ...draft, assignedAnalystEmail: value })}
            required
          />
          <Field
            label="Company"
            value={draft.companyName}
            onChange={(value) => setDraft({ ...draft, companyName: value })}
            required
          />
          <Field
            label="Symbol"
            value={draft.companySymbol ?? ""}
            onChange={(value) => setDraft({ ...draft, companySymbol: value })}
          />
          <Field
            label="Sector"
            value={draft.sector ?? ""}
            onChange={(value) => setDraft({ ...draft, sector: value })}
          />
          <Field
            label="Fiscal year"
            value={draft.fiscalYear ?? ""}
            onChange={(value) => setDraft({ ...draft, fiscalYear: value })}
          />
          <label>
            <span className="mb-1 block text-[12px] font-semibold text-[var(--color-text-secondary)]">
              Priority
            </span>
            <select
              value={draft.priority}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  priority: event.target.value as AnalysisRequestCreateInput["priority"],
                })
              }
              className="h-10 w-full rounded-md border px-3 text-[13px]"
              style={{ borderColor: "var(--color-border-strong)" }}
            >
              {["low", "normal", "high", "urgent"].map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Due date"
            type="date"
            value={draft.dueDate ?? ""}
            onChange={(value) => setDraft({ ...draft, dueDate: value })}
          />
          <label className="col-span-2">
            <span className="mb-1 block text-[12px] font-semibold text-[var(--color-text-secondary)]">
              Note
            </span>
            <textarea
              value={draft.note ?? ""}
              onChange={(event) => setDraft({ ...draft, note: event.target.value })}
              className="min-h-[84px] w-full rounded-md border px-3 py-2 text-[13px]"
              style={{ borderColor: "var(--color-border-strong)" }}
            />
          </label>
          {error && (
            <div className="col-span-2 rounded-md bg-[var(--color-danger-bg)] px-3 py-2 text-[12px] text-[var(--color-danger-fg)]">
              {error}
            </div>
          )}
          <div className="col-span-2 flex justify-end">
            <Button>
              {createRequest.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create request
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 text-[16px] font-semibold">Request status</h2>
        <RequestList loading={requests.isLoading} requests={requests.data ?? []} />
      </Card>
    </div>
  );
}

function ProjectDashboard({ role }: { role: BackendRole }) {
  const projects = useProjects();
  const navigate = useNavigate();

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Projects" value={projects.data?.length ?? 0} />
        <StatCard label="Role" value={roleLabel(role)} />
        <StatCard label="Source" value="Backend API" />
      </div>
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-[var(--color-brand)]" />
          <h2 className="text-[16px] font-semibold">Projects</h2>
        </div>
        {projects.isLoading ? (
          <div className="text-[13px] text-[var(--color-text-muted)]">Loading projects...</div>
        ) : (projects.data ?? []).length === 0 ? (
          <div
            className="rounded-md border px-4 py-5 text-[13px] text-[var(--color-text-secondary)]"
            style={{ borderColor: "var(--color-border-default)" }}
          >
            No projects are available for this account.
          </div>
        ) : (
          <div className="space-y-2">
            {(projects.data ?? []).map((project) => (
              <button
                key={project.id}
                onClick={() => {
                  setSelectedProjectId(project.id);
                  navigate({ to: role === "cfo" ? "/sign-off" : "/registry" });
                }}
                className="flex w-full items-center justify-between rounded-md border px-4 py-3 text-left hover:bg-[var(--color-tag-bg)]"
                style={{ borderColor: "var(--color-border-default)" }}
              >
                <div>
                  <div className="text-[13px] font-semibold">{project.companyName}</div>
                  <div className="text-[11px] text-[var(--color-text-muted)]">
                    {project.fiscalYear ?? "Current"} · {project.status} ·{" "}
                    {project.reviewProgress.reviewed}/{project.reviewProgress.total} reviewed
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-[var(--color-text-muted)]" />
              </button>
            ))}
          </div>
        )}
      </Card>
      {role === "admin" && (
        <Card>
          <div className="flex items-center gap-2 text-[13px] text-[var(--color-text-secondary)]">
            <ShieldCheck className="h-4 w-4 text-[var(--color-brand)]" />
            Admin source controls are available from Sources Admin.
          </div>
        </Card>
      )}
    </div>
  );
}

function RequestList({
  loading,
  requests,
}: {
  loading: boolean;
  requests: Array<{
    id: string;
    companyName: string;
    companySymbol: string | null;
    fiscalYear: string | null;
    status: string;
    assignedAnalystEmail: string;
    createdAt: string;
    projectId: string | null;
  }>;
}) {
  if (loading)
    return <div className="text-[13px] text-[var(--color-text-muted)]">Loading requests...</div>;
  if (requests.length === 0)
    return (
      <div className="text-[13px] text-[var(--color-text-muted)]">No requests created yet.</div>
    );
  return (
    <div className="space-y-2">
      {requests.map((request) => (
        <div
          key={request.id}
          className="rounded-md border px-4 py-3"
          style={{ borderColor: "var(--color-border-default)" }}
        >
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-semibold">
              {request.companyName} {request.companySymbol ? `(${request.companySymbol})` : ""} ·{" "}
              {request.fiscalYear ?? "Current"}
            </div>
            <Badge
              tone={
                request.status === "converted"
                  ? "success"
                  : request.status === "pending"
                    ? "warning"
                    : "info"
              }
            >
              {request.status}
            </Badge>
          </div>
          <div className="mt-1 text-[11px] text-[var(--color-text-muted)]">
            Analyst: {request.assignedAnalystEmail} · Created{" "}
            {new Date(request.createdAt).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <div className="text-[12px] uppercase tracking-wider text-[var(--color-text-secondary)]">
        {label}
      </div>
      <div className="mt-2 text-[24px] font-bold tnum">{value}</div>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      <span className="mb-1 block text-[12px] font-semibold text-[var(--color-text-secondary)]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="h-10 w-full rounded-md border px-3 text-[13px]"
        style={{ borderColor: "var(--color-border-strong)" }}
      />
    </label>
  );
}
