import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ClipboardList,
  CloudUpload,
  FolderOpen,
  Loader2,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { PageShell, Card, Badge } from "@/components/PageShell";
import { Button } from "@/components/Button";
import { Combobox } from "@/components/Combobox";
import { ApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";
import type { BackendRole } from "@/lib/api/types";
import type { AnalysisRequestCreateInput } from "@/lib/api/analysis-requests";
import { useCurrentUser } from "@/hooks/use-auth";
import {
  useAnalysisRequests,
  useCreateAnalysisRequest,
  useAcknowledgeAnalysisRequest,
  useConvertAnalysisRequestToProject,
} from "@/hooks/use-analysis-requests";
import { useProjects, useCreateProject } from "@/hooks/use-projects";
import { useAnalysts, usePsxCompanies } from "@/hooks/use-users";
import { setSelectedProjectId } from "@/lib/project-store";
import { roleLabel } from "@/lib/role-access";
import { SECTOR_PACKS } from "@/lib/sector-packs";
import { cycleStore } from "@/lib/cycle-store";
import {
  companyIntelligenceFromAskAnalyst,
  getMockCompanyIntelligence,
  type CompanyIntelligence,
  type IntelligenceMetric,
  type MarketPoint,
  type ReadinessStatus,
} from "@/lib/company-intelligence";
import { fetchAskAnalystOverview } from "@/lib/ask-analyst";
import {
  buildDashboardState,
  type DashboardCompanySelection,
  type DashboardRenderState,
} from "@/lib/dashboard-state";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — F(AI)nance" },
      { name: "description", content: "Role-aware F(AI)nance dashboard backed by the API." },
    ],
  }),
  component: Dashboard,
});

const blankRequest: AnalysisRequestCreateInput = {
  assignedAnalystEmail: "",
  companyName: "",
  companySymbol: "",
  sector: "",
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
      hideProgress
    >
      {role === "finance_manager" ? <ManagerDashboard /> : <ProjectDashboard role={role} />}
    </PageShell>
  );
}

function ManagerDashboard() {
  const requests = useAnalysisRequests();
  const createRequest = useCreateAnalysisRequest();
  const analysts = useAnalysts();
  const psxCompanies = usePsxCompanies();
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

  const analystOptions = useMemo(
    () =>
      (analysts.data ?? []).map((a) => ({
        value: a.email,
        label: `${a.name} (${a.email})`,
      })),
    [analysts.data],
  );

  const companyOptions = useMemo(
    () =>
      (psxCompanies.data ?? []).map((c) => ({
        value: c.symbol,
        label: `${c.name} (${c.symbol})`,
      })),
    [psxCompanies.data],
  );

  const sectorOptions = useMemo(
    () => Object.keys(SECTOR_PACKS).map((s) => ({ value: s, label: s })),
    [],
  );

  const handleCompanySelect = (symbol: string) => {
    const company = psxCompanies.data?.find((c) => c.symbol === symbol);
    if (company) {
      setDraft({
        ...draft,
        companyName: company.name,
        companySymbol: company.symbol,
        sector: company.sector,
      });
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await createRequest.mutateAsync({
      ...draft,
      companySymbol: draft.companySymbol || null,
      sector: draft.sector || null,
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
          <Combobox
            label="Company"
            options={companyOptions}
            value={draft.companySymbol ?? ""}
            onChange={handleCompanySelect}
            placeholder={psxCompanies.isLoading ? "Loading…" : "Search company…"}
            disabled={psxCompanies.isLoading}
            required
          />
          <Combobox
            label="Analyst"
            options={analystOptions}
            value={draft.assignedAnalystEmail}
            onChange={(value) => setDraft({ ...draft, assignedAnalystEmail: value })}
            placeholder={analysts.isLoading ? "Loading…" : "Select analyst…"}
            disabled={analysts.isLoading}
            required
          />
          <Combobox
            label="Sector (optional)"
            options={sectorOptions}
            value={draft.sector ?? ""}
            onChange={(value) => setDraft({ ...draft, sector: value })}
            placeholder="Search sector…"
          />
          <div />
          <label className="col-span-2">
            <span className="mb-1 block text-[12px] font-semibold text-[var(--color-text-secondary)]">
              Comments
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
  const requests = useAnalysisRequests();
  const acknowledge = useAcknowledgeAnalysisRequest();
  const convertRequest = useConvertAnalysisRequestToProject();
  const createProject = useCreateProject();
  const psxCompanies = usePsxCompanies();
  const [startError, setStartError] = useState<string | null>(null);

  const pendingRequests = (requests.data ?? []).filter((r) => r.status === "pending");
  const dashboardState = useMemo(
    () =>
      buildDashboardState({
        role,
        projects: projects.data ?? [],
        requests: requests.data ?? [],
        psxCompanies: psxCompanies.data ?? [],
      }),
    [role, projects.data, requests.data, psxCompanies.data],
  );
  // Show skeleton until ALL key data is ready — prevents old-dashboard flash on re-navigation
  const allDataReady =
    projects.data !== undefined &&
    requests.data !== undefined &&
    psxCompanies.data !== undefined;
  const intelligenceLoading = role === "finance_analyst" && !allDataReady;
  const startPending = createProject.isPending || convertRequest.isPending;

  const startModel = async (state: AnalystNoModelState) => {
    setStartError(null);
    try {
      let projectId: string | null = null;
      if (state.startMode === "convert_request" && state.request) {
        const converted = await convertRequest.mutateAsync(state.request.id);
        projectId = converted.projectId;
      } else {
        const project = await createProject.mutateAsync({
          companyName: state.company.name,
          sector: state.company.sector,
          fiscalYear: state.company.fiscalYear,
          currencyUnit: "Rs in Thousands",
          template: "Millat - Template.xlsx",
          teamMembers: [],
        });
        projectId = project.id;
      }

      if (!projectId) {
        throw new Error("The model project was not returned by the API.");
      }

      setSelectedProjectId(projectId);
      cycleStore.startCycle({
        sector: state.company.sector ?? "",
        company: state.company.name,
        period: state.company.fiscalYear,
      });
      navigate({ to: "/ingestion" });
    } catch (error) {
      setStartError(error instanceof Error ? error.message : "Unable to start model setup.");
    }
  };

  if (intelligenceLoading) {
    return <AnalystDashboardLoading />;
  }

  if (dashboardState.kind === "analyst_company_no_model") {
    return (
      <AnalystNoModelDashboard
        state={dashboardState}
        startPending={startPending}
        startError={startError}
        onStartModel={() => startModel(dashboardState)}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Projects" value={projects.data?.length ?? 0} />
        {role === "finance_analyst" && (
          <StatCard label="Pending requests" value={pendingRequests.length} />
        )}
        <StatCard label="Role" value={roleLabel(role)} />
      </div>

      {role === "finance_analyst" && (
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-[var(--color-brand)]" />
            <h2 className="text-[16px] font-semibold">Assigned requests</h2>
            <Badge tone="info">Analyst</Badge>
          </div>
          {requests.isLoading ? (
            <div className="text-[13px] text-[var(--color-text-muted)]">Loading requests...</div>
          ) : pendingRequests.length === 0 ? (
            <div
              className="rounded-md border px-4 py-5 text-[13px] text-[var(--color-text-secondary)]"
              style={{ borderColor: "var(--color-border-default)" }}
            >
              No pending requests assigned to you.
            </div>
          ) : (
            <div className="space-y-2">
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between rounded-md border px-4 py-3"
                  style={{ borderColor: "var(--color-border-default)" }}
                >
                  <div>
                    <div className="text-[13px] font-semibold">
                      {request.companyName}
                      {request.companySymbol ? ` (${request.companySymbol})` : ""} ·{" "}
                      {request.fiscalYear ?? "Current"}
                    </div>
                    <div className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                      Priority: {request.priority ?? "normal"} · Received{" "}
                      {new Date(request.createdAt).toLocaleDateString()}
                      {request.note ? ` · ${request.note}` : ""}
                    </div>
                  </div>
                  <Button
                    onClick={() => acknowledge.mutate(request.id)}
                    disabled={acknowledge.isPending}
                  >
                    {acknowledge.isPending && acknowledge.variables === request.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    Acknowledge
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

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

type AnalystNoModelState = Extract<DashboardRenderState, { kind: "analyst_company_no_model" }>;

function AnalystNoModelDashboard({
  state,
  startPending,
  startError,
  onStartModel,
}: {
  state: AnalystNoModelState;
  startPending: boolean;
  startError: string | null;
  onStartModel: () => void;
}) {
  const fallbackIntelligence = useMemo(
    () =>
      getMockCompanyIntelligence(
        {
          name: state.company.name,
          symbol: state.company.symbol,
          sector: state.company.sector,
        },
        state.company.fiscalYear,
      ),
    [state.company.name, state.company.symbol, state.company.sector, state.company.fiscalYear],
  );
  const askAnalystOverview = useQuery({
    queryKey: queryKeys.askAnalystOverview(state.company.symbol, state.company.name),
    queryFn: ({ signal }) =>
      fetchAskAnalystOverview(
        {
          name: state.company.name,
          symbol: state.company.symbol,
          sector: state.company.sector,
        },
        { signal },
      ),
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });
  const intelligence = useMemo(
    () =>
      askAnalystOverview.data
        ? companyIntelligenceFromAskAnalyst(askAnalystOverview.data, fallbackIntelligence)
        : fallbackIntelligence,
    [askAnalystOverview.data, fallbackIntelligence],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <StartModelCard
          company={state.company}
          intelligence={intelligence}
          requestStatus={state.request?.status ?? null}
          startPending={startPending}
          startError={startError}
          onStartModel={onStartModel}
        />
        <ForecastLockedPreviewCard intelligence={intelligence} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(260px,0.8fr)_minmax(340px,1.15fr)_minmax(280px,0.85fr)]">
        <CompanySnapshotCard intelligence={intelligence} />
        <MarketSignalsCard intelligence={intelligence} />
        <DataReadinessCard intelligence={intelligence} />
      </div>

      <MetricGroupsGrid intelligence={intelligence} />
      <SourceCoverageCard intelligence={intelligence} />
    </div>
  );
}

function AnalystDashboardLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <Card className="min-h-[220px]">
        <div className="h-3.5 w-32 rounded-full bg-[var(--color-border-default)]" />
        <div className="mt-4 h-7 w-72 max-w-full rounded-lg bg-[var(--color-border-default)]" />
        <div className="mt-3 h-3.5 w-full max-w-[520px] rounded-full bg-[var(--color-border-default)]" />
        <div className="mt-2 h-3.5 w-4/5 max-w-[420px] rounded-full bg-[var(--color-border-default)]" />
        <div className="mt-8 h-10 w-48 rounded-lg bg-[var(--color-border-default)]" />
      </Card>
      <div className="grid gap-4 xl:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <Card key={item} className="min-h-[160px]">
            <div className="h-3.5 w-28 rounded-full bg-[var(--color-border-default)]" />
            <div className="mt-5 space-y-2.5">
              <div className="h-3 w-full rounded-full bg-[var(--color-border-default)]" />
              <div className="h-3 w-4/5 rounded-full bg-[var(--color-border-default)]" />
              <div className="h-3 w-3/5 rounded-full bg-[var(--color-border-default)]" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StartModelCard({
  company,
  intelligence,
  requestStatus,
  startPending,
  startError,
  onStartModel,
}: {
  company: DashboardCompanySelection;
  intelligence: CompanyIntelligence;
  requestStatus: string | null;
  startPending: boolean;
  startError: string | null;
  onStartModel: () => void;
}) {
  return (
    <Card className="min-h-[250px]">
      <div className="flex h-full flex-col justify-between gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">Company selected</Badge>
            <Badge tone={intelligence.provider.statusLabel === "Live source" ? "success" : "info"}>
              {intelligence.provider.statusLabel}
            </Badge>
            {requestStatus ? <Badge tone="warning">{requestStatus}</Badge> : null}
          </div>
          <div className="mt-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Company Intelligence Dashboard
          </div>
          <h2 className="mt-2 text-[26px] font-bold leading-tight text-[var(--color-text-primary)]">
            {company.name}
          </h2>
          <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">
            {intelligence.identifiers.exchange} · {intelligence.identifiers.symbol} ·{" "}
            {intelligence.identifiers.fiscalYear} · {intelligence.identifiers.sector}
          </p>
          <p className="mt-5 max-w-[680px] text-[18px] font-semibold leading-snug text-[var(--color-text-primary)]">
            {intelligence.headline}
          </p>
        </div>

        <div>
          <Button onClick={onStartModel} disabled={startPending} className="min-w-[210px]">
            {startPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CloudUpload className="h-4 w-4" />
            )}
            Upload Annual Report
          </Button>
          <p className="mt-2 text-[12px] text-[var(--color-text-muted)]">
            Creates the model workspace and opens annual-report ingestion.
          </p>
          {startError ? (
            <p className="mt-3 rounded-md bg-[var(--color-danger-bg)] px-3 py-2 text-[12px] text-[var(--color-danger-fg)]">
              {startError}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function CompanySnapshotCard({ intelligence }: { intelligence: CompanyIntelligence }) {
  const rows: Array<[string, string]> = [
    ["Ticker", intelligence.identifiers.symbol],
    ["Exchange", intelligence.identifiers.exchange],
    ["Fiscal year", intelligence.identifiers.fiscalYear],
    ["Sector", intelligence.identifiers.sector],
    ["Currency", intelligence.identifiers.currency],
    ["Country", intelligence.identifiers.country],
    ["Source", intelligence.provider.label],
  ];
  if (intelligence.identifiers.askAnalystCompanyId) {
    rows.push(["AskAnalyst ID", String(intelligence.identifiers.askAnalystCompanyId)]);
  }

  return (
    <Card className="min-h-[230px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold">Company Snapshot</h3>
          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
            {intelligence.provider.detail}
          </p>
        </div>
        {intelligence.identifiers.logoUrl ? (
          <img
            src={intelligence.identifiers.logoUrl}
            alt={`${intelligence.identifiers.name} logo`}
            className="h-9 w-9 rounded-md border bg-white object-contain p-1"
            style={{ borderColor: "var(--color-border-default)" }}
          />
        ) : null}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              {label}
            </dt>
            <dd className="mt-1 break-words text-[13px] font-semibold text-[var(--color-text-primary)]">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function MarketSignalsCard({ intelligence }: { intelligence: CompanyIntelligence }) {
  const signals = intelligence.marketSignals;
  const trendColor =
    signals.changePct30d >= 0 ? "var(--color-success-fg)" : "var(--color-danger-fg)";

  return (
    <Card className="min-h-[230px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold">Market Signals</h3>
          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
            {signals.sourceLabel} · {signals.updatedAt}
          </p>
        </div>
        <Badge tone="info">{signals.sourceTypeLabel}</Badge>
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Last close
          </div>
          <div className="mt-1 text-[24px] font-bold tnum">
            {signals.currency} {signals.lastPrice.toFixed(2)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Change
          </div>
          <div className="mt-1 text-[14px] font-semibold tnum" style={{ color: trendColor }}>
            {formatSignedPercent(signals.changePct30d)}
          </div>
        </div>
      </div>

      <SharePriceTrendChart points={signals.sharePriceTrend} />
    </Card>
  );
}

function MetricGroupsGrid({ intelligence }: { intelligence: CompanyIntelligence }) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {intelligence.metricGroups.map((group) => (
        <Card key={group.title} className="min-h-[230px]">
          <h3 className="text-[15px] font-semibold">{group.title}</h3>
          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{group.subtitle}</p>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
            {group.items.slice(0, 8).map((item) => (
              <MetricCell key={`${group.title}-${item.label}-${item.value}`} item={item} />
            ))}
          </dl>
        </Card>
      ))}
    </div>
  );
}

function MetricCell({ item }: { item: IntelligenceMetric }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {item.label}
      </dt>
      <dd
        className="mt-1 break-words text-[13px] font-semibold tnum"
        style={{ color: metricToneColor(item.tone) }}
      >
        {item.value}
      </dd>
      {item.detail ? (
        <dd className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{item.detail}</dd>
      ) : null}
    </div>
  );
}

function DataReadinessCard({ intelligence }: { intelligence: CompanyIntelligence }) {
  return (
    <Card className="min-h-[230px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold">Data Readiness</h3>
          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
            Model creation gates only
          </p>
        </div>
        <span className="text-[20px] font-bold tnum">{intelligence.dataReadiness.score}%</span>
      </div>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full"
        style={{ background: "var(--color-border-default)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${intelligence.dataReadiness.score}%`,
            background: "var(--color-brand)",
          }}
        />
      </div>
      <div className="mt-4 space-y-3">
        {intelligence.dataReadiness.items.map((item) => (
          <ReadinessRow
            key={item.label}
            label={item.label}
            detail={item.detail}
            status={item.status}
          />
        ))}
      </div>
    </Card>
  );
}

function SourceCoverageCard({ intelligence }: { intelligence: CompanyIntelligence }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold">Source Coverage</h3>
          <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
            Coverage is limited to company identifiers and market sources until annual-report
            ingestion begins.
          </p>
        </div>
        <span className="text-[18px] font-bold tnum">
          {intelligence.sourceCoverage.coveragePercent}%
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {intelligence.sourceCoverage.sources.map((source) => (
          <ReadinessRow
            key={source.label}
            label={source.label}
            detail={source.detail}
            status={source.status}
          />
        ))}
      </div>
    </Card>
  );
}

function ForecastLockedPreviewCard({ intelligence }: { intelligence: CompanyIntelligence }) {
  return (
    <Card className="min-h-[250px]">
      <Badge tone="warning">Forecast locked</Badge>
      <h3 className="mt-4 text-[18px] font-semibold">{intelligence.forecastLocked.title}</h3>
      <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
        {intelligence.forecastLocked.reason}
      </p>
      <div className="mt-5 space-y-3">
        {intelligence.forecastLocked.requirements.map((requirement) => (
          <div key={requirement} className="flex items-center gap-3">
            <StatusDot status="locked" />
            <span className="text-[13px] text-[var(--color-text-primary)]">{requirement}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ReadinessRow({
  label,
  detail,
  status,
}: {
  label: string;
  detail: string;
  status: ReadinessStatus;
}) {
  return (
    <div className="flex gap-3">
      <StatusDot status={status} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
            {label}
          </span>
          <span
            className="text-[11px] font-semibold uppercase"
            style={{ color: statusColor(status) }}
          >
            {statusLabel(status)}
          </span>
        </div>
        <p className="mt-0.5 text-[12px] leading-snug text-[var(--color-text-muted)]">{detail}</p>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: ReadinessStatus }) {
  return (
    <span
      className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ background: statusColor(status) }}
    />
  );
}

function SharePriceTrendChart({ points }: { points: MarketPoint[] }) {
  if (points.length === 0) return null;
  const width = 420;
  const height = 112;
  const paddingX = 14;
  const paddingY = 12;
  const values = points.map((point) => point.price);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingY * 2;
  const coordinates = points.map((point, index) => {
    const x = paddingX + (plotWidth * index) / Math.max(points.length - 1, 1);
    const y = paddingY + plotHeight - ((point.price - min) / span) * plotHeight;
    return { ...point, x, y };
  });
  const linePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const areaPath = `${linePath} L ${coordinates.at(-1)?.x.toFixed(2) ?? paddingX} ${height - paddingY} L ${paddingX} ${height - paddingY} Z`;

  return (
    <div className="mt-4 h-[118px] w-full overflow-hidden">
      <svg
        role="img"
        aria-label="Market-sourced share price trend"
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full"
        preserveAspectRatio="none"
      >
        <path d={areaPath} fill="rgba(34, 197, 94, 0.12)" />
        <path d={linePath} fill="none" stroke="var(--color-success-fg)" strokeWidth="3" />
        {coordinates.map((point, index) => (
          <circle
            key={`${point.label}-${index}`}
            cx={point.x}
            cy={point.y}
            r="3"
            fill="var(--color-success-fg)"
          />
        ))}
      </svg>
    </div>
  );
}

function metricToneColor(tone: IntelligenceMetric["tone"]): string {
  if (tone === "positive") return "var(--color-success-fg)";
  if (tone === "negative") return "var(--color-danger-fg)";
  return "var(--color-text-primary)";
}

function statusLabel(status: ReadinessStatus): string {
  const labels: Record<ReadinessStatus, string> = {
    ready: "Ready",
    pending: "Pending",
    locked: "Locked",
  };
  return labels[status];
}

function statusColor(status: ReadinessStatus): string {
  const colors: Record<ReadinessStatus, string> = {
    ready: "var(--color-success-fg)",
    pending: "var(--color-warning-fg)",
    locked: "var(--color-text-muted)",
  };
  return colors[status];
}

function formatSignedPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
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
