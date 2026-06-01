import { test, expect } from "@playwright/test";
import { readStoredUser, storageFor } from "./support/auth";
import { writeFlowState } from "./support/state";
import { MILLAT_COMPANY, MILLAT_PERIOD, MILLAT_SECTOR, MILLAT_TICKER } from "./support/constants";

test.describe.configure({ mode: "serial" });

test("manager creates a Millat FY2025 request in the browser", async ({ browser }) => {
  const context = await browser.newContext({ storageState: storageFor("manager") });
  const page = await context.newPage();
  await page.goto("/requests", { waitUntil: "networkidle" });
  await expect(page.getByTestId("requests-page")).toBeVisible();

  await page.getByTestId("request-company-name").fill(MILLAT_COMPANY);
  await page.getByTestId("request-company-symbol").fill(MILLAT_TICKER);
  await page.getByTestId("request-sector").fill(MILLAT_SECTOR);
  await page.getByTestId("request-fiscal-year").fill(MILLAT_PERIOD);
  await page.getByTestId("request-analyst-email").fill(readStoredUser("analyst").email);
  await page.getByTestId("request-note").fill("Playwright request handoff");
  await page.getByTestId("request-create-submit").click();

  const created = page.getByTestId("request-created-id");
  await expect(created).toBeVisible();
  const requestId = await created.textContent();
  expect(requestId).toBeTruthy();
  writeFlowState({ requestId: requestId ?? undefined });
  await context.close();
});

test("analyst sees the request inbox, opens detail, acknowledges, and converts to project", async ({ browser }) => {
  const context = await browser.newContext({ storageState: storageFor("analyst") });
  const page = await context.newPage();
  await page.goto("/requests", { waitUntil: "networkidle" });
  await expect(page.getByTestId("request-inbox")).toContainText(MILLAT_COMPANY);
  const requestHref = await page.getByTestId("request-row").filter({ hasText: MILLAT_COMPANY }).first().getAttribute("href");
  expect(requestHref).toBeTruthy();
  await page.goto(requestHref!, { waitUntil: "networkidle" });

  await expect(page.getByTestId("request-detail")).toContainText(MILLAT_TICKER);
  await page.getByTestId("request-acknowledge").click();
  await expect(page.getByTestId("request-status")).toContainText(/acknowledged/i);
  await page.getByTestId("request-convert-project").click();

  const projectId = await page.getByTestId("request-project-id").textContent();
  expect(projectId).toBeTruthy();
  writeFlowState({ projectId: projectId ?? undefined });
  await context.close();
});
