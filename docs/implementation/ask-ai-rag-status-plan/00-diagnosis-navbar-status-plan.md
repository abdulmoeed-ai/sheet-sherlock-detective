# Diagnosis RAG Status UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show live PDF RAG indexing readiness on `/diagnosis/$projectId` so users can keep editing the workbook while the background RAG worker prepares Ask AI.

**Architecture:** Add a typed frontend API wrapper for `GET /api/projects/{projectId}/rag/status`, subscribe to existing project progress WebSocket events, and render a compact top-header indicator in the diagnosis route. Ask AI stays available for workbook/current finance questions and receives a clear status warning until PDF RAG is ready.

**Tech Stack:** React, TanStack Query, TanStack Router, existing project progress WebSocket, lucide-react, Vitest.

---

## Backend Dependency

This frontend plan depends on the backend plan:

```text
backend_code/docs/implementation/ask-ai-embeddings-rq-plan/01-production-embedding-and-worker-plan.md
```

Required backend contract:

```http
GET /api/projects/{projectId}/rag/status
```

Response:

```json
{
  "projectId": "project-1",
  "status": "running",
  "readyForAskAi": false,
  "stale": false,
  "stage": "embedding",
  "percent": 35,
  "message": "Preparing Ask AI search index.",
  "latestJobId": "job-1",
  "embeddingModel": "BAAI/bge-base-en-v1.5",
  "embeddingDim": 768,
  "indexVersion": "rag-v1",
  "errorCode": null,
  "updatedAt": "2026-06-06T12:00:00Z"
}
```

Progress WebSocket event:

```json
{
  "type": "rag_index",
  "projectId": "project-1",
  "status": "running",
  "stage": "embedding",
  "percent": 35,
  "message": "Preparing Ask AI search index.",
  "readyForAskAi": false
}
```

## Files And Responsibilities

- Modify `src/lib/api/types.ts`: add `RagIndexStatusResponse`.
- Modify `src/lib/api/projects.ts`: add `readRagIndexStatus(projectId)`.
- Modify `src/lib/api/query-keys.ts`: add `ragStatus(projectId)`.
- Create `src/hooks/use-rag-index-status.ts`: combine status query with progress stream updates.
- Create `src/components/RagIndexStatusIndicator.tsx`: compact accessible status indicator.
- Modify `src/routes/diagnosis.$projectId.tsx`: render indicator in the diagnosis route header/navbar area.
- Add tests for formatter/hook logic.

## User-Confirmed Behavior

- Indicator location: top route header on `/diagnosis/$projectId`.
- Ask AI remains enabled while PDF search is building.
- Visible label must not show the embedding model name.
- Detailed tooltip may say PDF search is still indexing, but should not expose backend document ids.

## UI States

| Status | Label | Icon | Behavior |
| --- | --- | --- | --- |
| `not_indexed` | Ask AI PDF search not ready | info/search | muted |
| `queued` | Preparing Ask AI PDF search | loader | animated |
| `running` | Preparing Ask AI PDF search | loader | animated with percent |
| `ready` | Ask AI PDF search ready | check | success |
| `stale` | Ask AI PDF search updating | refresh | warning |
| `failed` | Ask AI PDF search failed | alert | error |

Keep the label short. Put detailed text in a tooltip/popover. Do not show `embeddingModel`, `embeddingDim`, `latestJobId`, or backend document ids in visible user-facing text.

## Task 1: Add API Types And Wrapper

**Files:**
- Modify: `sheet-sherlock-detective/src/lib/api/types.ts`
- Modify: `sheet-sherlock-detective/src/lib/api/projects.ts`
- Modify: `sheet-sherlock-detective/src/lib/api/query-keys.ts`

- [ ] **Step 1: Add type**

```ts
export interface RagIndexStatusResponse {
  projectId: string;
  status: "not_indexed" | "queued" | "running" | "ready" | "stale" | "failed" | string;
  readyForAskAi: boolean;
  stale: boolean;
  stage?: string | null;
  percent: number;
  message?: string | null;
  latestJobId?: string | null;
  embeddingModel?: string | null;
  embeddingDim?: number | null;
  indexVersion?: string | null;
  errorCode?: string | null;
  updatedAt?: string | null;
}
```

- [ ] **Step 2: Add API function**

In `projects.ts`:

```ts
export function readRagIndexStatus(projectId: string) {
  return apiFetch<RagIndexStatusResponse>(`/api/projects/${projectId}/rag/status`);
}
```

- [ ] **Step 3: Add query key**

In `query-keys.ts`:

```ts
ragStatus: (projectId: string) => ["projects", projectId, "rag", "status"] as const,
```

## Task 2: Add Status Hook

**Files:**
- Create: `sheet-sherlock-detective/src/hooks/use-rag-index-status.ts`
- Test: `sheet-sherlock-detective/src/hooks/use-rag-index-status.test.tsx`

- [ ] **Step 1: Implement hook**

```ts
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { readRagIndexStatus } from "@/lib/api/projects";
import type { RagIndexStatusResponse } from "@/lib/api/types";
import { useProgressStream } from "@/hooks/use-progress-stream";

export function useRagIndexStatus(projectId: string | null) {
  const progress = useProgressStream(projectId);
  const query = useQuery({
    queryKey: projectId ? queryKeys.ragStatus(projectId) : ["projects", "none", "rag", "status"],
    queryFn: () => readRagIndexStatus(projectId as string),
    enabled: !!projectId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "running" || status === "queued" ? 5000 : false;
    },
  });

  const liveStatus = useMemo<RagIndexStatusResponse | null>(() => {
    const event = progress.lastEvent;
    if (event?.type !== "rag_index" || !projectId) return query.data ?? null;
    return {
      projectId,
      status: String(event.status ?? query.data?.status ?? "running"),
      readyForAskAi: Boolean(event.readyForAskAi ?? query.data?.readyForAskAi ?? false),
      stale: Boolean(query.data?.stale ?? false),
      stage: typeof event.stage === "string" ? event.stage : query.data?.stage ?? null,
      percent: Number(event.percent ?? query.data?.percent ?? 0),
      message: typeof event.message === "string" ? event.message : query.data?.message ?? null,
      latestJobId: query.data?.latestJobId ?? null,
      embeddingModel: query.data?.embeddingModel ?? null,
      embeddingDim: query.data?.embeddingDim ?? null,
      indexVersion: query.data?.indexVersion ?? null,
      errorCode: query.data?.errorCode ?? null,
      updatedAt: query.data?.updatedAt ?? null,
    };
  }, [progress.lastEvent, projectId, query.data]);

  return { ...query, progressConnected: progress.connected, status: liveStatus };
}
```

## Task 3: Add Indicator Component

**Files:**
- Create: `sheet-sherlock-detective/src/components/RagIndexStatusIndicator.tsx`
- Test: `sheet-sherlock-detective/src/components/RagIndexStatusIndicator.test.tsx`

- [ ] **Step 1: Implement formatter**

```ts
export function ragIndexStatusLabel(status: RagIndexStatusResponse | null): string {
  if (!status) return "Ask AI PDF search status unavailable";
  if (status.readyForAskAi) return "Ask AI PDF search ready";
  if (status.status === "running" || status.status === "queued") {
    return `Preparing Ask AI PDF search${status.percent ? ` (${status.percent}%)` : ""}`;
  }
  if (status.status === "failed") return "Ask AI PDF search failed";
  if (status.stale) return "Ask AI PDF search updating";
  return "Ask AI PDF search not ready";
}
```

- [ ] **Step 2: Render compact component**

Use lucide icons: `CheckCircle2`, `Loader2`, `AlertTriangle`, `Search`. Use an `IconTooltip` so the route header stays compact.

## Task 4: Render On Diagnosis Route

**Files:**
- Modify: `sheet-sherlock-detective/src/routes/diagnosis.$projectId.tsx`

- [ ] **Step 1: Import hook and component**

```ts
import { RagIndexStatusIndicator } from "@/components/RagIndexStatusIndicator";
import { useRagIndexStatus } from "@/hooks/use-rag-index-status";
```

- [ ] **Step 2: Use hook**

```ts
const ragStatus = useRagIndexStatus(projectId);
```

- [ ] **Step 3: Place in route header**

Render in the top route header near existing diagnosis header actions:

```tsx
<RagIndexStatusIndicator status={ragStatus.status} loading={ragStatus.isLoading} />
```

Do not block workbook editing, draft save, export, comments, or navigation based on this status.

## Task 5: Verification

- [ ] **Step 1: Run frontend tests**

```bash
cd sheet-sherlock-detective
bun test src/components/RagIndexStatusIndicator.test.tsx src/hooks/use-rag-index-status.test.tsx
```

- [ ] **Step 2: Run build**

```bash
cd sheet-sherlock-detective
bun run build
```

- [ ] **Step 3: Manual check**

Start backend, extraction worker, RAG worker, Chroma, and frontend. Upload/extract a sample PDF, route to diagnosis immediately, and verify the indicator transitions:

```text
not_indexed -> queued -> running -> ready
```

If the RAG worker is stopped, verify the UI does not break and shows a useful warning.
