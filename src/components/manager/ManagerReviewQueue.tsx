import { useMemo, useState } from "react";
import { ArrowRight, ClipboardCheck, Search } from "lucide-react";
import { Badge, Card } from "@/components/PageShell";
import { Button } from "@/components/Button";
import { PaginationControls } from "@/components/PaginationControls";
import { paginateItems } from "@/lib/pagination";
import { buildManagerReviewQueue, type ManagerQueueItem } from "@/lib/manager-workspace";
import type { ProjectResponse } from "@/lib/api/types";

export function ManagerReviewQueue({
  projects,
  loading,
  onOpen,
}: {
  projects: ProjectResponse[];
  loading: boolean;
  onOpen: (projectId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const queue = useMemo(() => buildManagerReviewQueue(projects), [projects]);
  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return queue;
    return queue.filter((item) =>
      [item.companyName, item.sector, item.fiscalYear, item.projectLabel, item.statusLabel]
        .join(" ")
        .toLowerCase()
        .includes(text),
    );
  }, [query, queue]);
  const paginated = useMemo(() => paginateItems(filtered, page), [filtered, page]);

  if (loading) {
    return (
      <Card>
        <div className="text-[13px] text-[var(--color-text-muted)]">Loading review queue...</div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-[var(--color-brand)]" />
            <h2 className="text-[16px] font-semibold">Awaiting My Review</h2>
            <Badge tone="info">{queue.length}</Badge>
          </div>
          <div className="relative w-full max-w-[360px]">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-[var(--color-text-muted)]" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search company, sector, FY, status"
              className="h-9 w-full rounded-md border bg-white pr-3 pl-9 text-[13px] outline-none transition focus:border-[var(--color-brand)]"
              style={{ borderColor: "var(--color-border-default)" }}
            />
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <div className="text-[15px] font-semibold text-[var(--color-text-primary)]">
            No workbooks awaiting review
          </div>
          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
            Analyst submissions will appear here when they are ready for manager approval.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {paginated.map((item) => (
            <ManagerReviewQueueRow key={item.id} item={item} onOpen={onOpen} />
          ))}
          <PaginationControls
            totalItems={filtered.length}
            page={page}
            onPageChange={setPage}
            label="reviews"
          />
        </div>
      )}
    </div>
  );
}

function ManagerReviewQueueRow({
  item,
  onOpen,
}: {
  item: ManagerQueueItem;
  onOpen: (projectId: string) => void;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warning">{item.statusLabel}</Badge>
            <Badge tone="neutral">{item.readinessLabel}</Badge>
          </div>
          <div className="mt-2 text-[15px] font-semibold text-[var(--color-text-primary)]">
            {item.companyName} · {item.fiscalYear}
          </div>
          <div className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
            {item.sector} · {item.projectLabel} · Last updated {formatDate(item.updatedAt)}
          </div>
        </div>
        <Button onClick={() => onOpen(item.id)}>
          <ArrowRight className="h-4 w-4" />
          Review
        </Button>
      </div>
    </Card>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
