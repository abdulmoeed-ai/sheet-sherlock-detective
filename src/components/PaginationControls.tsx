import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { clampPage, DEFAULT_PAGE_SIZE, pageCountFor, visiblePageRange } from "@/lib/pagination";

interface PaginationControlsProps {
  totalItems: number;
  page: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  label?: string;
  className?: string;
}

export function PaginationControls({
  totalItems,
  page,
  onPageChange,
  pageSize = DEFAULT_PAGE_SIZE,
  label = "records",
  className,
}: PaginationControlsProps) {
  if (totalItems <= pageSize) return null;

  const pageCount = pageCountFor(totalItems, pageSize);
  const currentPage = clampPage(page, totalItems, pageSize);
  const { from, to } = visiblePageRange(currentPage, totalItems, pageSize);
  const pages = compactPages(currentPage, pageCount);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-[12px]",
        className,
      )}
      style={{ borderColor: "var(--color-border-default)" }}
    >
      <div className="text-[var(--color-text-muted)]">
        Showing {from}-{to} of {totalItems} {label}
      </div>
      <nav className="flex items-center gap-1" aria-label={`${label} pagination`}>
        <PageButton
          disabled={currentPage === 1}
          ariaLabel="Previous page"
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </PageButton>
        {pages.map((item, index) =>
          item === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              className="flex h-8 min-w-8 items-center justify-center px-1 text-[var(--color-text-muted)]"
            >
              ...
            </span>
          ) : (
            <PageButton
              key={item}
              active={item === currentPage}
              ariaLabel={`Page ${item}`}
              onClick={() => onPageChange(item)}
            >
              {item}
            </PageButton>
          ),
        )}
        <PageButton
          disabled={currentPage === pageCount}
          ariaLabel="Next page"
          onClick={() => onPageChange(currentPage + 1)}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </PageButton>
      </nav>
    </div>
  );
}

function PageButton({
  children,
  onClick,
  active = false,
  disabled = false,
  ariaLabel,
}: {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-current={active ? "page" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-md border px-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-45",
        active
          ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white"
          : "bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-tag-bg)]",
      )}
      style={{ borderColor: active ? "var(--color-brand)" : "var(--color-border-default)" }}
    >
      {children}
    </button>
  );
}

function compactPages(currentPage: number, pageCount: number): Array<number | "ellipsis"> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);

  const pages = new Set([1, pageCount, currentPage - 1, currentPage, currentPage + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= pageCount).sort((a, b) => a - b);
  const output: Array<number | "ellipsis"> = [];

  sorted.forEach((page, index) => {
    const previous = sorted[index - 1];
    if (previous && page - previous > 1) output.push("ellipsis");
    output.push(page);
  });

  return output;
}
