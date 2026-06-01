# Ask AI Dynamic Prediction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the canned Ask AI prediction and generic fallback answers so every response uses project-aware backend Ask AI, forecast, or a clear no-project state.

**Architecture:** Keep the existing Ask AI SSE path as the default for project questions. The SSE client already sends chat/session and active screen context. For forecast/prediction intents, call the backend forecast endpoint and render a forecast response bubble from returned scenarios and citations. When no project is active, prompt the user to open or create a project instead of returning static Millat answers.

**Tech Stack:** React, FastAPI Ask AI SSE, forecast endpoint, session/route/screen context, Bun tests, pytest.

---

## Hardcoded Evidence

- `src/components/AskAiTrigger.tsx:41` defines fixed suggestions with Millat-specific prompt text.
- `src/components/AskAiTrigger.tsx:78` routes forecast/prediction text away from backend.
- `src/components/AskAiTrigger.tsx:127` returns canned fallback answers when no `projectId` exists.
- `src/components/AskAiTrigger.tsx:184` defines fake prediction progress steps.
- `src/components/AskAiTrigger.tsx:324` renders a fixed forecast confirmation card.
- `src/components/AskAiTrigger.tsx:363` renders static projected CAGR and PKR values.
- `src/components/AskAiTrigger.tsx:609` renders a static mini forecast chart.
- `src/components/AskAiTrigger.tsx:96` now streams normal project questions through backend Ask AI with `sessionId`, route/screen, and cycle filters, so the remaining gap is forecast/no-project behavior rather than the generic SSE path.
- `src/lib/api/projects.ts:56` and `src/lib/api/projects.ts:210` already support streaming Ask AI with `sessionId`, `routePath`, `screenName`, `documentIds`, and `filters`.

## Backend Current State

- `POST /api/projects/{project_id}/ask-ai` streams status/source/approach/token/final events and accepts `sessionId`, `routePath`, `screenName`, `documentIds`, and `filters`.
- `POST /api/projects/{project_id}/forecast/run` returns forecast scenarios and assumptions.
- Backend Ask AI context already has session, route, screen, selected-document, and filter fields in `AskAiRequest`.

## Already Implemented Baseline

- [x] `streamProjectAi` accepts and serializes `sessionId`, `routePath`, `screenName`, `documentIds`, and `filters`.
- [x] `AskAiTrigger` passes a stable chat session id plus current route/screen and cycle filters for normal project Ask AI questions.
- [x] `AskAiTrigger` renders streamed status/source/approach/token/final events and source cards for normal Ask AI responses.
- [x] `tests/projects-api.test.ts` covers the enriched Ask AI streaming request payload.

Do not redo this baseline when implementing the remaining tasks. The remaining work is replacing the forecast/prediction branch and the no-project canned fallback.

## Files

- Modify: `sheet-sherlock-detective/src/components/AskAiTrigger.tsx`
- Modify: `sheet-sherlock-detective/src/lib/api/projects.ts` only if the forecast response type or request options need refinement.
- Test: `sheet-sherlock-detective/tests/projects-api.test.ts`
- Optional backend test: `backend_code/backend/tests/unit/test_ask_ai_gateway_streaming.py`

### Task 1: Add Forecast Bubble Type

- [ ] **Step 1: Update message union**

In `AskAiTrigger.tsx`, replace `| { id: string; role: "ai"; kind: "prediction" };` with:

```ts
| { id: string; role: "ai"; kind: "forecast"; forecast: ForecastRunResponse };
```

Import `runProjectForecast` and `ForecastRunResponse`.

- [ ] **Step 2: Add project-required message**

Add helper:

```ts
function projectRequiredMessage(routePath: string): Msg {
  return {
    id: `a-${Date.now()}`,
    role: "ai",
    kind: "text",
    text: `Open or create a project before asking project-specific questions. Current screen: ${screenNameForPath(routePath)}.`,
  };
}
```

### Task 2: Replace Prediction Branch With Backend Forecast

- [ ] **Step 1: Rewrite forecast intent branch**

Replace lines around the current prediction flow:

```ts
if (/financial strength|next 5 years|predict|forecast/i.test(text)) {
  if (!cycle.projectId) {
    setMessages((m) => [...m, projectRequiredMessage(routePath)]);
    return;
  }
  setAsking(true);
  try {
    const forecast = await runProjectForecast(cycle.projectId, {
      query: `${text} Current screen: ${screenNameForPath(routePath)} (${routePath}).`,
      projectionYears: 5,
    });
    setMessages((m) => [...m, { id: `f-${Date.now()}`, role: "ai", kind: "forecast", forecast }]);
  } catch (error) {
    setMessages((m) => [
      ...m,
      { id: `a-${Date.now()}`, role: "ai", kind: "text", text: error instanceof Error ? error.message : "Could not run forecast." },
    ]);
  } finally {
    setAsking(false);
  }
  return;
}
```

- [ ] **Step 2: Remove generic static fallback**

Replace the fallback after `if (cycle.projectId)` with:

```ts
setMessages((m) => [...m, projectRequiredMessage(routePath)]);
```

No canned balance-sheet or assumptions answer should remain.

### Task 3: Render Forecast Response From Backend

- [ ] **Step 1: Replace prediction renderer**

Replace `m.kind === "prediction"` block with:

```tsx
if (m.kind === "forecast") {
  return <ForecastAiBubble key={m.id} forecast={m.forecast} onOpenForecast={() => { setOpen(false); navigate({ to: "/forecast" }); }} />;
}
```

- [ ] **Step 2: Add backend-driven component**

Add:

```tsx
function ForecastAiBubble({ forecast, onOpenForecast }: { forecast: ForecastRunResponse; onOpenForecast: () => void }) {
  const base = forecast.scenarios.find((scenario) => scenario.id === "base") ?? forecast.scenarios[0];
  const last = base?.points.at(-1);
  return (
    <AiBubble>
      <p className="text-[13px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
        {forecast.companyName} forecast completed from backend sources. Base case final-year revenue is{" "}
        <b>{last ? `PKR ${last.revenue.toFixed(1)}` : "not available"}</b>.
      </p>
      <MiniForecastChart scenarios={forecast.scenarios} />
      <div className="mt-2 space-y-1">
        {forecast.assumptions.slice(0, 3).map((assumption, index) => (
          <div key={index} className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
            {String(assumption.driver ?? "Driver")}: {String(assumption.value ?? "")}
          </div>
        ))}
      </div>
      {forecast.warnings.length > 0 && (
        <div className="mt-2 rounded-md px-2.5 py-1.5 text-[12px]" style={{ background: "#FFFBEB", color: "var(--color-warning-fg)" }}>
          {forecast.warnings.join(" · ")}
        </div>
      )}
      <button onClick={onOpenForecast} className="mt-3 w-full rounded-md border px-3 py-2 text-[12px] font-semibold">
        Open forecast
      </button>
    </AiBubble>
  );
}
```

Change `MiniChart` into `MiniForecastChart({ scenarios })` and draw paths from `scenario.points`.

### Task 4: Make Suggestions Context-Aware

- [ ] **Step 1: Replace fixed suggestions**

Use:

```ts
const suggestions = cycle.projectId
  ? [
      `Analyse ${cycle.company}'s financial strength for the next 5 years`,
      "Why does this model have balance-sheet issues?",
      `What assumptions drive ${cycle.period}?`,
    ]
  : ["Open a project to ask project-specific questions", "Create a request for a new analysis cycle"];
```

Render `suggestions` instead of `SUGGESTIONS`.

### Task 5: Run Checks

- [ ] **Step 1: Frontend tests/build**

Run: `cd sheet-sherlock-detective && bun test tests/projects-api.test.ts`

Expected: PASS.

Run: `cd sheet-sherlock-detective && bun run build`

Expected: build completes.

- [ ] **Step 2: Backend Ask AI smoke**

Run: `cd backend_code/backend && uv run python -m pytest tests/unit/test_ask_ai_gateway_streaming.py tests/unit/test_ask_ai_context.py tests/unit/test_ask_ai_request_schema.py -q`

Expected: PASS.

### Task 6: Commit

- [ ] **Step 1: Commit**

```bash
cd sheet-sherlock-detective
git add src/components/AskAiTrigger.tsx src/lib/api/projects.ts tests/projects-api.test.ts
git commit -m "feat(ask-ai): route prediction prompts to backend forecast"
```
