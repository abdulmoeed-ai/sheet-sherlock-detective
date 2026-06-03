import { useSyncExternalStore } from "react";

const PROJECT_KEY = "sheet_sherlock_selected_project_id";
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function getSelectedProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(PROJECT_KEY);
}

export function setSelectedProjectId(projectId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROJECT_KEY, projectId);
  window.dispatchEvent(new CustomEvent("sheet-sherlock-project-selected", { detail: projectId }));
  emit();
}

export function clearSelectedProjectId(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PROJECT_KEY);
  emit();
}

export function subscribeSelectedProject(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSelectedProjectId(): string | null {
  return useSyncExternalStore(subscribeSelectedProject, getSelectedProjectId, () => null);
}
