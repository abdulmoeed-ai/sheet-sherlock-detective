# Ask AI Chat Thread Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current static/local Ask AI history UI with backend-backed global user-private past threads that can be listed, loaded, continued with preserved context, renamed, permanently deleted, and refreshed without losing streamed answer behavior.

**Architecture:** Keep `AskAiTrigger.tsx` as the interaction shell, but move API calls and type mapping into focused modules under `src/lib/api` and `src/lib`. Replace `localStorage` history with global backend session queries that return the current user's newest threads across projects. Preserve the existing SSE stream path, active stream ID guard, sidebar-aware expanded layout, citation previews, and Bun-based verification.

**Tech Stack:** React, TanStack Router, existing custom hooks, existing API client in `src/lib/api/projects.ts`, existing SSE parser in `src/lib/api/ask-ai-stream.ts`, Vitest through Bun.

---

## Confirmed Current State

- `src/components/AskAiTrigger.tsx` owns open/expanded state, current messages, localStorage saved chats, stream lifecycle, citation rendering, and history UI.
- Current history state uses `CHAT_STORAGE_KEY = "ask-ai-chat-history"` and `SavedChat[]`.
- `chatSessionIdRef` already sends `sessionId` to the backend.
- `useAskAiStream(projectId)` sends the existing `POST /api/projects/{projectId}/ask-ai` request through `apiStream`.
- There is no frontend API function for listing, loading, renaming, or archiving Ask AI sessions.
- The expanded Ask AI panel already respects sidebar collapse state.

## Implementation Boundary

Do not start implementation until the backend global session endpoints are implemented.

Do not redesign the Ask AI panel. This is an API integration and state-management task, not a landing-page or new UI concept task.

## Product Decisions From `questions-for-user.md`

- Threads persist across browser sessions and devices.
- Threads are private to the creating user.
- History is global across projects and shows 20 threads by default.
- Deleted threads are permanently deleted.
- Titles are auto-generated from the first prompt and can be renamed.
- Continuing a thread uses previous messages as backend LLM context.
- Loaded threads preserve the route/screen context captured with the thread; follow-up prompts continue that preserved context.
- The new implementation must not depend on localStorage. No localStorage migration is planned.
- Assistant history must render with stored citations, previews, warnings, usage metadata, and any saved forecast/source metadata.
- Chat transcripts are not part of project audit exports.
- Only the creator can rename or delete a thread.
- Failed or cancelled requests should leave the user's prompt visible in history after refresh.
- Direct upload-from-chat is out of scope for this feature; Ask AI should keep directing users to the project upload flow and cite documents after backend indexing.

## Frontend Files

- Modify: `src/lib/api/types.ts`
  - Add chat session/message response types.
- Modify: `src/lib/api/projects.ts`
  - Add API functions for sessions.
- Create: `src/lib/ask-ai-threads.ts`
  - Map backend chat messages into `AskAiTrigger` message view models.
- Create: `src/hooks/use-ask-ai-sessions.ts`
  - Encapsulate loading, refreshing, renaming, and deleting sessions.
- Modify: `src/components/AskAiTrigger.tsx`
  - Remove `localStorage` history.
  - Load global backend sessions when the panel opens, even if no project is selected.
  - Load selected thread messages from backend.
  - Continue selected thread with the same `sessionId`.
  - Preserve the loaded thread's project and route/screen context when sending a follow-up.
  - Refresh history after a streamed answer completes.
- Test: `src/lib/ask-ai-threads.test.ts`
- Test: `src/components/AskAiTrigger.test.tsx` or extend the closest existing Ask AI component test if present.

## Task 1: API Types And Client Functions

**Files:**
- Modify: `src/lib/api/types.ts`
- Modify: `src/lib/api/projects.ts`
- Test: `src/lib/api/projects.test.ts` if an API client test file exists; otherwise cover URL construction through hook/component tests.

- [ ] **Step 1: Add types**

Add:

```ts
export type AskAiChatMessageResponse = {
  id: string;
  role: "user" | "assistant" | string;
  content: string;
  routePath: string | null;
  screenName: string | null;
  citations: Array<Record<string, unknown>>;
  warnings: string[];
  usage: Record<string, unknown>;
  retrievalSnapshot: Record<string, unknown>;
  createdAt: string;
};

export type AskAiChatSessionSummary = {
  id: string;
  projectId: string;
  projectLabel: string | null;
  companyName: string | null;
  title: string | null;
  routePath: string | null;
  screenName: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AskAiChatSessionResponse = AskAiChatSessionSummary & {
  messages: AskAiChatMessageResponse[];
};
```

- [ ] **Step 2: Add API functions**

Add to `src/lib/api/projects.ts`:

```ts
export function listAskAiSessions(input: { limit?: number; cursor?: string | null } = {}) {
  const params = new URLSearchParams();
  if (input.limit) params.set("limit", String(input.limit));
  if (input.cursor) params.set("cursor", input.cursor);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<AskAiChatSessionSummary[]>(`/api/ask-ai/sessions${suffix}`);
}

export function readAskAiSession(sessionId: string) {
  return apiFetch<AskAiChatSessionResponse>(
    `/api/ask-ai/sessions/${encodeURIComponent(sessionId)}`,
  );
}

export function renameAskAiSession(sessionId: string, title: string) {
  return apiFetch<AskAiChatSessionSummary>(
    `/api/ask-ai/sessions/${encodeURIComponent(sessionId)}`,
    { method: "PATCH", body: { title } },
  );
}

export function deleteAskAiSession(sessionId: string) {
  return apiFetch<AskAiChatSessionSummary>(
    `/api/ask-ai/sessions/${encodeURIComponent(sessionId)}`,
    { method: "DELETE" },
  );
}
```

## Task 2: Message Mapping Module

**Files:**
- Create: `src/lib/ask-ai-threads.ts`
- Test: `src/lib/ask-ai-threads.test.ts`

- [ ] **Step 1: Write mapper tests**

Cover:

- Backend `role: "user"` maps to a user bubble.
- Backend `role: "assistant"` maps to a final AI text/stream-compatible bubble.
- Citations, retrieval snapshots, warnings, usage metadata, and forecast/source metadata stay attached to the assistant message shape.
- Unknown roles are ignored or mapped only after explicit handling.

- [ ] **Step 2: Implement mapper**

Create functions:

```ts
export function askAiSessionToMessages(session: AskAiChatSessionResponse): Msg[] {
  return session.messages
    .map((message) => {
      if (message.role === "user") {
        return { id: message.id, role: "user" as const, text: message.content };
      }
      if (message.role === "assistant") {
        return {
          id: message.id,
          role: "ai" as const,
          kind: "text" as const,
          text: message.content,
        };
      }
      return null;
    })
    .filter((message): message is Msg => message !== null);
}
```

If `Msg` remains private to `AskAiTrigger.tsx`, first extract the message types into `src/lib/ask-ai-message-types.ts`.

## Task 3: Session Hook

**Files:**
- Create: `src/hooks/use-ask-ai-sessions.ts`
- Test: hook coverage if existing hook test utilities are available; otherwise cover through `AskAiTrigger` tests.

- [ ] **Step 1: Implement hook responsibilities**

The hook should expose:

```ts
{
  sessions,
  loading,
  error,
  refreshSessions,
  loadSession,
  renameSession,
  deleteSession,
}
```

Rules:

- The hook is not project-scoped; it loads the current user's global history.
- Default list limit is 20.
- On load failure, keep the current chat visible and surface a compact error state in history.
- After delete, remove the session from the list and start a new chat if the deleted session is active.

## Task 4: Replace LocalStorage History In `AskAiTrigger.tsx`

**Files:**
- Modify: `src/components/AskAiTrigger.tsx`
- Test: `src/components/AskAiTrigger.test.tsx` or closest existing Ask AI test.

- [ ] **Step 1: Remove localStorage-only state**

Remove:

- `SavedChat`
- `CHAT_STORAGE_KEY`
- `MAX_SAVED_CHATS`
- `savedChats` initializer from `localStorage`
- `saveCurrentChat`

- [ ] **Step 2: Use backend sessions**

Add:

- `const sessionsApi = useAskAiSessions();`
- Refresh sessions when the panel opens and when rename/delete/send completion changes history.
- Render session summaries in `HistoryChatList`.
- Load a session by calling `readAskAiSession`, mapping messages, setting `chatSessionIdRef.current`, and returning to the Chat tab.
- Set the active chat project from the loaded session `projectId`; follow-up requests must post to `/api/projects/{loadedSession.projectId}/ask-ai`.
- Store the loaded thread's `routePath` and `screenName`; follow-up requests must send those preserved values instead of the user's current route.

- [ ] **Step 3: Start new chat without saving local state**

New chat should:

- Clear `messages`.
- Clear `input`.
- Hide history.
- Clear loaded-thread preserved context.
- Generate a new frontend `sessionId` only if the backend still accepts client-provided IDs.
- Otherwise wait for backend-generated `sessionId` from the final response contract.

- [ ] **Step 4: Refresh history after final answer**

After the final SSE response:

- Update the visible assistant bubble exactly as today.
- Refresh session summaries in the background.
- Keep the active stream ID guard; do not abort the backend SSE request from cleanup.

## Task 5: History UI Completion

**Files:**
- Modify: `src/components/AskAiTrigger.tsx`

- [ ] **Step 1: Show real loading and empty states**

History tab states:

- No project selected: still show global history; only sending a brand-new prompt requires a selected project.
- Loading: show compact skeleton rows.
- Empty: show "No Ask AI threads yet."
- Error: show the backend error and a retry button.

- [ ] **Step 2: Add rename/delete controls**

- Rename control calls `renameAskAiSession`.
- Delete control calls `deleteAskAiSession`.
- Use icon buttons with tooltips.
- Make the delete confirmation explicit that deletion is permanent.
- Only show rename/delete actions for sessions owned by the current user; the backend remains the enforcement layer.

## Task 6: Frontend Verification

Run from `sheet-sherlock-detective`:

```bash
bun test src/lib/api/ask-ai-stream.test.ts src/lib/ask-ai-reasoning.test.ts src/lib/ask-ai-input.test.ts
bun test src/lib/ask-ai-threads.test.ts
bun run build
```

Expected:

- Existing stream parser and Ask AI input tests pass.
- New thread mapper tests pass.
- Build exits zero.
- Any Wrangler `EROFS` log-write warning is non-fatal only if the build exits zero.

## Acceptance Criteria

- Past chat list uses backend data, not `localStorage`.
- Past chat list is global across the user's projects and defaults to 20 sessions.
- Clicking a past thread loads its real messages.
- Sending a new prompt while a past thread is open continues the same backend session.
- Sending a prompt in a loaded thread uses the thread's original project, route, and screen context.
- Refreshing the browser keeps threads available after sign-in and project selection.
- Starting a new chat creates a separate session.
- Rename updates the thread title.
- Delete permanently removes the thread from history.
- Failed/cancelled prompts remain visible after refresh.
- Existing streamed answer UI, activity events, citation previews, copy buttons, sidebar-aware expanded width, and no-project fallback still work.

## Known Risks

- If `AskAiTrigger.tsx` keeps all message types private, thread mapping will be hard to test cleanly; extract message types first.
- If the backend final response does not include backend-generated session IDs, frontend-generated IDs must remain for this phase.
- If loaded historical assistant messages need full citation preview behavior, backend messages must persist enough citation metadata to reconstruct previews.
- Global history means a follow-up may target a project different from the currently selected sidebar/project state; the UI must make that project context visible enough to avoid accidental cross-project questions.
