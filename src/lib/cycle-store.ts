import { useSyncExternalStore } from "react";

export type CycleStatus =
  | "idle"
  | "ingestion"
  | "diagnosis"
  | "forecast"
  | "assumptions"
  | "review"
  | "approved";

export interface CycleState {
  sector: string;
  company: string;
  period: string;
  status: CycleStatus;
  startedAt: string | null;
  documentIds: string[];
}

const initial: CycleState = {
  sector: "Engineering & Industrials",
  company: "Millat Tractors Limited",
  period: "FY2025",
  status: "idle",
  startedAt: null,
  documentIds: [],
};

let state: CycleState = { ...initial };
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export const cycleStore = {
  get: () => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  startCycle: (input: { sector: string; company: string; period: string }) => {
    state = {
      ...input,
      status: "ingestion",
      startedAt: new Date().toISOString(),
      documentIds: [],
    };
    emit();
  },
  addDocumentId: (documentId: string) => {
    const normalized = documentId.trim();
    if (!normalized || state.documentIds.includes(normalized)) return;
    state = { ...state, documentIds: [...state.documentIds, normalized] };
    emit();
  },
  setDocumentIds: (documentIds: string[]) => {
    const normalized = Array.from(new Set(documentIds.map((id) => id.trim()).filter(Boolean)));
    state = { ...state, documentIds: normalized };
    emit();
  },
  setStatus: (status: CycleStatus) => {
    state = { ...state, status };
    emit();
  },
  reset: () => {
    state = { ...initial };
    emit();
  },
};

export function useCycle(): CycleState {
  return useSyncExternalStore(cycleStore.subscribe, cycleStore.get, cycleStore.get);
}

export const CYCLE_STEPS: { key: CycleStatus; label: string; to: string }[] = [
  { key: "ingestion", label: "Ingestion", to: "/ingestion" },
  { key: "diagnosis", label: "Diagnosis", to: "/diagnosis" },
  { key: "forecast", label: "Forecast", to: "/forecast" },
  { key: "assumptions", label: "Assumptions", to: "/assumptions" },
  { key: "review", label: "Review", to: "/audit" },
];

export function stepIndex(status: CycleStatus): number {
  if (status === "idle") return -1;
  if (status === "approved") return CYCLE_STEPS.length;
  return CYCLE_STEPS.findIndex((s) => s.key === status);
}
