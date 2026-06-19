import { describe, expect, it } from "vitest";
import { projectOpenTarget } from "./project-navigation";

describe("project open navigation", () => {
  it("opens submitted manager-review workbooks in diagnosis for manager approval", () => {
    expect(projectOpenTarget({ role: "finance_manager", status: "manager_review" })).toBe(
      "diagnosis",
    );
  });

  it("keeps analyst submitted workbooks on diagnosis", () => {
    expect(projectOpenTarget({ role: "finance_analyst", status: "manager_review" })).toBe(
      "diagnosis",
    );
  });

  it("routes upload/extraction statuses to ingestion", () => {
    expect(projectOpenTarget({ role: "finance_analyst", status: "documents_uploaded" })).toBe(
      "ingestion",
    );
    expect(projectOpenTarget({ role: "finance_manager", status: "extraction_failed" })).toBe(
      "ingestion",
    );
  });
});
