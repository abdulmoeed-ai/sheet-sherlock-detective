import path from "node:path";
import { test, expect } from "@playwright/test";
import { storageFor } from "./support/auth";
import { MILLAT_PDF } from "./support/constants";

test("analyst uploads Millat PDF, acknowledges mapping rules, and sees source preview", async ({ browser }) => {
  const context = await browser.newContext({ storageState: storageFor("analyst") });
  const page = await context.newPage();
  await page.goto("/ingestion", { waitUntil: "networkidle" });
  await page.getByTestId("upload-input").setInputFiles(path.resolve(MILLAT_PDF));
  await expect(page.getByTestId("uploaded-file")).toContainText("Millat - 2025.pdf");

  await page.getByTestId("start-ingestion").click();
  await expect(page.getByTestId("mapping-rules-modal")).toBeVisible();
  await expect(page.getByTestId("mapping-rules-summary")).toContainText(/40|enabled/i);
  await page.getByTestId("mapping-rules-acknowledge").click();

  await expect(page.getByTestId("ingestion-live-feed")).toBeVisible();
  await expect(page.getByTestId("source-preview-card").first()).toBeVisible();
  await page.getByTestId("source-preview-card").first().click();
  await expect(page.getByTestId("extracted-field-breakdown").first()).toBeVisible();
  await context.close();
});
