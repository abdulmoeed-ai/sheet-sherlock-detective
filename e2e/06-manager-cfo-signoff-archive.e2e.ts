import { test, expect } from "@playwright/test";
import { storageFor } from "./support/auth";

test("manager approval, CFO brief gating, signoff, and archive/audit export are visible", async ({ browser }) => {
  const managerContext = await browser.newContext({ storageState: storageFor("manager") });
  const managerPage = await managerContext.newPage();
  await managerPage.goto("/audit", { waitUntil: "networkidle" });
  await managerPage.getByTestId("manager-approve").click();
  await expect(managerPage.getByTestId("review-status")).toContainText(/CFO review|approved/i);
  await managerContext.close();

  const cfoContext = await browser.newContext({ storageState: storageFor("cfo") });
  const cfoPage = await cfoContext.newPage();
  await cfoPage.goto("/audit", { waitUntil: "networkidle" });
  await cfoPage.getByTestId("generate-brief").click();
  const briefStatus = cfoPage.getByTestId("brief-status");
  await expect(briefStatus).toBeVisible();

  if (process.env.GOOGLE_API_KEY) {
    await expect(briefStatus).toContainText(/generated/i);
    await cfoPage.getByTestId("cfo-signoff").click();
    await expect(cfoPage.getByTestId("archive-latest")).toBeVisible();
    await cfoPage.getByTestId("archive-audit-json").click();
  } else {
    await expect(briefStatus).toContainText(/narrative_failed|LLM unavailable/i);
    await expect(cfoPage.getByTestId("cfo-signoff")).toBeDisabled();
  }
  await cfoContext.close();
});
