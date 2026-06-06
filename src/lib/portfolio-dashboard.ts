import type {
  PortfolioCompanySelection,
  PortfolioDashboardResponse,
  PortfolioDashboardVisibility,
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
