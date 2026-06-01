import { test, expect } from "@playwright/test";
import { storageFor } from "./support/auth";

test("analyst reviews diffs, opens source metadata, and accepts diagnosis proposal", async ({ browser }) => {
  const context = await browser.newContext({ storageState: storageFor("analyst") });
  const page = await context.newPage();
  await page.goto("/diff-review", { waitUntil: "networkidle" });
  await expect(page.getByTestId("diff-review-page")).toBeVisible();
  await expect(page.getByTestId("diff-row-BS-F18")).toContainText(/p\./);
  await page.getByTestId("source-chip-BS-F18").click();
  await expect(page.getByTestId("source-preview-panel")).toBeVisible();

  for (const testId of ["diff-approve-D14", "diff-approve-D22"]) {
    await page.getByTestId(testId).click();
  }
  for (const cell of ["F18", "D42"]) {
    await page.getByTestId(`diff-justify-${cell}`).click();
    await page.getByTestId(`diff-justification-${cell}`).fill(`Accepted source-backed variance for ${cell}`);
    await page.getByTestId(`diff-submit-${cell}`).click();
  }
  await page.getByTestId("apply-to-model").click();

  await expect(page).toHaveURL(/\/diagnosis/);
  await expect(page.getByTestId("diagnosis-page")).toBeVisible();
  await expect(page.getByTestId("diagnosis-candidate")).toContainText(/BS!D42|Inventory/);
  await expect(page.getByTestId("diagnosis-classification")).toContainText(/equity|loan|debit|journal|unknown/i);
  await page.getByTestId("diagnosis-accept").click();
  await expect(page.getByTestId("diagnosis-status")).toContainText(/all clear|ready/i);
  await context.close();
});
