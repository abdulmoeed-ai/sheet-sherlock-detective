import { Badge, Card } from "@/components/PageShell";
import type { ProjectResponse } from "@/lib/api/types";
import { managerProjectStatusLabel } from "@/lib/manager-workspace";

export function ManagerReviewDetailHeader({ project }: { project: ProjectResponse }) {
  const reviewed = project.reviewProgress?.reviewed ?? 0;
  const total = project.reviewProgress?.total ?? 0;
  const ready = total > 0 && reviewed >= total;

  return (
    <Card className="mb-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warning">{managerProjectStatusLabel(project.status)}</Badge>
            <Badge tone={ready ? "success" : "info"}>
              {ready ? "Ready to approve" : `${reviewed}/${total || "?"} fields reviewed`}
            </Badge>
          </div>
          <h2 className="mt-2 text-[18px] font-semibold text-[var(--color-text-primary)]">
            {project.companyName} · {project.fiscalYear ?? "Current period"}
          </h2>
          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
            {project.sector ?? "Unassigned sector"} · {project.projectLabel ?? "Workbook review"}
          </p>
        </div>
        <div className="text-right text-[12px] text-[var(--color-text-muted)]">
          Last updated
          <div className="mt-1 font-semibold text-[var(--color-text-primary)]">
            {formatDate(project.updatedAt)}
          </div>
        </div>
      </div>
    </Card>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
