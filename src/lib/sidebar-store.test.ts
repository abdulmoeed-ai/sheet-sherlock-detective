import { afterEach, describe, expect, it } from "vitest";
import { sidebarStore } from "./sidebar-store";

describe("sidebar-store", () => {
  afterEach(() => {
    sidebarStore.setCollapsed(false);
    window.localStorage.clear();
  });

  it("can force the sidebar into collapsed state", () => {
    sidebarStore.setCollapsed(true);

    expect(sidebarStore.get()).toBe(true);
    expect(window.localStorage.getItem("sb-collapsed")).toBe("1");
  });

  it("does not notify subscribers when the collapsed state is unchanged", () => {
    let calls = 0;
    const unsubscribe = sidebarStore.subscribe(() => {
      calls += 1;
    });

    sidebarStore.setCollapsed(false);

    expect(calls).toBe(0);
    unsubscribe();
  });
});
