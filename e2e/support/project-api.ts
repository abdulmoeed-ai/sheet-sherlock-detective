import type { APIRequestContext } from "@playwright/test";
import { expect } from "@playwright/test";
import {
  API_BASE_URL,
  MILLAT_COMPANY,
  MILLAT_FISCAL_YEAR,
  MILLAT_PERIOD,
  MILLAT_SECTOR,
  MILLAT_TICKER,
} from "./constants";
import { authHeaders, expectOk } from "./api";

export async function createMillatRequest(
  request: APIRequestContext,
  accessToken: string,
  analystEmail: string,
): Promise<Record<string, any>> {
  const response = await request.post(`${API_BASE_URL}/api/analysis-requests`, {
    headers: authHeaders(accessToken),
    data: {
      assignedAnalystEmail: analystEmail,
      companyName: MILLAT_COMPANY,
      companySymbol: MILLAT_TICKER,
      sector: MILLAT_SECTOR,
      fiscalYear: MILLAT_PERIOD,
      priority: "high",
      note: "Playwright E2E Millat FY2025 request",
      template: "Millat - Template.xlsx",
    },
  });
  await expectOk(response);
  return response.json();
}

export async function acknowledgeAndConvertRequest(
  request: APIRequestContext,
  accessToken: string,
  requestId: string,
): Promise<Record<string, any>> {
  const acknowledge = await request.post(`${API_BASE_URL}/api/analysis-requests/${requestId}/acknowledge`, {
    headers: authHeaders(accessToken),
  });
  await expectOk(acknowledge);
  const convert = await request.post(`${API_BASE_URL}/api/analysis-requests/${requestId}/convert-to-project`, {
    headers: authHeaders(accessToken),
  });
  await expectOk(convert);
  return convert.json();
}

export async function createMillatProject(request: APIRequestContext, accessToken: string): Promise<Record<string, any>> {
  const response = await request.post(`${API_BASE_URL}/api/projects`, {
    headers: authHeaders(accessToken),
    data: {
      companyName: MILLAT_COMPANY,
      projectLabel: `${MILLAT_COMPANY} ${MILLAT_PERIOD} annual report analysis`,
      sector: MILLAT_SECTOR,
      fiscalYear: MILLAT_FISCAL_YEAR,
      currencyUnit: "Rs in Thousands",
      template: "Millat - Template.xlsx",
      teamMembers: [],
    },
  });
  await expectOk(response);
  return response.json();
}

export async function pollExtraction(
  request: APIRequestContext,
  accessToken: string,
  projectId: string,
  jobId: string,
): Promise<Record<string, any>> {
  for (let index = 0; index < 120; index += 1) {
    const response = await request.get(`${API_BASE_URL}/api/projects/${projectId}/extractions/${jobId}`, {
      headers: authHeaders(accessToken),
    });
    await expectOk(response);
    const job = await response.json();
    if (job.status === "completed") {
      expect(job.percent).toBeGreaterThanOrEqual(100);
      return job;
    }
    if (job.status === "failed") {
      throw new Error(`Extraction failed: ${job.error ?? job.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error("Extraction did not complete within the E2E timeout.");
}
