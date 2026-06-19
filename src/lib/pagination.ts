export const DEFAULT_PAGE_SIZE = 10;

export function pageCountFor(totalItems: number, pageSize = DEFAULT_PAGE_SIZE): number {
  if (totalItems <= 0) return 1;
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

export function clampPage(page: number, totalItems: number, pageSize = DEFAULT_PAGE_SIZE): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(1, Math.trunc(page)), pageCountFor(totalItems, pageSize));
}

export function paginateItems<T>(items: T[], page: number, pageSize = DEFAULT_PAGE_SIZE): T[] {
  const safePage = clampPage(page, items.length, pageSize);
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function visiblePageRange(
  page: number,
  totalItems: number,
  pageSize = DEFAULT_PAGE_SIZE,
): {
  from: number;
  to: number;
} {
  if (totalItems <= 0) return { from: 0, to: 0 };
  const safePage = clampPage(page, totalItems, pageSize);
  const from = (safePage - 1) * pageSize + 1;
  return { from, to: Math.min(totalItems, from + pageSize - 1) };
}
