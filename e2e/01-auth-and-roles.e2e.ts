import { test, expect } from "@playwright/test";
import { loginExisting, registerAndLogin } from "./support/api";
import { storageFor, writeRoleStorage } from "./support/auth";

test("registers and logs in Finance Manager, Finance Analyst, CFO, and Admin sessions", async ({ request, browser }) => {
  const manager = await registerAndLogin(request, { role: "finance_manager", name: "E2E Finance Manager" });
  const analyst = await registerAndLogin(request, { role: "finance_analyst", name: "E2E Finance Analyst" });
  const cfo = await registerAndLogin(request, { role: "cfo", name: "E2E CFO" });

  writeRoleStorage("manager", manager);
  writeRoleStorage("analyst", analyst);
  writeRoleStorage("cfo", cfo);

  if (process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD) {
    const admin = await loginExisting(request, {
      email: process.env.E2E_ADMIN_EMAIL,
      password: process.env.E2E_ADMIN_PASSWORD,
    });
    writeRoleStorage("admin", admin);
  }

  for (const [role, label] of [
    ["manager", "Finance Manager"],
    ["analyst", "Finance Analyst"],
    ["cfo", "CFO / Finance Director"],
  ] as const) {
    const context = await browser.newContext({ storageState: storageFor(role) });
    const page = await context.newPage();
    await page.goto("/audit");
    await expect(page.getByText(label).first()).toBeVisible();
    await context.close();
  }
});
