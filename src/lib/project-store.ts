import { useSyncExternalStore } from "react";

const STORAGE_KEY = "sheet_sherlock_selected_project_id";
const listeners = new Set<() => void>();
let selectedProjectId: string | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

export function getSelectedProjectId(): string | null {
  if (selectedProjectId === null) {
    selectedProjectId = readStoredProjectId();
  }
  return selectedProjectId;
}

export function setSelectedProjectId(projectId: string): void {
  selectedProjectId = projectId;
  writeStoredProjectId(projectId);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("sheet-sherlock-project-selected", { detail: projectId }));
  }
  emit();
}

export function clearSelectedProjectId(): void {
  selectedProjectId = null;
  clearStoredProjectId();
  emit();
}

export function subscribeSelectedProject(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSelectedProjectId(): string | null {
  return useSyncExternalStore(subscribeSelectedProject, getSelectedProjectId, () => null);
}

function readStoredProjectId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value?.trim() || null;
  } catch {
    return null;
  }
}

function writeStoredProjectId(projectId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, projectId);
  } catch {
    // The in-memory store still lets the current session continue when storage is unavailable.
  }
}

function clearStoredProjectId(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures; clearing the in-memory value is the important state change.
  }
}
