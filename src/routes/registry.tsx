import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Eye, FileClock, GitBranch, Plus } from "lucide-react";
import { PageShell, Card, Badge } from "@/components/PageShell";
import { Button } from "@/components/Button";
import { Combobox } from "@/components/Combobox";
import { useProjects, useCreateProject } from "@/hooks/use-projects";
import { usePsxCompanies } from "@/hooks/use-users";
import { setSelectedProjectId } from "@/lib/project-store";
import { cycleStore } from "@/lib/cycle-store";
import type { ProjectResponse } from "@/lib/api/types";

const FISCAL_YEARS = ["FY2020", "FY2021", "FY2022", "FY2023", "FY2024", "FY2025", "FY2026"];

export const Route = createFileRoute("/registry")({
  head: () => ({
    meta: [
      { title: "Model Registry — Sheet Sherlock" },
      { name: "description", content: "Silent pre-initiation lookup, version timeline, and CFO-grade decision cards." },
    ],
  }),
  component: Registry,
});

function versionId(symbol: string, fy: string, num: number) {
  return `${symbol}_${fy}_v${num}`;
}

function completeness(project: ProjectResponse) {
  const { reviewed, total } = project.reviewProgress;
  if (!total) return 0;
  return Math.round((reviewed / total) * 100);
}

// Projects the analyst can still act on (not yet submitted to manager/CFO/approved)
const ACTIVE_STATUSES = new Set([
  "created",
  "documents_uploaded",
  "extracting",
  "extraction_failed",
  "awaiting_review",
  "cfo_changes_requested",
]);

function isActive(status: string) {
  return ACTIVE_STATUSES.has(status);
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    created: "DRAFT",
    documents_uploaded: "DRAFT",
    extracting: "EXTRACTING",
    extraction_failed: "FAILED",
    awaiting_review: "PENDING REVIEW",
    manager_review: "IN REVIEW",
    cfo_review: "CFO REVIEW",
    cfo_changes_requested: "CHANGES REQUESTED",
    approved: "APPROVED",
  };
  return map[status] ?? status.toUpperCase().replace(/_/g, " ");
}

function statusTone(status: string): "success" | "warning" | "info" | "neutral" {
  if (status === "approved") return "success";
  if (status === "created" || status === "documents_uploaded" || status === "extraction_failed")
    return "info";
  if (status.includes("review") || status === "cfo_changes_requested") return "warning";
  return "neutral";
}

function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>;
}

function Registry() {
  const navigate = useNavigate();
  const projects = useProjects();
  const psxCompanies = usePsxCompanies();
  const createProject = useCreateProject();

  const [selectedSector, setSelectedSector] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [selectedFY, setSelectedFY] = useState("FY2025");

  // ── Sector options from PSX data ──────────────────────────────────────────
  const sectorOptions = useMemo(() => {
    const sectors = [...new Set((psxCompanies.data ?? []).map((c) => c.sector))]
      .filter(Boolean)
      .sort();
    return sectors.map((s) => ({ value: s, label: s }));
  }, [psxCompanies.data]);

  // ── Company options filtered by sector ───────────────────────────────────
  const companyOptions = useMemo(() => {
    return (psxCompanies.data ?? [])
      .filter((c) => !selectedSector || c.sector === selectedSector)
      .map((c) => ({ value: c.symbol, label: `${c.name} (${c.symbol})` }));
  }, [psxCompanies.data, selectedSector]);

  const selectedCompany = useMemo(
    () => psxCompanies.data?.find((c) => c.symbol === selectedSymbol),
    [psxCompanies.data, selectedSymbol],
  );

  const handleSectorChange = (sector: string) => {
    setSelectedSector(sector);
    setSelectedSymbol("");
  };

  // ── Projects for selected company, versioned by creation order ───────────
  const companyProjects = useMemo(() => {
    if (!selectedCompany) return [];
    return (projects.data ?? [])
      .filter((p) => p.companyName === selectedCompany.name)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((p, i) => ({ ...p, versionNum: i + 1 }));
  }, [projects.data, selectedCompany]);

  const fyProjects = useMemo(
    () => companyProjects.filter((p) => p.fiscalYear === selectedFY),
    [companyProjects, selectedFY],
  );

  // Active = analyst can still act on it (not yet in manager/CFO review or approved)
  const activeProject = fyProjects.find((p) => isActive(p.status));

  // ── New version ───────────────────────────────────────────────────────────
  const handleNewVersion = async () => {
    if (!selectedCompany) return;
    const project = await createProject.mutateAsync({
      companyName: selectedCompany.name,
      sector: selectedCompany.sector,
      fiscalYear: selectedFY,
      template: "Millat - Template.xlsx",
      teamMembers: [],
    });
    setSelectedProjectId(project.id);
    cycleStore.startCycle({
      sector: selectedCompany.sector,
      company: selectedCompany.name,
      period: selectedFY,
    });
    navigate({ to: "/ingestion" });
  };

  const handleResume = (project: ProjectResponse & { versionNum?: number }) => {
    setSelectedProjectId(project.id);
    cycleStore.startCycle({
      sector: project.sector ?? selectedCompany?.sector ?? "",
      company: project.companyName,
      period: project.fiscalYear ?? selectedFY,
    });
    cycleStore.setStatus("diagnosis");
    navigate({ to: "/diagnosis" });
  };

  // Build versioned projects list: correct version numbers per company, PSX symbol resolved
  const versionedProjects = useMemo(() => {
    const byCompany = new Map<string, ProjectResponse[]>();
    (projects.data ?? []).forEach((p) => {
      const key = p.companyName;
      if (!byCompany.has(key)) byCompany.set(key, []);
      byCompany.get(key)!.push(p);
    });
    const result: Array<ProjectResponse & { versionNum: number; symbol: string }> = [];
    byCompany.forEach((projs) => {
      const sorted = [...projs].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      sorted.forEach((p, i) => {
        const match = psxCompanies.data?.find((c) => c.name === p.companyName);
        const symbol = match?.symbol ?? p.companyName.split(" ")[0].toUpperCase();
        result.push({ ...p, versionNum: i + 1, symbol });
      });
    });
    return result.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [projects.data, psxCompanies.data]);

  const handleOpenFromTable = (project: ProjectResponse) => {
    setSelectedProjectId(project.id);
    const matchingPsx = psxCompanies.data?.find((c) => c.name === project.companyName);
    cycleStore.startCycle({
      sector: project.sector ?? matchingPsx?.sector ?? "",
      company: project.companyName,
      period: project.fiscalYear ?? "",
    });
    cycleStore.setStatus("diagnosis");
    navigate({ to: "/diagnosis" });
  };

  return (
    <PageShell
      title="Model Registry Intelligence"
      subtitle="Silent pre-initiation lookup, version timeline, and CFO-grade decision cards. Versioning: [TICKER]_[FY]_v[N]."
      hideProgress
    >
      <div className="space-y-5">
      {/* ── Selector ──────────────────────────────────────────────────────── */}
      <Card>
        <div className="grid grid-cols-[1fr_1fr_180px] gap-3 items-end">
          <Combobox
            label="Sector"
            options={sectorOptions}
            value={selectedSector}
            onChange={handleSectorChange}
            placeholder={psxCompanies.isLoading ? "Loading…" : "Select sector…"}
            disabled={psxCompanies.isLoading}
          />
          <Combobox
            label="Company"
            options={companyOptions}
            value={selectedSymbol}
            onChange={setSelectedSymbol}
            placeholder={!selectedSector ? "Select sector first…" : "Select company…"}
            disabled={psxCompanies.isLoading || !selectedSector}
          />
          <label>
            <span className="mb-1 block text-[12px] font-semibold text-[var(--color-text-secondary)]">
              Fiscal year
            </span>
            <select
              value={selectedFY}
              onChange={(e) => setSelectedFY(e.target.value)}
              className="h-10 w-full rounded-md border px-3 text-[13px]"
              style={{ borderColor: "var(--color-border-strong)" }}
            >
              {FISCAL_YEARS.map((fy) => (
                <option key={fy} value={fy}>
                  {fy}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 text-right text-[11px] text-[var(--color-text-muted)]">
          Registry lookup runs in &lt; 1s · every decision logged to audit trail
        </p>
      </Card>

      {/* ── Decision card ─────────────────────────────────────────────────── */}
      {selectedCompany && (
        <>
          {activeProject ? (
            <Card>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="mb-1.5 flex items-center gap-2">
                    <Badge tone="neutral">DECISION CARD</Badge>
                    <StatusBadge status={activeProject.status} />
                  </div>
                  <p className="text-[15px] font-semibold">
                    {versionId(selectedSymbol, selectedFY, activeProject.versionNum)} in progress —
                    Resume or start a new version.
                  </p>
                  <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                    Completeness {completeness(activeProject)}% · last updated{" "}
                    {new Date(activeProject.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => handleResume(activeProject)}
                  >
                    <Eye className="h-4 w-4" />
                    Resume {versionId(selectedSymbol, selectedFY, activeProject.versionNum)}
                  </Button>
                  <Button onClick={handleNewVersion} disabled={createProject.isPending}>
                    <Plus className="h-4 w-4" />
                    New version
                  </Button>
                </div>
              </div>
            </Card>
          ) : fyProjects.length === 0 ? (
            <Card>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="mb-1.5 flex items-center gap-2">
                    <Badge tone="neutral">DECISION CARD</Badge>
                  </div>
                  <p className="text-[15px] font-semibold">
                    No model exists for {selectedCompany.name} · {selectedFY}
                  </p>
                  <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                    Start a fresh ingestion to create version 1.
                  </p>
                </div>
                <Button onClick={handleNewVersion} disabled={createProject.isPending}>
                  <Plus className="h-4 w-4" />
                  Start {versionId(selectedSymbol, selectedFY, 1)}
                </Button>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="mb-1.5 flex items-center gap-2">
                    <Badge tone="neutral">DECISION CARD</Badge>
                    <Badge tone="warning">IN REVIEW / APPROVED</Badge>
                  </div>
                  <p className="text-[15px] font-semibold">
                    All versions submitted or approved for {selectedCompany.name} · {selectedFY}
                  </p>
                  <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                    Start a new version to continue analysis.
                  </p>
                </div>
                <Button onClick={handleNewVersion} disabled={createProject.isPending}>
                  <Plus className="h-4 w-4" />
                  New version
                </Button>
              </div>
            </Card>
          )}

          {/* ── Version timeline ────────────────────────────────────────── */}
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-[var(--color-brand)]" />
              <h3 className="text-[15px] font-semibold">
                Version timeline · {selectedSymbol}
              </h3>
            </div>
            {companyProjects.length === 0 ? (
              <p className="text-[13px] text-[var(--color-text-muted)]">
                No versions found for {selectedCompany.name}.
              </p>
            ) : (
              <div className="space-y-2">
                {[...companyProjects].reverse().map((project) => {
                  const vid = versionId(selectedSymbol, project.fiscalYear ?? "FY", project.versionNum);
                  const pct = completeness(project);
                  const active = isActive(project.status);
                  return (
                    <div key={project.id} className="flex items-center gap-3">
                      <div
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{
                          background:
                            project.status === "approved"
                              ? "var(--color-success)"
                              : active
                                ? "#7c3aed"
                                : "var(--color-warning, #f59e0b)",
                        }}
                      />
                      <span className="w-44 text-[13px] font-semibold">{vid}</span>
                      <StatusBadge status={project.status} />
                      <span className="flex-1 text-[12px] text-[var(--color-text-muted)]">
                        {pct}% complete · {new Date(project.updatedAt).toLocaleString()}
                      </span>
                      {active && (
                        <Button
                          variant="secondary"
                          onClick={() => handleResume(project)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Resume
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}

      {/* ── All models table ──────────────────────────────────────────────── */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileClock className="h-4 w-4 text-[var(--color-brand)]" />
            <h3 className="text-[15px] font-semibold">All models in registry</h3>
          </div>
          {versionedProjects.length > 0 && (
            <span className="text-[12px] text-[var(--color-text-muted)]">
              {versionedProjects.length} model{versionedProjects.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {projects.isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-lg"
                style={{ background: "var(--color-border-default)" }}
              />
            ))}
          </div>
        ) : versionedProjects.length === 0 ? (
          <div
            className="rounded-lg border px-6 py-8 text-center"
            style={{ borderColor: "var(--color-border-default)" }}
          >
            <FileClock className="mx-auto mb-2 h-8 w-8 opacity-30" />
            <p className="text-[13px] text-[var(--color-text-secondary)]">
              No models in registry for this account.
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div
              className="mb-1 grid items-center gap-4 border-b px-4 pb-2 text-[10px] font-semibold uppercase tracking-wider"
              style={{
                gridTemplateColumns: "2fr 80px 72px 130px 140px 1fr auto",
                borderColor: "var(--color-border-default)",
                color: "var(--color-text-muted)",
              }}
            >
              <span>Version ID</span>
              <span>Ticker</span>
              <span>FY</span>
              <span>Status</span>
              <span>Completeness</span>
              <span>Last edited</span>
              <span />
            </div>

            {/* Rows */}
            <div className="space-y-1">
              {versionedProjects.map((project) => {
                const pct = completeness(project);
                const vid = versionId(project.symbol, project.fiscalYear ?? "FY", project.versionNum);
                const active = isActive(project.status);
                return (
                  <div
                    key={project.id}
                    onClick={() => handleOpenFromTable(project)}
                    className="group grid cursor-pointer items-center gap-4 rounded-lg px-4 py-3 transition-colors hover:bg-[var(--color-tag-bg)]"
                    style={{ gridTemplateColumns: "2fr 80px 72px 130px 140px 1fr auto" }}
                  >
                    {/* Version ID + company name */}
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold tnum">{vid}</div>
                      <div className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]">
                        {project.companyName}
                        {project.sector ? ` · ${project.sector}` : ""}
                      </div>
                    </div>

                    {/* Ticker chip */}
                    <div>
                      <span
                        className="inline-block rounded-md px-2 py-0.5 text-[11px] font-bold"
                        style={{
                          background: "var(--color-tag-bg)",
                          color: "var(--color-brand)",
                        }}
                      >
                        {project.symbol}
                      </span>
                    </div>

                    {/* FY */}
                    <div className="text-[13px] tnum">{project.fiscalYear ?? "—"}</div>

                    {/* Status */}
                    <div>
                      <StatusBadge status={project.status} />
                    </div>

                    {/* Completeness with progress bar */}
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span
                          className="text-[12px] font-semibold tnum"
                          style={{
                            color:
                              pct === 100
                                ? "var(--color-success)"
                                : active
                                  ? "var(--color-brand)"
                                  : "var(--color-text-secondary)",
                          }}
                        >
                          {pct}%
                        </span>
                      </div>
                      <div
                        className="h-1.5 w-full overflow-hidden rounded-full"
                        style={{ background: "var(--color-border-default)" }}
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background:
                              pct === 100
                                ? "var(--color-success)"
                                : active
                                  ? "var(--color-brand)"
                                  : "var(--color-text-muted)",
                          }}
                        />
                      </div>
                    </div>

                    {/* Last edited */}
                    <div className="truncate text-[12px] text-[var(--color-text-muted)]">
                      {new Date(project.updatedAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      <span className="text-[11px]">
                        {new Date(project.updatedAt).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {/* Open button — revealed on hover */}
                    <div className="opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold"
                        style={{
                          borderColor: "var(--color-brand)",
                          color: "var(--color-brand)",
                        }}
                      >
                        Open
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>
      </div>
    </PageShell>
  );
}
