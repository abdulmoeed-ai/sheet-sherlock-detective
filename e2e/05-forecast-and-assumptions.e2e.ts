import { test, expect } from "@playwright/test";
import { storageFor } from "./support/auth";

test("forecast scenario output and assumptions fields are reviewable", async ({ browser }) => {
  const context = await browser.newContext({ storageState: storageFor("analyst") });
  const page = await context.newPage();
  await page.goto("/forecast", { waitUntil: "networkidle" });
  await expect(page.getByTestId("forecast-page")).toBeVisible();
  await page.getByTestId("forecast-scenario-bull").click();
  await expect(page.getByTestId("forecast-scenario-summary")).toContainText("Bull");
  await expect(page.getByTestId("forecast-driver-kibor")).toBeVisible();

  await page.getByTestId("review-assumptions").click();
  await expect(page).toHaveURL(/\/assumptions/);
  await expect(page.getByTestId("assumptions-page")).toBeVisible();
  await expect(page.getByTestId("assumption-row").first()).toContainText(/Source|PAMA|SBP|Confidence|High|Med|Low/i);
  await context.close();
});
