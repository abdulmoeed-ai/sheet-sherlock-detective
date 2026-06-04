import { afterEach, describe, expect, it } from "vitest";
import { clearSelectedProjectId, getSelectedProjectId, setSelectedProjectId } from "./project-store";

describe("project-store", () => {
  afterEach(() => {
    clearSelectedProjectId();
    window.localStorage.clear();
  });

  it("persists the selected project so ingestion can recover after reload", () => {
    setSelectedProjectId("project-1");

    expect(getSelectedProjectId()).toBe("project-1");
    expect(window.localStorage.getItem("sheet_sherlock_selected_project_id")).toBe("project-1");
  });

  it("restores the selected project id from localStorage", () => {
    window.localStorage.setItem("sheet_sherlock_selected_project_id", "project-2");

    expect(getSelectedProjectId()).toBe("project-2");
  });

  it("clears the persisted selected project id", () => {
    setSelectedProjectId("project-1");
    clearSelectedProjectId();

    expect(getSelectedProjectId()).toBeNull();
    expect(window.localStorage.getItem("sheet_sherlock_selected_project_id")).toBeNull();
  });
});
