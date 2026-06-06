import type {
  PortfolioCompanySelection,
  PortfolioDashboardResponse,
  PortfolioDashboardVisibility,
  ProjectResponse,
} from "@/lib/api/types";

export function normalizePortfolioCompanies(
  companies: PortfolioCompanySelection[],
): PortfolioCompanySelection[] {
  const seen = new Set<string>();
  return companies.reduce<PortfolioCompanySelection[]>((normalized, company) => {
    const symbol = company.symbol.trim().toUpperCase();
    if (!symbol || seen.has(symbol)) return normalized;
    seen.add(symbol);
    normalized.push({
      ...company,
      symbol,
      name: company.name.trim(),
      sector: company.sector.trim(),
    });
    return normalized;
  }, []);
}

export function portfolioVisibilityLabel(visibility: PortfolioDashboardVisibility) {
  return visibility === "public" ? "Public" : "Private";
}

export function portfolioVisibilityDescription(visibility: PortfolioDashboardVisibility) {
  return visibility === "public"
    ? "Everyone with Dashboard access can view this dashboard."
    : "Only you can view this dashboard.";
}

export function portfolioCompanySummary(companies: PortfolioCompanySelection[]) {
  const sectors = [...new Set(companies.map((company) => company.sector).filter(Boolean))];
  return {
    companyCount: companies.length,
    sectors,
    sectorLabel: sectors.length === 1 ? sectors[0] : `${sectors.length} sectors`,
  };
}

export function filterPortfolioDashboards(
  dashboards: PortfolioDashboardResponse[],
  searchTerm: string,
  creator: string | null = null,
  visibility: PortfolioDashboardVisibility | "all" = "all",
) {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const normalizedCreator = creator?.trim().toLowerCase() || null;
  return dashboards.filter((dashboard) => {
    const searchable = [
      dashboard.name,
      dashboard.description ?? "",
      dashboard.createdByName,
      dashboard.visibility,
      ...dashboard.companySelections.flatMap((company) => [
        company.name,
        company.symbol,
        company.sector,
      ]),
    ]
      .join(" ")
      .toLowerCase();
    const matchesSearch = !normalizedSearch || searchable.includes(normalizedSearch);
    const matchesCreator =
      !normalizedCreator || dashboard.createdByName.toLowerCase() === normalizedCreator;
    const matchesVisibility = visibility === "all" || dashboard.visibility === visibility;
    return matchesSearch && matchesCreator && matchesVisibility;
  });
}

export function sortPortfolioDashboardsByUpdated(dashboards: PortfolioDashboardResponse[]) {
  return [...dashboards].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function buildPortfolioSectorAllocation(companies: PortfolioCompanySelection[]) {
  const total = companies.length || 1;
  return [
    ...companies.reduce((sectors, company) => {
      const current = sectors.get(company.sector) ?? 0;
      sectors.set(company.sector, current + 1);
      return sectors;
    }, new Map<string, number>()),
  ]
    .map(([sector, count]) => ({
      sector,
      count,
      share: count / total,
    }))
    .sort((left, right) => right.count - left.count || left.sector.localeCompare(right.sector));
}

export function buildPortfolioApprovedModelCoverage(
  companies: PortfolioCompanySelection[],
  projects: ProjectResponse[],
) {
  const rows = companies.map((company) => {
    const project = projects.find(
      (candidate) =>
        normalize(candidate.companyName) === normalize(company.name) &&
        candidate.status === "approved",
    );
    return {
      company,
      project: project ?? null,
      available: Boolean(project),
      statusLabel: project ? "Approved model available" : "Approved model not available",
    };
  });
  const availableCount = rows.filter((row) => row.available).length;
  return {
    rows,
    availableCount,
    totalCount: companies.length,
    label: `${availableCount} of ${companies.length} companies have approved models`,
  };
}

export function portfolioSourceSyncRange(values: Array<string | null | undefined>) {
  const validValues = values.filter((value): value is string => Boolean(value));
  if (validValues.length === 0) {
    return {
      freshest: null,
      stalest: null,
      label: "No live source sync timestamp available yet",
    };
  }
  const sorted = [...validValues].sort((left, right) => {
    const leftTime = Date.parse(left);
    const rightTime = Date.parse(right);
    if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
      return right.localeCompare(left);
    }
    return rightTime - leftTime;
  });
  return {
    freshest: sorted[0],
    stalest: sorted[sorted.length - 1],
    label:
      sorted.length === 1
        ? `Last synced ${sorted[0]}`
        : `Last synced range ${sorted[sorted.length - 1]} to ${sorted[0]}`,
  };
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}
