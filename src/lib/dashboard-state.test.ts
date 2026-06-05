import { describe, expect, it } from "vitest";
import { buildDashboardState } from "./dashboard-state";
import type { AnalysisRequestResponse, BackendRole, ProjectResponse } from "@/lib/api/types";

const request = (overrides: Partial<AnalysisRequestResponse> = {}): AnalysisRequestResponse => ({
  id: "request-1",
  requesterUserId: "manager-1",
  assignedAnalystEmail: "analyst@example.com",
  assignedAnalystUserId: null,
  companyName: "Millat Tractors Limited",
  companySymbol: "MTL",
  sector: "Engineering & Industrials",
  fiscalYear: "FY2025",
  template: "Millat - Template.xlsx",
  priority: "normal",
  dueDate: null,
  note: null,
  status: "pending",
  projectId: null,
  emailStatus: "sent",
  emailResult: {},
  auditEvents: [],
  createdAt: "2026-06-01T09:00:00Z",
  acknowledgedAt: null,
  convertedAt: null,
  ...overrides,
});

const project = (overrides: Partial<ProjectResponse> = {}): ProjectResponse => ({
  id: "project-1",
  companyName: "Millat Tractors Limited",
  projectLabel: null,
  sector: "Engineering & Industrials",
  fiscalYear: "FY2025",
  currencyUnit: "Rs in Thousands",
  template: "Millat - Template.xlsx",
  status: "created",
  createdAt: "2026-06-01T09:00:00Z",
  updatedAt: "2026-06-01T09:00:00Z",
  teamMembers: [],
  pdfs: [],
  reviewProgress: { total: 0, reviewed: 0 },
  ...overrides,
});

function stateInput(overrides: Partial<Parameters<typeof buildDashboardState>[0]> = {}) {
  return {
    role: "finance_analyst" as BackendRole,
    projects: [],
    requests: [],
    psxCompanies: [],
    ...overrides,
  };
}

describe("dashboard state renderer", () => {
  it("keeps managers on the manager dashboard", () => {
    const state = buildDashboardState(stateInput({ role: "finance_manager" }));

    expect(state.kind).toBe("manager");
  });

  it("renders the analyst company/no-model state for assigned requests without projects", () => {
    const state = buildDashboardState(stateInput({ requests: [request()] }));

    expect(state).toMatchObject({
      kind: "analyst_company_no_model",
      startMode: "convert_request",
      company: {
        name: "Millat Tractors Limited",
        symbol: "MTL",
        fiscalYear: "FY2025",
      },
    });
  });

  it("renders a no-model company even when the analyst has unrelated projects", () => {
    const state = buildDashboardState(
      stateInput({
        projects: [project()],
        psxCompanies: [
          { name: "Millat Tractors Limited", symbol: "MTL", sector: "Engineering & Industrials" },
          { name: "MCB Bank Limited", symbol: "MCB", sector: "Commercial Banks" },
        ],
      }),
    );

    expect(state).toMatchObject({
      kind: "analyst_company_no_model",
      startMode: "create_project",
      company: {
        name: "MCB Bank Limited",
        symbol: "MCB",
      },
    });
  });

  it("uses the existing project list when every known company already has a project", () => {
    const state = buildDashboardState(
      stateInput({
        projects: [project()],
        psxCompanies: [
          { name: "Millat Tractors Limited", symbol: "MTL", sector: "Engineering & Industrials" },
        ],
      }),
    );

    expect(state).toEqual({ kind: "project_list", role: "finance_analyst" });
  });

  it("starts from a selected company when no model exists and no request has arrived", () => {
    const state = buildDashboardState(
      stateInput({
        psxCompanies: [{ name: "MCB Bank Limited", symbol: "MCB", sector: "Commercial Banks" }],
      }),
    );

    expect(state).toMatchObject({
      kind: "analyst_company_no_model",
      startMode: "create_project",
      company: {
        name: "MCB Bank Limited",
        symbol: "MCB",
      },
    });
  });
});
