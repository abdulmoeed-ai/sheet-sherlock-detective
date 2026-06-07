# Current State And Product Spec

## Current Frontend State

`sheet-sherlock-detective/src/routes/forecast.tsx` is currently a normal page. It renders:

- Page title and subtitle: "5-Year Forecast".
- Diagnosis readiness banner.
- Sector and company comboboxes.
- Mock scenario chart data from local constants.
- Macro assumption inputs.
- Empty state text when no company is selected.

This is the UI shown in the screenshot and is now product-invalid for the new flow.

`sheet-sherlock-detective/src/routes/__root.tsx` mounts `<AskAiTrigger />` globally. That means `/forecast` does not need a second independent chat component unless the team chooses to refactor later.

`sheet-sherlock-detective/src/components/AskAiTrigger.tsx` already owns:

- Open/closed state.
- Expanded/collapsed state.
- Sidebar-aware expanded width through `useSidebarCollapsed()` and `SIDEBAR_WIDTH`.
- Chat history.
- Streaming Ask AI request lifecycle.
- Forecast visual rendering through `normalizeForecastAnalysis()` and `normalizeForecastVisuals()`.
- Source/citation preview rendering.

`sheet-sherlock-detective/src/lib/ask-ai-context.ts` already treats `/forecast` as a project-context route. This is useful, but the new route also needs to work as an independent forecasting chat when no project is selected.

## Current Backend State

The backend already has the main forecast feature path:

- `backend_code/backend/app/services/ask_ai/graph/router.py` routes forecast-intent questions to `AskAiRoute.FORECAST`.
- `backend_code/backend/app/services/ask_ai/graph/runtime.py` delegates `AskAiRoute.FORECAST` into the existing streaming answer path when project context exists.
- `backend_code/backend/app/services/ask_ai/prompts.py` has `ASK_AI_FORECAST_SYSTEM_PROMPT`.
- `backend_code/backend/app/services/ask_ai/streaming.py` sets `forecast_route = route_decision == "forecast"` and forces forecast routes through external-evidence planning when needed.
- `backend_code/backend/app/services/ask_ai/response_builder.py` parses forecast answers into `forecastVisuals`, `forecastAnalysis`, `claimSourceGroups`, and `tavilyQuestions`.
- `backend_code/backend/app/services/ask_ai/forecast_payload.py` normalizes forecast charts, historical series, CAGR results, normalized base, scenario tables, assumptions, missing inputs, and Tavily questions.

The backend probably does not need a new forecast endpoint for this route. The implementation should first prove that `/forecast` sends the existing Ask AI payload shape that makes the backend choose forecast mode.

## Reference Conversation Shape

`backend_code/chatgpt_chat.json` shows the desired analyst-chat rhythm:

- User asks for a 5-year qualitative and quantitative forecast.
- Assistant starts with the latest actuals and a practical forecast structure.
- User follows up with analyst-report questions.
- User asks for historical revenue CAGR.
- User asks for normalized CAGR.
- User asks which years are outliers and why.
- User asks for a concise assumptions-ready summary.

The implementation should support that follow-up sequence in the same Ask AI thread without forcing the user back into old page controls.

## Reference PDF Shape

`backend_code/sample_docs/Qualitative Takeaways.pdf` shows that forecast answers should use qualitative drivers, not only numeric projections. The route should make it natural for users to ask about:

- Demand cycle and farm income.
- Policy stimulus and subsidies.
- Export expansion.
- FX, supply chain, working capital, and liquidity.
- Energy, coal, capacity utilization, regulatory pressure, product mix, CSR, and sector intelligence.
- Macro, sector, brokerage, market-data, regulatory, commodity, and industry sources.

## Product Requirements

- `/forecast` opens Ask AI in expanded form and remains expanded.
- The current forecast route page controls should not be shown to the user.
- Ask AI should behave like an independent chat agent on this route.
- The agent should still use selected project/workbook/PDF context when available.
- In forecast mode, include all approved/accessible projects and Excel workbooks in the LLM context when available, so the answer is not forced to rely only on web search.
- When no project is selected, the route should allow workbook/model selection through the existing Ask AI workbook discovery flow while still providing approved workbook inventory context.
- True sector-only questions may answer from approved external sources; company/model-specific questions should ask the user to choose a workbook/company when needed.
- `/forecast` should force forecast mode for all prompts and follow-ups while preserving safety and finance-domain guardrails.
- `/forecast` should auto-enable approved web search; the backend may still skip unnecessary external search when local approved context is complete.
- Forecast answers should include quantitative tables when the user asks for quantitative output or when numbers materially support the answer, not for every qualitative prompt.
- Forecast answers should use the existing backend forecast behavior before adding new backend code.
- The close chat button must work on normal Ask AI routes.
- On `/forecast`, hide the close button and collapse/shrink icon. Users leave through sidebar/navigation.
- Hide or disable the attachment button on `/forecast` until direct chat upload exists.

## Non-Goals For This Slice

- Do not build a second forecast API endpoint.
- Do not reintroduce the old sector/company forecast controls.
- Do not write forecast assumptions back into workbook cells.
- Do not make personalized buy/sell/hold investment advice.
- Do not expose internal source IDs, model IDs, or retrieval identifiers to users.
- Do not leave a blank `/forecast` route after closing Ask AI; the close control is hidden on this route.
