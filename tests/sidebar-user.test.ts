import { describe, expect, it } from "bun:test";
import { getRoleLabel, getUserInitials } from "../src/lib/sidebar-user";

describe("sidebar user display", () => {
  it("derives initials from the authenticated user's real name", () => {
    expect(getUserInitials("Dev Finance Analyst")).toBe("DF");
    expect(getUserInitials(" Sara ")).toBe("S");
  });

  it("uses the product role label for authenticated users", () => {
    expect(getRoleLabel("finance_analyst")).toBe("Finance Analyst");
    expect(getRoleLabel("cfo")).toBe("CFO / Finance Director");
  });
});
