import type { PsxCompany } from "@/lib/api/users";
import type { AnalysisRequestResponse, BackendRole, ProjectResponse } from "@/lib/api/types";

export interface DashboardCompanySelection {
  name: string;
  symbol: string | null;
  sector: string | null;
  fiscalYear: string;
}

export type DashboardRenderState =
  | { kind: "manager" }
  | { kind: "project_list"; role: BackendRole }
  | {
      kind: "analyst_company_no_model";
      company: DashboardCompanySelection;
      request: AnalysisRequestResponse | null;
      startMode: "convert_request" | "create_project";
    };

interface DashboardStateInput {
  role: BackendRole;
  projects: ProjectResponse[];
  requests: AnalysisRequestResponse[];
  psxCompanies: PsxCompany[];
}

const REQUESTS_WITHOUT_MODEL = new Set(["pending", "acknowledged"]);

export function buildDashboardState(input: DashboardStateInput): DashboardRenderState {
  if (input.role === "finance_manager") return { kind: "manager" };
  if (input.role !== "finance_analyst") return { kind: "project_list", role: input.role };

  const request = firstRequestWithoutModel(input.requests);
  if (request) {
    return {
      kind: "analyst_company_no_model",
      company: companyFromRequest(request),
      request,
      startMode: "convert_request",
    };
  }

  const companyWithoutModel = firstCompanyWithoutModel(input.psxCompanies, input.projects);
  if (companyWithoutModel) {
    return {
      kind: "analyst_company_no_model",
      company: {
        name: companyWithoutModel.name,
        symbol: companyWithoutModel.symbol,
        sector: companyWithoutModel.sector,
        fiscalYear: "FY2025",
      },
      request: null,
      startMode: "create_project",
    };
  }

  if (input.projects.length > 0) {
    return { kind: "project_list", role: input.role };
  }

  return {
    kind: "analyst_company_no_model",
    company: {
      name: "Millat Tractors Limited",
      symbol: "MTL",
      sector: "Engineering & Industrials",
      fiscalYear: "FY2025",
    },
    request: null,
    startMode: "create_project",
  };
}

function firstRequestWithoutModel(requests: AnalysisRequestResponse[]) {
  return requests
    .filter((request) => REQUESTS_WITHOUT_MODEL.has(request.status) && !request.projectId)
    .sort(
      (a, b) =>
        priorityRank(b.priority) - priorityRank(a.priority) ||
        b.createdAt.localeCompare(a.createdAt),
    )[0];
}

function companyFromRequest(request: AnalysisRequestResponse): DashboardCompanySelection {
  return {
    name: request.companyName,
    symbol: request.companySymbol,
    sector: request.sector,
    fiscalYear: request.fiscalYear ?? "FY2025",
  };
}

function firstCompanyWithoutModel(psxCompanies: PsxCompany[], projects: ProjectResponse[]) {
  const modeledCompanies = new Set(projects.map((project) => normalizeName(project.companyName)));
  return psxCompanies.find((company) => !modeledCompanies.has(normalizeName(company.name)));
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function priorityRank(priority: AnalysisRequestResponse["priority"]): number {
  const ranks: Record<AnalysisRequestResponse["priority"], number> = {
    urgent: 4,
    high: 3,
    normal: 2,
    low: 1,
  };
  return ranks[priority];
}
