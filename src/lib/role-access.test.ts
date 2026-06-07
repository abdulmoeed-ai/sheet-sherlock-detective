import { describe, expect, it } from "vitest";
import { backendRole, canSeeRoute, defaultRouteForRole, frontendRole } from "./role-access";

describe("role access", () => {
  it("maps frontend roles to backend role values", () => {
    expect(backendRole("manager")).toBe("finance_manager");
    expect(backendRole("analyst")).toBe("finance_analyst");
    expect(backendRole("cfo")).toBe("cfo");
    expect(frontendRole("finance_manager")).toBe("manager");
    expect(frontendRole("finance_analyst")).toBe("analyst");
    expect(frontendRole("cfo")).toBe("cfo");
    expect(frontendRole("admin")).toBe("admin");
  });

  it("routes each role to its default workflow", () => {
    expect(defaultRouteForRole("finance_manager")).toBe("/");
    expect(defaultRouteForRole("finance_analyst")).toBe("/inbox");
    expect(defaultRouteForRole("cfo")).toBe("/");
    expect(defaultRouteForRole("admin")).toBe("/sources");
  });

  it("filters role-specific routes", () => {
    expect(canSeeRoute("finance_analyst", "/review")).toBe(false);
    expect(canSeeRoute("finance_manager", "/ingestion")).toBe(false);
    expect(canSeeRoute("finance_manager", "/review")).toBe(true);
    expect(canSeeRoute("finance_analyst", "/diagnosis")).toBe(false);
    expect(canSeeRoute("finance_analyst", "/diagnosis/project-1")).toBe(true);
    expect(canSeeRoute("finance_manager", "/diagnosis/project-1")).toBe(true);
    expect(canSeeRoute("cfo", "/sign-off")).toBe(false);
    expect(canSeeRoute("cfo", "/ingestion")).toBe(false);
    expect(canSeeRoute("admin", "/sources")).toBe(true);
    expect(canSeeRoute("admin", "/assumptions")).toBe(false);
  });
});
