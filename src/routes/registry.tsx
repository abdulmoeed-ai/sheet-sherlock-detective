import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, FileClock, GitBranch } from "lucide-react";
import { PageShell, Card, Badge } from "@/components/PageShell";
import { Button } from "@/components/Button";
import { useProjects } from "@/hooks/use-projects";
import { setSelectedProjectId } from "@/lib/project-store";

export const Route = createFileRoute("/registry")({
  head: () => ({
    meta: [
      { title: "Model Registry — Sheet Sherlock" },
      { name: "description", content: "Project registry backed by the Sheet Sherlock API." },
    ],
  }),
  component: Registry,
});

function Registry() {
  const navigate = useNavigate();
  const projects = useProjects();

  return (
    <PageShell
      title="Model Registry Intelligence"
      subtitle="Backend project registry and version status."
      hideProgress
    >
      <div className="mb-5 grid grid-cols-3 gap-4">
        <Card>
          <div className="text-[12px] uppercase tracking-wider text-[var(--color-text-secondary)]">
            Projects
          </div>
          <div className="mt-2 text-[24px] font-bold tnum">{projects.data?.length ?? 0}</div>
        </Card>
        <Card>
          <div className="text-[12px] uppercase tracking-wider text-[var(--color-text-secondary)]">
            In review
          </div>
          <div className="mt-2 text-[24px] font-bold tnum">
            {(projects.data ?? []).filter((project) => project.status.includes("review")).length}
          </div>
        </Card>
        <Card>
          <div className="text-[12px] uppercase tracking-wider text-[var(--color-text-secondary)]">
            Approved
          </div>
          <div className="mt-2 text-[24px] font-bold tnum">
            {(projects.data ?? []).filter((project) => project.status === "approved").length}
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <FileClock className="h-4 w-4 text-[var(--color-brand)]" />
          <h3 className="text-[15px] font-semibold">All backend projects</h3>
        </div>
        {projects.isLoading ? (
          <div className="text-[13px] text-[var(--color-text-muted)]">Loading registry...</div>
        ) : (projects.data ?? []).length === 0 ? (
          <div
            className="rounded-md border px-4 py-5 text-[13px] text-[var(--color-text-secondary)]"
            style={{ borderColor: "var(--color-border-default)" }}
          >
            No projects are available to this account.
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="border-b text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
              <tr>
                <th className="py-2 text-left">Company</th>
                <th className="text-left">FY</th>
                <th className="text-left">Status</th>
                <th className="text-right">Review</th>
                <th className="text-left">Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(projects.data ?? []).map((project) => (
                <tr key={project.id} className="border-b last:border-0">
                  <td className="py-2 font-semibold">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-3.5 w-3.5 text-[var(--color-brand)]" />
                      {project.companyName}
                    </div>
                  </td>
                  <td>{project.fiscalYear ?? "Current"}</td>
                  <td>
                    <Badge
                      tone={
                        project.status === "approved"
                          ? "success"
                          : project.status.includes("review")
                            ? "warning"
                            : "info"
                      }
                    >
                      {project.status}
                    </Badge>
                  </td>
                  <td className="text-right tnum">
                    {project.reviewProgress.reviewed}/{project.reviewProgress.total}
                  </td>
                  <td className="text-[var(--color-text-muted)]">
                    {new Date(project.updatedAt).toLocaleString()}
                  </td>
                  <td className="text-right">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSelectedProjectId(project.id);
                        navigate({ to: "/audit" });
                      }}
                    >
                      Open <ArrowRight className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </PageShell>
  );
}
