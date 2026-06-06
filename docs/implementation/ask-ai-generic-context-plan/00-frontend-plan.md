# Ask AI Generic Context Frontend Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure the frontend sends only real Ask AI context, hides non-actionable warnings, supports model-candidate selection, and renders web citations as clickable links.

**Architecture:** Keep `AskAiTrigger.tsx` as the chat surface, but move request-building and warning/citation display rules into small testable helpers under `src/lib`. Use the existing project-scoped Ask AI endpoint; do not add a new global chat endpoint. Use the existing `useProjects()` and project APIs to search uploaded models owned by the user plus models assigned through Inbox before streaming to a project-scoped Ask AI endpoint.

**Tech Stack:** React, TanStack Router, TanStack Query, Vitest/jsdom, existing SSE parser and markdown renderer.

---

## Files

- Modify: `sheet-sherlock-detective/src/components/AskAiTrigger.tsx`
- Modify: `sheet-sherlock-detective/src/lib/ask-ai-context.ts`
- Modify: `sheet-sherlock-detective/src/lib/ask-ai-warnings.ts`
- Modify: `sheet-sherlock-detective/src/lib/ask-ai-citations.ts`
- Modify: `sheet-sherlock-detective/src/components/MarkdownContent.tsx`
- Modify: `sheet-sherlock-detective/src/lib/api/projects.ts`
- Modify: `sheet-sherlock-detective/src/lib/api/types.ts`
- Create: `sheet-sherlock-detective/src/lib/ask-ai-request.ts`
- Create: `sheet-sherlock-detective/src/lib/ask-ai-model-selection.ts`
- Test: `sheet-sherlock-detective/src/lib/ask-ai-context.test.ts`
- Test: `sheet-sherlock-detective/src/lib/ask-ai-warnings.test.ts`
- Test: `sheet-sherlock-detective/src/lib/ask-ai-citations.test.ts`
- Test: `sheet-sherlock-detective/src/lib/ask-ai-request.test.ts`
- Test: `sheet-sherlock-detective/src/lib/ask-ai-model-selection.test.ts`

## Task 1: Request Payload Hygiene

- [ ] **Step 1: Write failing test**

Create `sheet-sherlock-detective/src/lib/ask-ai-request.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildAskAiRequestPayload } from "./ask-ai-request";

describe("buildAskAiRequestPayload", () => {
  it("does not send stale company or period filters when no project context is loaded", () => {
    expect(
      buildAskAiRequestPayload({
        question: "Hi",
        sessionId: "chat-1",
        routePath: "/inbox",
        screenName: "Inbox",
        workspace: undefined,
        activeSession: null,
        includeExternalSources: false,
      }),
    ).toEqual({
      question: "Hi",
      sessionId: "chat-1",
      routePath: "/inbox",
      screenName: "Inbox",
      documentIds: [],
      filters: {},
      includeExternalSources: false,
    });
  });
});
```

- [ ] **Step 2: Verify it fails**

Run:

```bash
cd sheet-sherlock-detective
bun run test src/lib/ask-ai-request.test.ts
```

Expected: import failure.

- [ ] **Step 3: Implement helper**

Create `sheet-sherlock-detective/src/lib/ask-ai-request.ts`:

```ts
import type { AskAiChatSessionSummary, WorkspaceResponse } from "@/lib/api/types";

type Input = {
  question: string;
  sessionId: string;
  routePath: string;
  screenName: string;
  workspace: WorkspaceResponse | undefined;
  activeSession: AskAiChatSessionSummary | null;
  includeExternalSources: boolean;
};

export function buildAskAiRequestPayload(input: Input) {
  const project = input.workspace?.project;
  const documentIds = input.workspace?.documents.map((document) => document.id) ?? [];
  const company = input.activeSession?.companyName ?? project?.companyName;
  const period = input.activeSession?.projectLabel ?? project?.fiscalYear;

  return {
    question: input.question,
    sessionId: input.sessionId,
    routePath: input.routePath,
    screenName: input.screenName,
    documentIds,
    filters: {
      ...(period ? { period } : {}),
      ...(company ? { company } : {}),
    },
    includeExternalSources: input.includeExternalSources,
  };
}
```

- [ ] **Step 4: Wire `AskAiTrigger.tsx`**

Replace the inline payload object in `send(...)` with:

```ts
const requestPayload = buildAskAiRequestPayload({
  question: text,
  sessionId: chatSessionIdRef.current,
  routePath: activeRoutePath,
  screenName: activeScreenName,
  workspace: workspace.data,
  activeSession,
  includeExternalSources: shouldUseExternalSources(text),
});

const final = await askAi.sendQuestion(requestPayload, callbacks);
```

- [ ] **Step 5: Verify**

Run:

```bash
cd sheet-sherlock-detective
bun run test src/lib/ask-ai-request.test.ts src/lib/ask-ai-context.test.ts
```

Expected: pass.

## Task 2: Warning Display Rules

- [ ] **Step 1: Write failing warning test**

Extend `sheet-sherlock-detective/src/lib/ask-ai-warnings.test.ts`:

```ts
it("hides PDF readiness warnings for generic no-context answers", () => {
  expect(
    userFacingAskAiWarnings(["rag_index_not_ready"], {
      requestMode: "general_finance",
      hasCitations: false,
    }),
  ).toEqual([]);
});

it("shows partial-context status when PDFs are pending but workbook answers can continue", () => {
  expect(
    userFacingAskAiWarnings(["rag_index_building"], {
      requestMode: "partial_project_context",
      hasCitations: false,
    }),
  ).toEqual([]);
});
```

- [ ] **Step 2: Verify it fails**

Run:

```bash
cd sheet-sherlock-detective
bun run test src/lib/ask-ai-warnings.test.ts
```

Expected: signature mismatch or old warning text failure.

- [ ] **Step 3: Update warning helper**

Modify `sheet-sherlock-detective/src/lib/ask-ai-warnings.ts`:

```ts
type WarningContext = {
  requestMode?: string | null;
  hasCitations?: boolean;
};

export function userFacingAskAiWarnings(
  warnings: string[] | undefined,
  context: WarningContext = {},
): string[] {
  if (context.requestMode === "general_finance") return [];
  const labels = (warnings ?? [])
    .map((warning) => WARNING_LABELS[warning] ?? warning)
    .filter(Boolean);
  return Array.from(new Set(labels));
}
```

Keep `WARNING_LABELS.rag_index_building` available for future explicitly user-actionable warnings, but hide it for `partial_project_context` because the backend will continue answering from workbook data and demand-based external sources. Add this condition:

```ts
if (context.requestMode === "partial_project_context" && !context.hasCitations) return [];
```

- [ ] **Step 4: Pass request mode from final payload**

After backend adds `requestMode` to final responses, update `StreamingAiBubble`:

```ts
const warnings = userFacingAskAiWarnings(message.final?.warnings, {
  requestMode: message.final?.requestMode,
  hasCitations: citations.length > 0,
});
```

- [ ] **Step 5: Verify**

Run:

```bash
cd sheet-sherlock-detective
bun run test src/lib/ask-ai-warnings.test.ts
```

Expected: pass.

## Task 3: Model Candidate Selection

- [ ] **Step 1: Add API types**

Modify `sheet-sherlock-detective/src/lib/api/types.ts`:

```ts
export interface AskAiModelCandidate {
  id: string;
  companyName: string;
  fiscalYear: string | null;
  sector: string | null;
  accessSource: "owned" | "assigned_inbox" | string;
  score: number;
  matchReason: string;
}

export interface AskAiModelSearchResponse {
  candidates: AskAiModelCandidate[];
}
```

- [ ] **Step 2: Add API client**

Modify `sheet-sherlock-detective/src/lib/api/projects.ts`:

```ts
export function searchAskAiModels(query: string) {
  return apiFetch<AskAiModelSearchResponse>("/api/projects/ask-ai/model-search", {
    method: "POST",
    body: { query },
  });
}
```

- [ ] **Step 3: Add selection helper test**

Create `sheet-sherlock-detective/src/lib/ask-ai-model-selection.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { shouldSearchModelsBeforeAskAi } from "./ask-ai-model-selection";

describe("shouldSearchModelsBeforeAskAi", () => {
  it("searches models when the user names a model and no project is active", () => {
    expect(shouldSearchModelsBeforeAskAi("Open Millat FY2025 model", null)).toBe(true);
  });

  it("does not search models for a generic greeting", () => {
    expect(shouldSearchModelsBeforeAskAi("Hi", null)).toBe(false);
  });
});
```

- [ ] **Step 4: Implement selection helper**

Create `sheet-sherlock-detective/src/lib/ask-ai-model-selection.ts`:

```ts
export function shouldSearchModelsBeforeAskAi(question: string, activeProjectId: string | null): boolean {
  if (activeProjectId) return false;
  return /\b(model|workbook|company|fy20\d{2}|financial statement|balance sheet|income statement)\b/i.test(
    question,
  );
}
```

- [ ] **Step 5: Wire chat UX**

In `AskAiTrigger.tsx`, before calling `askAi.sendQuestion(...)`:

1. If `shouldSearchModelsBeforeAskAi(text, activeProjectId)` is true, call `searchAskAiModels(text)`.
2. If one high-confidence candidate is returned, set selected project and stream against that project.
3. If multiple candidates are returned, render an assistant text message that lists the similar model names and asks the user to type the company/model name they want.
4. When the user's next message matches one candidate name or fiscal year strongly enough, set selected project, preserve the original question, and send it using the chosen project.

The disambiguation message should look like:

```text
I found more than one similar financial model:

1. Millat Tractors Limited - FY2025
2. Millat Equipment Limited - FY2024

Please type the company/model name you want me to use.
```

- [ ] **Step 6: Verify**

Run:

```bash
cd sheet-sherlock-detective
bun run test src/lib/ask-ai-model-selection.test.ts
```

Expected: pass.

## Task 3A: Generic Finance Tavily Requests

- [ ] **Step 1: Add request helper test**

Extend `sheet-sherlock-detective/src/lib/ask-ai-request.test.ts`:

```ts
it("requests external sources for generic questions that ask for current facts", () => {
  expect(
    buildAskAiRequestPayload({
      question: "What are current interest rates in Pakistan?",
      sessionId: "chat-1",
      routePath: "/inbox",
      screenName: "Inbox",
      workspace: undefined,
      activeSession: null,
      includeExternalSources: true,
    }).includeExternalSources,
  ).toBe(true);
});
```

- [ ] **Step 2: Update `shouldUseExternalSources` terms**

Keep Tavily off for generic greetings, but return true for questions containing current/external factual terms:

```ts
function shouldUseExternalSources(question: string): boolean {
  return /\b(current|latest|recent|today|market|sector|forecast|outlook|macro|competitor|regulation|rate|price|news|industry)\b/i.test(
    question,
  );
}
```

- [ ] **Step 3: Verify**

Run:

```bash
cd sheet-sherlock-detective
bun run test src/lib/ask-ai-request.test.ts
```

Expected: pass.

## Task 4: Clickable Web Citations

- [ ] **Step 1: Add citation test**

Extend `sheet-sherlock-detective/src/lib/ask-ai-citations.test.ts`:

```ts
it("exposes web citation labels as clickable external links", () => {
  const citation = {
    index: 2,
    kind: "source",
    sourceName: "Pakistan Stock Exchange",
    title: "Market notice",
    url: "https://www.psx.com.pk/example",
  };

  expect(getAskAiCitationPreview(citation)).toEqual({
    type: "external_url",
    url: "https://www.psx.com.pk/example",
    title: "Pakistan Stock Exchange",
  });
});
```

- [ ] **Step 2: Keep markdown links clickable**

Confirm `MarkdownContent` already renders normal markdown links with `target="_blank"` and safe URL checks. If missing, add a test in `MarkdownContent.test.tsx` that renders:

```markdown
[PSX market notice](https://www.psx.com.pk/example)
```

Expected: rendered as an anchor with `href`.

- [ ] **Step 3: Render external citations in footer as links**

In `CitationFooter` or `CitationPill`, if `getAskAiCitationPreview(citation)?.type === "external_url"`, render an anchor-style button that opens the preview sidebar or the URL.

- [ ] **Step 4: Verify frontend tests**

Run:

```bash
cd sheet-sherlock-detective
bun run test src/lib/ask-ai-citations.test.ts src/components/MarkdownContent.test.tsx
```

Expected: pass.

## Task 5: Final Frontend Verification

- [ ] **Step 1: Run focused test suite**

```bash
cd sheet-sherlock-detective
bun run test src/lib/ask-ai-context.test.ts src/lib/ask-ai-request.test.ts src/lib/ask-ai-warnings.test.ts src/lib/ask-ai-citations.test.ts src/lib/ask-ai-model-selection.test.ts src/lib/api/ask-ai-stream.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 2: Run build**

```bash
cd sheet-sherlock-detective
bun run build
```

Expected: exit code 0. Existing Wrangler log-file EROFS warnings may appear in this sandbox but should not fail the build.
