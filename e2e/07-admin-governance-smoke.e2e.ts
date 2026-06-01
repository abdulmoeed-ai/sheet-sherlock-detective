import { test, expect } from "@playwright/test";
import { storageFor } from "./support/auth";

test("admin mapping-rule toggle marks analyst acknowledgement stale", async ({ browser }) => {
  test.skip(!process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD, "Admin login is seeded outside self-service registration.");

  const context = await browser.newContext({ storageState: storageFor("admin") });
  const page = await context.newPage();
  await page.goto("/ingestion", { waitUntil: "networkidle" });
  await page.getByTestId("admin-governance-panel").click();
  await page.getByTestId("mapping-rule-toggle").first().click();
  await expect(page.getByTestId("mapping-rules-stale")).toBeVisible();
  await context.close();
});
