import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProgressStream } from "@/hooks/use-progress-stream";
import { queryKeys } from "@/lib/api/query-keys";
import { readRagIndexStatus } from "@/lib/api/projects";
import type { RagIndexStatusResponse } from "@/lib/api/types";

export function ragStatusRefetchInterval(status: string | null | undefined) {
  if (!status) return 5000;
  return status === "ready" || status === "failed" ? false : 5000;
}

function numberFromEvent(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : fallback;
}

function stringFromEvent(value: unknown, fallback: string | null | undefined) {
  return typeof value === "string" ? value : fallback ?? null;
}

function recordFromEvent(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function useRagIndexStatus(projectId: string | null) {
  const progress = useProgressStream(projectId);
  const query = useQuery({
    queryKey: projectId ? queryKeys.ragStatus(projectId) : ["projects", "none", "rag", "status"],
    queryFn: () => readRagIndexStatus(projectId as string),
    enabled: !!projectId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return ragStatusRefetchInterval(status);
    },
  });

  const status = useMemo<RagIndexStatusResponse | null>(() => {
    const event = progress.lastEvent;
    const base = query.data ?? null;
    const payload = recordFromEvent(event?.payload);
    const eventType = event?.type ?? payload.type;
    if (!projectId || eventType !== "rag_index") return base;

    return {
      projectId,
      status: stringFromEvent(payload.status ?? event?.status, base?.status ?? "running") ?? "running",
      readyForAskAi: Boolean(payload.readyForAskAi ?? event?.readyForAskAi ?? base?.readyForAskAi ?? false),
      stale: Boolean(base?.stale ?? false),
      stage: stringFromEvent(payload.stage ?? event?.stage, base?.stage),
      percent: numberFromEvent(payload.percent ?? event?.percent, base?.percent ?? 0),
      message: stringFromEvent(event?.message, base?.message),
      latestJobId: base?.latestJobId ?? null,
      embeddingModel: base?.embeddingModel ?? null,
      embeddingDim: base?.embeddingDim ?? null,
      indexVersion: base?.indexVersion ?? null,
      errorCode: base?.errorCode ?? null,
      updatedAt: base?.updatedAt ?? null,
    };
  }, [progress.lastEvent, projectId, query.data]);

  return { ...query, progressConnected: progress.connected, status };
}
