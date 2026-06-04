import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
let selectedProjectId: string | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

export function getSelectedProjectId(): string | null {
  return selectedProjectId;
}

export function setSelectedProjectId(projectId: string): void {
  selectedProjectId = projectId;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("sheet-sherlock-project-selected", { detail: projectId }));
  }
  emit();
}

export function clearSelectedProjectId(): void {
  selectedProjectId = null;
  emit();
}

export function subscribeSelectedProject(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSelectedProjectId(): string | null {
  return useSyncExternalStore(subscribeSelectedProject, getSelectedProjectId, () => null);
}
