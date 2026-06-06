import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  BarChart3,
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
import { searchSources } from "@/lib/api/projects";
import { queryKeys } from "@/lib/api/query-keys";
import type { BackendRole, ProjectResponse } from "@/lib/api/types";
import type { AnalysisRequestCreateInput } from "@/lib/api/analysis-requests";
import { useCurrentUser } from "@/hooks/use-auth";
import {
  useAnalysisRequests,
  useCreateAnalysisRequest,
  useAcknowledgeAnalysisRequest,
} from "@/hooks/use-analysis-requests";
import { useProjects, useCreateProject, useWorkspace } from "@/hooks/use-projects";
import { useAnalysts, usePsxCompanies } from "@/hooks/use-users";
import { setSelectedProjectId } from "@/lib/project-store";
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
import type { PsxCompany } from "@/lib/api/users";
import { type DashboardCompanySelection } from "@/lib/dashboard-state";
import {
  buildApprovedModelGraphPack,
  buildBrokerResearchSummary,
  buildFinancialDashboardSourcePlan,
  buildLiveMarketMetrics,
  buildSourceSyncSummary,
  brokerReportsFromSourceSearch,
  companyOptionsForSector,
  sectorOptions,
  type ApprovedModelGraphPack,
  type BrokerResearchSummary,
  type FinancialDashboardSourcePlan,
  type LiveMarketDashboardMetrics,
  type SourceSyncStatus,
  type SourceTaggedMetric,
} from "@/lib/financial-dashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — finance" },
      { name: "description", content: "Role-aware finance dashboard backed by the API." },
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

const managerApprovedStatuses = new Set(["cfo_review", "approved"]);

function dashboardProjectStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Draft",
    setup: "Draft",
    created: "Draft",
    documents_uploaded: "Documents Uploaded",
    extracting: "Extraction in Progress",
    extraction_failed: "Extraction Failed",
    awaiting_review: "Ready for Review",
    ready_for_diagnosis: "Ready for Diagnosis",
    in_diagnosis: "In Diagnosis",
    manager_review: "Manager Review",
    manager_changes_requested: "Manager Changes Requested",
    cfo_review: "Manager Approved",
    approved: "Approved",
    cfo_changes_requested: "CFO Changes Requested",
  };
  return labels[status] ?? status.toUpperCase().replace(/_/g, " ");
}

function dashboardProjectStatusTone(
  status: string,
): "neutral" | "success" | "danger" | "warning" | "info" | "ai" {
  if (status === "approved" || status === "cfo_review") return "success";
  if (status.includes("failed") || status.includes("changes_requested")) return "danger";
  if (status === "extracting" || status.includes("review") || status.includes("diagnosis")) {
    return "info";
  }
  if (status === "documents_uploaded") return "ai";
  return "warning";
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

function Dashboard() {
  const { data: user } = useCurrentUser();
  const role = user?.role ?? "finance_analyst";

  return (
    <PageShell title="Dashboards" hideProgress>
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
  const createProject = useCreateProject();
  const psxCompanies = usePsxCompanies();
  const [startError, setStartError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "financial">("financial");
  const [projectSearch, setProjectSearch] = useState("");

  const pendingRequests = (requests.data ?? []).filter((r) => r.status === "pending");
  const projectList = useMemo(() => projects.data ?? [], [projects.data]);
  const approvedWorkbookCount = projectList.filter((project) =>
    managerApprovedStatuses.has(project.status),
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
  // Show skeleton until ALL key data is ready — prevents old-dashboard flash on re-navigation
  const allDataReady =
    projects.data !== undefined && requests.data !== undefined && psxCompanies.data !== undefined;
  const startPending = createProject.isPending;

  const startModel = async (company: DashboardCompanySelection) => {
    setStartError(null);
    try {
      const project = await createProject.mutateAsync({
        companyName: company.name,
        sector: company.sector,
        fiscalYear: company.fiscalYear,
        currencyUnit: "Rs in Thousands",
        template: "Millat - Template.xlsx",
        teamMembers: [],
      });
      const projectId = project.id;

      if (!projectId) {
        throw new Error("The model project was not returned by the API.");
      }

      setSelectedProjectId(projectId);
      cycleStore.startCycle({
        sector: company.sector ?? "",
        company: company.name,
        period: company.fiscalYear,
      });
      navigate({ to: "/ingestion" });
    } catch (error) {
      setStartError(error instanceof Error ? error.message : "Unable to start model setup.");
    }
  };

  const tabs =
    role === "finance_analyst"
      ? [
          { id: "financial" as const, label: "Financial Dashboard" },
          { id: "overview" as const, label: "My Tasks Overview" },
        ]
      : null;

  return (
    <div className="space-y-4">
      {/* Sub-tabs — analyst only */}
      {tabs && (
        <div className="flex gap-0 border-b" style={{ borderColor: "var(--color-border-default)" }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-4 py-2.5 text-[13px] font-medium transition"
              style={{
                color: activeTab === tab.id ? "var(--color-brand)" : "var(--color-text-muted)",
                borderBottom:
                  activeTab === tab.id ? "2px solid var(--color-brand)" : "2px solid transparent",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Financial Dashboard tab */}
      {activeTab === "financial" &&
        role === "finance_analyst" &&
        (!allDataReady ? (
          <AnalystDashboardLoading />
        ) : (
          <FinancialDashboardTab
            psxCompanies={psxCompanies.data ?? []}
            projects={projects.data ?? []}
            startPending={startPending}
            startError={startError}
            onStartModel={startModel}
          />
        ))}

      {/* Overview tab (original dashboard) */}
      {(activeTab === "overview" || role !== "finance_analyst") && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Projects" value={projectList.length} />
            {role === "finance_analyst" && (
              <StatCard label="Pending requests" value={pendingRequests.length} />
            )}
            <StatCard label="Approved Workbooks" value={approvedWorkbookCount} />
          </div>

          {role === "finance_analyst" && (
            <Card>
              <div className="mb-3 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-[var(--color-brand)]" />
                <h2 className="text-[16px] font-semibold">Assigned requests</h2>
                <Badge tone="info">Analyst</Badge>
              </div>
              {requests.isLoading ? (
                <div className="text-[13px] text-[var(--color-text-muted)]">
                  Loading requests...
                </div>
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
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-[var(--color-brand)]" />
                <h2 className="text-[16px] font-semibold">Projects</h2>
              </div>
              <input
                value={projectSearch}
                onChange={(event) => setProjectSearch(event.target.value)}
                placeholder="Search projects"
                className="h-9 w-full max-w-[320px] rounded-md border bg-white px-3 text-[13px] outline-none transition focus:border-[var(--color-brand)]"
                style={{ borderColor: "var(--color-border-default)" }}
              />
            </div>
            {projects.isLoading ? (
              <div className="text-[13px] text-[var(--color-text-muted)]">Loading projects...</div>
            ) : projectList.length === 0 ? (
              <div
                className="rounded-md border px-4 py-5 text-[13px] text-[var(--color-text-secondary)]"
                style={{ borderColor: "var(--color-border-default)" }}
              >
                No projects are available for this account.
              </div>
            ) : filteredProjects.length === 0 ? (
              <div
                className="rounded-md border px-4 py-5 text-[13px] text-[var(--color-text-secondary)]"
                style={{ borderColor: "var(--color-border-default)" }}
              >
                No projects match that search.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredProjects.map((project) => (
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
      )}
    </div>
  );
}

function FinancialDashboardTab({
  psxCompanies,
  projects,
  startPending,
  startError,
  onStartModel,
}: {
  psxCompanies: PsxCompany[];
  projects: ProjectResponse[];
  startPending: boolean;
  startError: string | null;
  onStartModel: (company: DashboardCompanySelection) => void;
}) {
  const [selectedSector, setSelectedSector] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const sectorItems = useMemo(() => sectorOptions(psxCompanies), [psxCompanies]);
  const companyItems = useMemo(
    () => companyOptionsForSector(psxCompanies, selectedSector),
    [psxCompanies, selectedSector],
  );
  const selectedCompany = useMemo(
    () => psxCompanies.find((company) => company.symbol === selectedSymbol) ?? null,
    [psxCompanies, selectedSymbol],
  );

  const fallbackIntelligence = useMemo(() => {
    if (!selectedCompany) return null;
    return getMockCompanyIntelligence(
      {
        name: selectedCompany.name,
        symbol: selectedCompany.symbol,
        sector: selectedCompany.sector,
      },
      "FY2025",
    );
  }, [selectedCompany]);
  const askAnalystOverview = useQuery({
    queryKey: queryKeys.askAnalystOverview(
      selectedCompany?.symbol ?? "",
      selectedCompany?.name ?? "",
    ),
    queryFn: ({ signal }) =>
      fetchAskAnalystOverview(
        {
          name: selectedCompany?.name ?? "",
          symbol: selectedCompany?.symbol ?? "",
          sector: selectedCompany?.sector ?? "",
        },
        { signal },
      ),
    enabled: !!selectedCompany,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });
  const intelligence = useMemo(() => {
    if (!fallbackIntelligence) return null;
    return askAnalystOverview.data
      ? companyIntelligenceFromAskAnalyst(askAnalystOverview.data, fallbackIntelligence)
      : fallbackIntelligence;
  }, [askAnalystOverview.data, fallbackIntelligence]);
  const sourcePlan = useMemo<FinancialDashboardSourcePlan | null>(() => {
    if (!selectedCompany) return null;
    return buildFinancialDashboardSourcePlan({
      selectedCompany,
      projects,
    });
  }, [projects, selectedCompany]);
  const approvedProjectId = sourcePlan?.modelGraphAvailability.project?.id ?? null;
  const approvedWorkspace = useWorkspace(approvedProjectId);
  const brokerResearch = useQuery({
    queryKey: queryKeys.brokerResearch(approvedProjectId, selectedCompany?.symbol),
    queryFn: () =>
      searchSources(approvedProjectId ?? "", {
        query: `${selectedCompany?.name ?? ""} ${selectedCompany?.symbol ?? ""} Topline Securities broker report target price rating valuation`,
        sourceIds: ["topline"],
        sourceGroup: "brokerage",
      }),
    enabled: !!approvedProjectId && !!selectedCompany,
    retry: 1,
    staleTime: 10 * 60 * 1000,
  });
  const liveMarketMetrics = useMemo(
    () => (intelligence ? liveMarketMetricsFromIntelligence(intelligence) : null),
    [intelligence],
  );
  const brokerReports = useMemo(
    () => brokerReportsFromSourceSearch(brokerResearch.data),
    [brokerResearch.data],
  );
  const brokerSummary = useMemo(
    () =>
      selectedCompany
        ? buildBrokerResearchSummary({ companyName: selectedCompany.name, brokerReports })
        : null,
    [brokerReports, selectedCompany],
  );
  const modelGraphPack = useMemo<ApprovedModelGraphPack | null>(
    () =>
      sourcePlan
        ? buildApprovedModelGraphPack({
            availability: sourcePlan.modelGraphAvailability,
            workspace: approvedWorkspace.data,
            loading: approvedWorkspace.isLoading,
          })
        : null,
    [approvedWorkspace.data, approvedWorkspace.isLoading, sourcePlan],
  );
  const sourceSyncSummary = useMemo<SourceSyncStatus[]>(
    () =>
      intelligence && sourcePlan
        ? buildSourceSyncSummary({
            marketSyncedAt: intelligence.marketSignals.updatedAt,
            askAnalystLive: intelligence.provider.label === "AskAnalyst",
            brokerSyncedAt: brokerSummary?.date ?? null,
            approvedModelUpdatedAt: sourcePlan.modelGraphAvailability.project?.updatedAt ?? null,
            approvedModelAvailable: sourcePlan.modelGraphAvailability.available,
          })
        : [],
    [brokerSummary?.date, intelligence, sourcePlan],
  );

  const selectedDashboardCompany: DashboardCompanySelection | null = selectedCompany
    ? {
        name: selectedCompany.name,
        symbol: selectedCompany.symbol,
        sector: selectedCompany.sector,
        fiscalYear: "FY2025",
      }
    : null;

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Combobox
            label="Sector"
            options={sectorItems}
            value={selectedSector}
            onChange={(sector) => {
              setSelectedSector(sector);
              setSelectedSymbol("");
            }}
            placeholder="Select sector..."
          />
          <Combobox
            label="Company"
            options={companyItems}
            value={selectedSymbol}
            onChange={setSelectedSymbol}
            placeholder={!selectedSector ? "Select sector first..." : "Select company..."}
            disabled={!selectedSector}
          />
        </div>
      </Card>

      {!selectedCompany ||
      !intelligence ||
      !sourcePlan ||
      !selectedDashboardCompany ||
      !brokerSummary ||
      !modelGraphPack ? (
        <Card className="min-h-[260px]">
          <div className="flex h-full flex-col items-center justify-center text-center">
            <BarChart3 className="h-10 w-10 text-[var(--color-brand)]" />
            <h2 className="mt-4 text-[20px] font-semibold">Select a sector and company</h2>
            <p className="mt-2 max-w-[560px] text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
              Live market charts and approved-model financial graph packs load only after both
              selections are made.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
            <StartModelCard
              company={selectedDashboardCompany}
              intelligence={intelligence}
              requestStatus={null}
              startPending={startPending}
              startError={startError}
              onStartModel={() => onStartModel(selectedDashboardCompany)}
            />
            <FinancialSourcePlanCard
              sourcePlan={sourcePlan}
              askAnalystLoading={askAnalystOverview.isLoading}
              brokerSummary={brokerSummary}
              syncSummary={sourceSyncSummary}
            />
          </div>

          {liveMarketMetrics ? (
            <LiveMarketDashboard
              intelligence={intelligence}
              metrics={liveMarketMetrics}
              syncSummary={sourceSyncSummary}
            />
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[minmax(260px,0.8fr)_minmax(280px,0.85fr)]">
            <CompanySnapshotCard intelligence={intelligence} />
            <DataReadinessCard intelligence={intelligence} />
          </div>

          <BrokerResearchCard summary={brokerSummary} />
          <MetricGroupsGrid intelligence={intelligence} />
          <ModelGraphPack sourcePlan={sourcePlan} graphPack={modelGraphPack} />
          <SourceCoverageCard intelligence={intelligence} />
        </>
      )}
    </div>
  );
}

function LiveMarketDashboard({
  intelligence,
  metrics,
  syncSummary,
}: {
  intelligence: CompanyIntelligence;
  metrics: LiveMarketDashboardMetrics;
  syncSummary: SourceSyncStatus[];
}) {
  const marketSync = syncSummary.find((item) => item.source === "AskAnalyst") ?? syncSummary[0];
  return (
    <div className="space-y-4">
      {marketSync ? <SourceFreshnessStrip syncSummary={syncSummary} /> : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {metrics.cards.map((metric) => (
          <SourceMetricCard key={metric.label} metric={metric} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <Card className="min-h-[300px]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-[16px] font-semibold">Share Price Trend</h3>
              <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                {intelligence.marketSignals.sourceLabel} ·{" "}
                {marketSync?.lastSyncedLabel ?? intelligence.marketSignals.updatedAt}
              </p>
            </div>
            <Badge tone="success">AskAnalyst</Badge>
          </div>
          <SharePriceTrendChart points={intelligence.marketSignals.sharePriceTrend} size="large" />
        </Card>
        <Card className="min-h-[300px]">
          <h3 className="text-[16px] font-semibold">Valuation & Range</h3>
          <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
            External provider fields, not workbook output.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 2xl:grid-cols-4">
            {metrics.valuation.map((metric) => (
              <MiniSourceMetric key={metric.label} metric={metric} />
            ))}
          </div>
          <div
            className="mt-5 rounded-lg border px-4 py-3"
            style={{ borderColor: "var(--color-border-default)" }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] font-semibold text-[var(--color-text-muted)]">
                52W Low
              </span>
              <span className="text-[13px] font-bold tnum">{metrics.range.low}</span>
            </div>
            <div className="my-3 h-2 rounded-full bg-[var(--color-border-default)]">
              <div className="h-full w-[68%] rounded-full bg-[#FFC400]" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] font-semibold text-[var(--color-text-muted)]">
                52W High
              </span>
              <span className="text-[13px] font-bold tnum">{metrics.range.high}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-[var(--color-text-muted)]">
              <span>{metrics.range.spreadLabel}</span>
              <span>{metrics.range.source}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function SourceMetricCard({ metric }: { metric: SourceTaggedMetric }) {
  return (
    <Card className="min-h-[118px]">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {metric.label}
        </span>
        <Badge tone={metric.source === "PSX" ? "info" : "success"}>{metric.source}</Badge>
      </div>
      <div
        className="mt-4 text-[24px] font-bold tnum"
        style={{ color: metricToneColor(metric.tone) }}
      >
        {metric.value}
      </div>
      {metric.detail ? (
        <div className="mt-2 text-[11px] leading-snug text-[var(--color-text-muted)]">
          {metric.detail}
        </div>
      ) : null}
      {metric.syncedAt ? (
        <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Last synced {metric.syncedAt}
        </div>
      ) : null}
    </Card>
  );
}

function SourceFreshnessStrip({ syncSummary }: { syncSummary: SourceSyncStatus[] }) {
  return (
    <Card className="py-3">
      <div className="grid gap-2 md:grid-cols-4">
        {syncSummary.map((item) => (
          <div key={item.source} className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-[var(--color-text-primary)]">
                {item.source}
              </span>
              <Badge
                tone={
                  item.status === "synced"
                    ? "success"
                    : item.status === "locked"
                      ? "warning"
                      : "info"
                }
              >
                {item.status}
              </Badge>
            </div>
            <div className="mt-1 truncate text-[11px] text-[var(--color-text-muted)]">
              {item.lastSyncedLabel}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function MiniSourceMetric({ metric }: { metric: SourceTaggedMetric }) {
  return (
    <div className="rounded-md bg-[var(--color-tag-bg)] px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {metric.label}
      </div>
      <div className="mt-1 text-[14px] font-bold tnum">{metric.value}</div>
      <div className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">{metric.source}</div>
      {metric.syncedAt ? (
        <div className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
          Synced {metric.syncedAt}
        </div>
      ) : null}
    </div>
  );
}

function FinancialSourcePlanCard({
  sourcePlan,
  askAnalystLoading,
  brokerSummary,
  syncSummary,
}: {
  sourcePlan: FinancialDashboardSourcePlan;
  askAnalystLoading: boolean;
  brokerSummary: BrokerResearchSummary;
  syncSummary: SourceSyncStatus[];
}) {
  return (
    <Card className="min-h-[250px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge tone={sourcePlan.modelGraphAvailability.available ? "success" : "warning"}>
            {sourcePlan.modelGraphAvailability.available ? "Approved model found" : "Model gated"}
          </Badge>
          <h3 className="mt-4 text-[18px] font-semibold">Dashboard Source Plan</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
            Market intelligence is loaded from live sources. Financial statement analytics stay
            locked until the company has an approved model.
          </p>
        </div>
        {askAnalystLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-[var(--color-brand)]" />
        ) : null}
      </div>
      <div className="mt-5 space-y-3">
        {sourcePlan.liveSections.map((section) => (
          <SourcePlanRow
            key={section.id}
            title={section.title}
            source={section.source}
            syncedAt={syncSummary.find((item) => item.source === section.source)?.lastSyncedLabel}
            locked={section.id === "broker_view" && brokerSummary.status !== "available"}
            lockedLabel="Pending"
          />
        ))}
        {sourcePlan.modelSections.slice(0, 1).map((section) => (
          <SourcePlanRow
            key={section.id}
            title="Financial statement graph pack"
            source={section.source}
            syncedAt={syncSummary.find((item) => item.source === section.source)?.lastSyncedLabel}
            locked={!sourcePlan.modelGraphAvailability.available}
          />
        ))}
      </div>
    </Card>
  );
}

function SourcePlanRow({
  title,
  source,
  syncedAt,
  locked = false,
  lockedLabel = "Locked",
}: {
  title: string;
  source: string;
  syncedAt?: string;
  locked?: boolean;
  lockedLabel?: string;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
      style={{ borderColor: "var(--color-border-default)" }}
    >
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold text-[var(--color-text-primary)]">
          {title}
        </div>
        <div className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{source}</div>
        {syncedAt ? (
          <div className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">{syncedAt}</div>
        ) : null}
      </div>
      <Badge tone={locked ? "warning" : "success"}>{locked ? lockedLabel : "Available"}</Badge>
    </div>
  );
}

function BrokerResearchCard({ summary }: { summary: BrokerResearchSummary }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone={summary.status === "available" ? "success" : "warning"}>
              {summary.source}
            </Badge>
            {summary.date ? (
              <span className="text-[11px] text-[var(--color-text-muted)]">{summary.date}</span>
            ) : null}
          </div>
          <h3 className="mt-3 text-[16px] font-semibold">{summary.title}</h3>
          <p className="mt-2 max-w-[760px] text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
            {summary.detail}
          </p>
          {summary.sourceUrl ? (
            <a
              href={summary.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex text-[12px] font-semibold text-[var(--color-brand)]"
            >
              Open source
            </a>
          ) : null}
        </div>
        <div className="grid min-w-[220px] grid-cols-2 gap-2">
          <MiniBrokerField label="Target Price" value={summary.targetPrice ?? "Not sourced"} />
          <MiniBrokerField label="Rating" value={summary.rating ?? "Not sourced"} />
        </div>
      </div>
    </Card>
  );
}

function MiniBrokerField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[var(--color-tag-bg)] px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </div>
      <div className="mt-1 text-[13px] font-semibold text-[var(--color-text-primary)]">{value}</div>
    </div>
  );
}

function ModelGraphPack({
  sourcePlan,
  graphPack,
}: {
  sourcePlan: FinancialDashboardSourcePlan;
  graphPack: ApprovedModelGraphPack;
}) {
  const availability = sourcePlan.modelGraphAvailability;
  const locked = graphPack.status === "locked";
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-[var(--color-brand)]" />
        <h3 className="text-[16px] font-semibold">Approved Model Financial Graphs</h3>
        <Badge tone={availability.available ? "success" : "warning"}>
          {availability.available ? "Approved Model" : "Requires Model"}
        </Badge>
      </div>
      {graphPack.status === "loading" ? (
        <Card>
          <div className="flex items-center gap-2 text-[13px] text-[var(--color-text-secondary)]">
            <Loader2 className="h-4 w-4 animate-spin text-[var(--color-brand)]" />
            Loading approved model dashboard metrics...
          </div>
        </Card>
      ) : null}
      {graphPack.status === "empty" ? (
        <Card>
          <div className="text-[13px] text-[var(--color-text-secondary)]">{graphPack.reason}</div>
        </Card>
      ) : null}
      {graphPack.status === "available" || graphPack.status === "locked" ? (
        <div className="grid gap-4 xl:grid-cols-4">
          {graphPack.status === "available"
            ? graphPack.cards.map((card) => (
                <ApprovedModelMetricCard key={card.title} card={card} />
              ))
            : sourcePlan.modelSections.map((section, index) => (
                <TemplateChartCard
                  key={section.id}
                  title={section.title}
                  locked={locked}
                  reason={graphPack.reason}
                  variant={index}
                />
              ))}
        </div>
      ) : null}
    </div>
  );
}

function ApprovedModelMetricCard({ card }: { card: ApprovedModelGraphPack["cards"][number] }) {
  return (
    <Card className="min-h-[220px]">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-[15px] font-semibold">{card.title}</h4>
        <Badge tone="success">{card.source}</Badge>
      </div>
      <div className="mt-5 text-[24px] font-bold tnum">{card.value}</div>
      {card.delta ? (
        <div
          className="mt-1 text-[12px] font-semibold"
          style={{
            color: card.delta.trim().startsWith("-")
              ? "var(--color-danger-fg)"
              : "var(--color-success-fg)",
          }}
        >
          {card.delta}
        </div>
      ) : null}
      <div className="mt-5">
        {card.variant % 4 === 0 ? <TemplateAreaChart /> : null}
        {card.variant % 4 === 1 ? <TemplateBarLineChart /> : null}
        {card.variant % 4 === 2 ? <TemplateStackedBars /> : null}
        {card.variant % 4 === 3 ? <TemplateDonut /> : null}
      </div>
    </Card>
  );
}

function TemplateChartCard({
  title,
  locked,
  reason,
  variant,
}: {
  title: string;
  locked: boolean;
  reason?: string;
  variant: number;
}) {
  return (
    <Card className="min-h-[220px]">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-[15px] font-semibold">{title}</h4>
        <Badge tone={locked ? "warning" : "success"}>{locked ? "Locked" : "Ready"}</Badge>
      </div>
      <div className="mt-4">
        {variant % 4 === 0 ? <TemplateAreaChart /> : null}
        {variant % 4 === 1 ? <TemplateBarLineChart /> : null}
        {variant % 4 === 2 ? <TemplateStackedBars /> : null}
        {variant % 4 === 3 ? <TemplateDonut /> : null}
      </div>
      <p className="mt-3 text-[12px] leading-snug text-[var(--color-text-muted)]">
        {locked ? reason : "Source: approved financial model."}
      </p>
    </Card>
  );
}

function TemplateAreaChart() {
  return (
    <svg
      viewBox="0 0 240 95"
      className="h-[95px] w-full"
      role="img"
      aria-label="Area chart template"
    >
      <path d="M12 78 L54 38 L96 22 L138 52 L180 46 L224 30 L224 82 L12 82 Z" fill="#FEDB65" />
      <path
        d="M12 78 L54 38 L96 22 L138 52 L180 46 L224 30"
        fill="none"
        stroke="#111"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TemplateBarLineChart() {
  return (
    <svg
      viewBox="0 0 240 95"
      className="h-[95px] w-full"
      role="img"
      aria-label="Bar and line chart template"
    >
      {[22, 54, 86, 118, 150].map((x, index) => (
        <rect key={x} x={x} y={34 + index * 4} width="24" height={52 - index * 4} fill="#FFC400" />
      ))}
      <path
        d="M22 72 L66 68 L110 60 L154 54 L198 42"
        fill="none"
        stroke="#111"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TemplateStackedBars() {
  return (
    <svg
      viewBox="0 0 240 95"
      className="h-[95px] w-full"
      role="img"
      aria-label="Stacked bar chart template"
    >
      {[24, 72, 120, 168].map((x, index) => (
        <g key={x}>
          <rect x={x} y={44 - index * 5} width="34" height={44 + index * 5} fill="#111" />
          <rect x={x} y={28 - index * 4} width="34" height={16} fill="#FFC400" />
        </g>
      ))}
    </svg>
  );
}

function TemplateDonut() {
  return (
    <svg
      viewBox="0 0 120 95"
      className="h-[95px] w-full"
      role="img"
      aria-label="Donut chart template"
    >
      <circle cx="60" cy="48" r="32" fill="none" stroke="#111" strokeWidth="18" />
      <path d="M60 16 A32 32 0 0 1 91 56" fill="none" stroke="#FFC400" strokeWidth="18" />
      <circle cx="60" cy="48" r="18" fill="#fff" />
    </svg>
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

function SharePriceTrendChart({
  points,
  size = "default",
}: {
  points: MarketPoint[];
  size?: "default" | "large";
}) {
  if (points.length === 0) return null;
  const width = 420;
  const height = size === "large" ? 180 : 112;
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
    <div
      className={
        size === "large"
          ? "mt-5 h-[220px] w-full overflow-hidden"
          : "mt-4 h-[118px] w-full overflow-hidden"
      }
    >
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

function liveMarketMetricsFromIntelligence(
  intelligence: CompanyIntelligence,
): LiveMarketDashboardMetrics {
  const trading = metricGroupItems(intelligence, "Trading Data");
  const returns = metricGroupItems(intelligence, "Returns & History");
  const valuation = metricGroupItems(intelligence, "Valuation Context");

  return buildLiveMarketMetrics({
    lastPrice: intelligence.marketSignals.lastPrice,
    changePct: intelligence.marketSignals.changePct30d,
    changeBasisLabel: "LDCP",
    changeBasisValue: numericFromMetric(trading, "LDCP"),
    lastSyncedAt: intelligence.marketSignals.updatedAt,
    volume: numericFromMetric(trading, "Volume") ?? 0,
    valueTraded: numericFromMetric(trading, "Value traded") ?? 0,
    marketCap: numericFromMetric(valuation, "Market cap") ?? 0,
    pe: numericFromMetric(valuation, "P/E"),
    pbv: numericFromMetric(valuation, "P/BV"),
    dividendYield: numericFromMetric(valuation, "Dividend yield"),
    fiftyTwoWeekHigh: numericFromMetric(returns, "52W high"),
    fiftyTwoWeekLow: numericFromMetric(returns, "52W low"),
    freeFloatPercent: numericFromMetric(valuation, "Free float %"),
  });
}

function metricGroupItems(intelligence: CompanyIntelligence, title: string): IntelligenceMetric[] {
  return intelligence.metricGroups.find((group) => group.title === title)?.items ?? [];
}

function numericFromMetric(items: IntelligenceMetric[], label: string): number | null {
  const value = items.find((item) => item.label.toLowerCase() === label.toLowerCase())?.value;
  if (!value) return null;
  const normalized = value.replace(/,/g, "").toLowerCase();
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed)) return null;
  const unitMatch = normalized.match(/-?\d+(?:\.\d+)?\s*(bn|m|k)\b/);
  const unit = unitMatch?.[1];
  if (unit === "bn") return parsed * 1_000_000_000;
  if (unit === "m") return parsed * 1_000_000;
  if (unit === "k") return parsed * 1_000;
  return parsed;
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
