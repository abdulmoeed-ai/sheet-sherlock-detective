import { useSyncExternalStore } from "react";

let collapsed = false;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  collapsed = window.localStorage.getItem("sb-collapsed") === "1";
}

export const sidebarStore = {
  get: () => collapsed,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  setCollapsed: (next: boolean) => {
    if (collapsed === next) return;
    collapsed = next;
    if (typeof window !== "undefined") {
      window.localStorage.setItem("sb-collapsed", collapsed ? "1" : "0");
    }
    listeners.forEach((l) => l());
  },
  toggle: () => {
    sidebarStore.setCollapsed(!collapsed);
  },
};

export function useSidebarCollapsed(): boolean {
  return useSyncExternalStore(sidebarStore.subscribe, sidebarStore.get, () => false);
}

export const SIDEBAR_WIDTH = 240;
export const SIDEBAR_COLLAPSED_WIDTH = 72;
