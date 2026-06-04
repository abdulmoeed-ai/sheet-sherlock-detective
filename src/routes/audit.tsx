import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, ShieldCheck, User } from "lucide-react";
import { PageShell, Card, Badge } from "@/components/PageShell";
import { Button } from "@/components/Button";
import { downloadArchiveAuditJson, readLatestArchive } from "@/lib/api/projects";
import { queryKeys } from "@/lib/api/query-keys";
import { useSelectedProjectId } from "@/lib/project-store";
import { useWorkspace } from "@/hooks/use-projects";
import { auditRows } from "@/lib/mappers/workspace";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Audit Trail — Sheet Sherlock" },
      {
        name: "description",
        content: "Immutable audit log of every system and human action with full data lineage.",
      },
    ],
  }),
  component: Audit,
});

function Audit() {
  const projectId = useSelectedProjectId();
  const workspace = useWorkspace(projectId);
  const archive = useQuery({
    queryKey: projectId ? queryKeys.latestArchive(projectId) : ["archive", "none"],
    queryFn: () => readLatestArchive(projectId as string),
    enabled: !!projectId,
    retry: false,
  });
  const events = auditRows(workspace.data);

  const exportJson = async () => {
    if (!projectId || !archive.data?.id) return;
    const blob = await downloadArchiveAuditJson(projectId, archive.data.id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${archive.data.id}-audit.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageShell
      title="Audit Trail"
      subtitle={
        projectId
          ? "Backend audit events and archive package."
          : "Select a project from the registry to inspect audit events."
      }
      actions={
        <Button variant="secondary" onClick={exportJson} disabled={!archive.data?.id}>
          <Download className="h-4 w-4" /> Export JSON
        </Button>
      }
    >
      {!projectId ? (
        <Card>
          <div className="text-[13px] text-[var(--color-text-secondary)]">No project selected.</div>
        </Card>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-4 gap-4">
            <Metric label="Total events" value={events.length} />
            <Metric label="Archive" value={archive.data?.status ?? "n/a"} />
            <Metric label="Version" value={archive.data?.version ?? "-"} />
            <Metric
              label="PDF"
              value={archive.data?.pdfAvailable ? "available" : "not available"}
            />
          </div>

          <Card>
            <h3 className="text-[15px] font-semibold">Event log</h3>
            {workspace.isLoading ? (
              <div className="mt-4 text-[13px] text-[var(--color-text-muted)]">
                Loading audit trail...
              </div>
            ) : events.length === 0 ? (
              <div className="mt-4 text-[13px] text-[var(--color-text-muted)]">
                No audit events have been recorded yet.
              </div>
            ) : (
              <ol
                className="relative mt-4 ml-3 border-l-2"
                style={{ borderColor: "var(--color-border-default)" }}
              >
                {events.map((event) => (
                  <li key={event.id} className="relative pb-5 pl-6 last:pb-0">
                    <span
                      className="absolute -left-[13px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white"
                      style={{
                        border: "2px solid var(--color-accent-green)",
                        color: "var(--color-brand)",
                      }}
                    >
                      {event.actor === "system" ? (
                        <ShieldCheck className="h-4 w-4" />
                      ) : (
                        <User className="h-4 w-4" />
                      )}
                    </span>
                    <div className="flex items-baseline gap-3">
                      <span className="text-[12px] font-mono text-[var(--color-text-muted)]">
                        {event.timestamp}
                      </span>
                      <Badge tone={event.actor === "system" ? "ai" : "info"}>{event.actor}</Badge>
                    </div>
                    <div className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
                      {event.action}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </>
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
      <div className="mt-2 text-[24px] font-bold tnum">{value}</div>
    </Card>
  );
}
