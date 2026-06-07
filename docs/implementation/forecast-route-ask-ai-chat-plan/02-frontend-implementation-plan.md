# Frontend Implementation Plan

## Files

- Modify: `sheet-sherlock-detective/src/routes/forecast.tsx`
- Modify: `sheet-sherlock-detective/src/components/AskAiTrigger.tsx`
- Modify: `sheet-sherlock-detective/src/lib/ask-ai-context.ts`
- Modify: `sheet-sherlock-detective/src/lib/ask-ai-request.ts` only if route-mode metadata needs to force forecast mode beyond `routePath`.
- Test: `sheet-sherlock-detective/src/lib/ask-ai-context.test.ts`
- Test: add or extend component tests for `AskAiTrigger` if the current test setup supports rendering router state.

## Task 1: Replace `/forecast` Static Page With Chat Route Shell

- [ ] Remove local mock forecast state from `src/routes/forecast.tsx`: sector selection, company selection, scenario state, macro input state, and local SVG chart rendering.
- [ ] Keep `createFileRoute("/forecast")` and metadata.
- [ ] Render a minimal `PageShell` or route shell that does not expose the old controls. The shell may be visually empty or may contain only a route-owned background container; Ask AI is still globally mounted from `__root.tsx`.
- [ ] Do not add explanatory marketing text or instructions in the first viewport. This route is a tool surface, not a landing page.
- [ ] Confirm `routeTree.gen.ts` only changes if the router generator requires it.

Acceptance:

- Visiting `/forecast` no longer shows "Sector", "Company", scenario chart controls, macro assumptions, or "Select a sector and company".
- The route still exists and is reachable from the sidebar.

## Task 2: Add Forecast Route Mode To Ask AI

- [ ] In `AskAiTrigger.tsx`, derive `isForecastRoute = routePath === "/forecast"`.
- [ ] When `isForecastRoute` becomes true, open Ask AI automatically and set expanded mode to true.
- [ ] Keep `expanded` forced to true while `isForecastRoute` is true.
- [ ] Hide the collapse/shrink icon on `/forecast`.
- [ ] Hide the close icon on `/forecast`; users leave through sidebar/navigation.
- [ ] Hide or disable the attachment button on `/forecast` until direct chat upload is supported.
- [ ] Avoid repeatedly overwriting unrelated chat state on every render. Use an effect that reacts to route changes and applies route defaults when entering `/forecast`.
- [ ] In forecast route mode, do not show the floating Ask AI tab behind or beside the expanded panel.

Acceptance:

- Navigating to `/forecast` opens Ask AI without a click.
- The panel is expanded and cannot be collapsed from `/forecast`.
- The close and collapse controls are not visible on `/forecast`.
- The expanded panel respects sidebar width when the sidebar is open and fills the app area when collapsed.

## Task 3: Add Forecast-Specific Empty State And Prompting

- [ ] Update `askAiSuggestionsForRoute("/forecast")` to return forecasting prompts, for example:
  - "Give me a 5-year qualitative and quantitative forecast for this company"
  - "Calculate historical revenue CAGR and normalized CAGR"
  - "Identify outliers and summarize assumptions I can use"
- [ ] Update the empty ready-card text in `AskAiTrigger.tsx` for forecast mode so it mentions forecasting context, CAGR, normalized growth, analyst reports, scenarios, and assumptions.
- [ ] Update the prompt placeholder for forecast mode to be forecast-specific.
- [ ] Keep copy compact. Do not use long instructions inside the app.

Acceptance:

- Empty state on `/forecast` reads like an analyst chat, not a generic PDF/cell helper.
- Suggestions match the reference conversation shape from `chatgpt_chat.json`.

## Task 4: Preserve Project Context Without Requiring The Old Page

- [ ] Keep `/forecast` in `PROJECT_CONTEXT_ROUTES`.
- [ ] If `selectedProjectId` exists, send project context exactly as Ask AI does today.
- [ ] Add all approved/accessible projects and Excel workbooks to forecast LLM context when available, not only the active project.
- [ ] If no selected project exists, preserve the existing workbook inventory/model-search flow in `AskAiTrigger.tsx` and show workbook/model-selection suggestions immediately in the forecast empty state.
- [ ] For true sector-only prompts, allow Ask AI to answer from approved external sources; for company/model-specific prompts with insufficient local context, ask the user to choose a workbook/company.
- [ ] Do not block the user with the old page-level sector/company comboboxes.

Acceptance:

- Forecast chat works from an active project.
- Forecast chat can use approved workbook inventory context when available.
- Forecast chat can guide the user to select an accessible workbook when a company/model-specific answer needs one.

## Task 5: Route The Request As Forecast

- [ ] Verify that the existing payload includes `routePath: "/forecast"` and `screenName: "Forecast"` when sent from `/forecast`.
- [ ] If backend semantic routing already classifies route-path forecast correctly, do not add a new frontend field.
- [ ] If tests show ambiguity for generic prompts such as "What should I assume?", add a minimal request hint through the existing `filters` object or a typed field only after checking backend schema compatibility.
- [ ] Force forecast mode for `/forecast` prompts and follow-ups while preserving safety and finance-domain guardrails.
- [ ] Auto-enable `includeExternalSources` for `/forecast` prompts. The backend may skip actual web search when local approved context is complete.

Acceptance:

- A forecast route question reaches backend forecast mode without requiring the word "forecast" in every prompt.
- Approved web search is enabled for `/forecast` requests.
- Existing diagnosis and project-QA routes keep their current behavior.

## Task 6: Frontend Verification

- [ ] Run `bun test src/lib/ask-ai-context.test.ts src/lib/ask-ai-request.test.ts`.
- [ ] Run existing Ask AI tests that cover stream parsing, forecast normalization, input handling, stop behavior, and citations.
- [ ] Run `bun run build`.
- [ ] Manually verify `/forecast` in the browser after implementation: expanded chat opens, no old page controls are visible, close/collapse/attachment controls are hidden, approved workbook context is available when expected, approved web search is enabled, and wide forecast tables do not overflow.
