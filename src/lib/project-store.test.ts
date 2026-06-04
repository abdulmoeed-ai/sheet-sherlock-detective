import { afterEach, describe, expect, it } from "vitest";
import { clearSelectedProjectId, getSelectedProjectId, setSelectedProjectId } from "./project-store";

describe("project-store", () => {
  afterEach(() => {
    clearSelectedProjectId();
    window.localStorage.clear();
  });

  it("keeps the selected project in memory without writing localStorage", () => {
    setSelectedProjectId("project-1");

    expect(getSelectedProjectId()).toBe("project-1");
    expect(window.localStorage.getItem("sheet_sherlock_selected_project_id")).toBeNull();
  });

  it("does not restore stale selected project ids from localStorage", () => {
    window.localStorage.setItem("sheet_sherlock_selected_project_id", "stale-project");

    expect(getSelectedProjectId()).toBeNull();
  });
});
