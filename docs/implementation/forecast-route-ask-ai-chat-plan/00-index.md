# Forecast Route Ask AI Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `/forecast` from the current scenario-control page into a dedicated always-expanded Ask AI forecasting chat route, and fix the broken Ask AI close button outside forecast route mode.

**Architecture:** Keep the global Ask AI implementation as the reusable chat surface, but add route-aware behavior so `/forecast` opens the panel automatically in expanded forecast mode, hides close/collapse controls, and does not show the old static forecast page content. Reuse the existing backend forecast route decision, Tavily planning, forecast metadata parsing, and streaming SSE contract rather than building a separate forecast endpoint, while adding approved workbook/project context for route-level forecasting.

**Tech Stack:** React, TanStack Router, TypeScript, Bun tests/build, FastAPI backend, LangGraph-backed Ask AI stream, Gemini, Chroma/RAG, Tavily-approved sources.

---

## Superseded Decision

The older plan in `backend_code/docs/implementation/ask-ai-full-forecasting-plan/` said to keep forecasting inside Ask AI and leave the standalone `/forecast` route untouched. This new plan supersedes that route decision: `/forecast` should now be the dedicated entry point for the expanded Ask AI forecast-chat experience.

## Applied User Decisions

- `/forecast` is always expanded; hide the collapse/shrink icon on this route.
- Hide the Ask AI close button on `/forecast`; users leave via sidebar/navigation.
- Remove the old `/forecast` sector/company/scenario route content.
- Add all approved/accessible projects and Excel workbooks to forecast LLM context when available.
- Auto-enable approved web search on `/forecast`.
- For true sector-only questions, answer from approved external sources; for company/model-specific questions, ask for workbook/company selection when needed.
- Force forecast mode for all `/forecast` prompts and follow-ups while keeping safety and finance-domain guardrails.
- Hide or disable the attachment button on `/forecast` until direct chat upload exists.

## Inputs Reviewed

- `sheet-sherlock-detective/src/routes/forecast.tsx`
- `sheet-sherlock-detective/src/components/AskAiTrigger.tsx`
- `sheet-sherlock-detective/src/lib/ask-ai-context.ts`
- `sheet-sherlock-detective/src/lib/ask-ai-request.ts`
- `backend_code/backend/app/services/ask_ai/graph/runtime.py`
- `backend_code/backend/app/services/ask_ai/graph/router.py`
- `backend_code/backend/app/services/ask_ai/streaming.py`
- `backend_code/backend/app/services/ask_ai/prompts.py`
- `backend_code/backend/app/services/ask_ai/response_builder.py`
- `backend_code/backend/app/services/ask_ai/forecast_payload.py`
- `backend_code/sample_docs/Qualitative Takeaways.pdf`
- `backend_code/chatgpt_chat.json`

## Plan Files

1. [01-current-state-and-product-spec.md](01-current-state-and-product-spec.md)
2. [02-frontend-implementation-plan.md](02-frontend-implementation-plan.md)
3. [03-close-chat-fix-plan.md](03-close-chat-fix-plan.md)
4. Backend companion: `backend_code/docs/implementation/forecast-route-ask-ai-chat-plan/01-backend-contract-and-verification.md`
5. [questions-for-user.md](questions-for-user.md)

## Proposed Phase Order

### Phase 1 - Fix broken close control outside forecast route

Fix `AskAiTrigger.tsx` so the header close button calls an existing close handler instead of the missing `abortStream()` symbol on normal Ask AI routes. On `/forecast`, hide the close button entirely.

### Phase 2 - Make `/forecast` a chat-only route shell

Replace the old sector/company/scenario UI with a minimal route surface whose job is to host or trigger expanded Ask AI. The user should not see the current forecast webpage controls on `/forecast`.

### Phase 3 - Add route-aware Ask AI forecast mode

Teach `AskAiTrigger` to open automatically on `/forecast`, stay expanded, hide close/collapse/attachment controls, use forecast-specific copy/suggestions/placeholders, and send `routePath: "/forecast"` plus `screenName: "Forecast"` with requests.

### Phase 4 - Add and validate forecast context contract

Keep backend changes focused on forecast route context. The backend already has forecast routing, forecast system prompt, Tavily-question planning, forecast payload normalization, `forecastVisuals`, `forecastAnalysis`, and grouped source metadata, but the new requirement needs approved workbook/project inventory context when available.

### Phase 5 - Tests and acceptance

Add focused frontend tests for route mode and close behavior, then run Bun tests/build. Add or update backend tests only if the frontend route-mode payload requires a backend contract adjustment.
