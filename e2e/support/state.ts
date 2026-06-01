import fs from "node:fs";
import path from "node:path";
import { STATE_FILE } from "./constants";

export type FlowState = {
  requestId?: string;
  projectId?: string;
  jobId?: string;
  briefId?: string;
  archiveId?: string;
};

export function readFlowState(): FlowState {
  if (!fs.existsSync(STATE_FILE)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as FlowState;
}

export function writeFlowState(next: FlowState): void {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify({ ...readFlowState(), ...next }, null, 2));
}

export function requireFlowState<K extends keyof FlowState>(key: K): NonNullable<FlowState[K]> {
  const value = readFlowState()[key];
  if (!value) {
    throw new Error(`Missing E2E flow state: ${String(key)}`);
  }
  return value as NonNullable<FlowState[K]>;
}
