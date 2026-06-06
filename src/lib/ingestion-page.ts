import type { WorkspaceResponse } from "@/lib/api/types";
import type { CycleState } from "@/lib/cycle-store";

export function ingestionPageTitle({
  workspace,
  cycle,
}: {
  workspace: WorkspaceResponse | undefined;
  cycle: CycleState;
}) {
  const period = workspace?.project.fiscalYear || cycle.period;
  const company = workspace?.project.companyName || cycle.company;
  return `Ingestion - ${period} · ${company}`;
}

export function filesFromDrop(dataTransfer: DataTransfer | null | undefined): File[] {
  return Array.from(dataTransfer?.files ?? []);
}
