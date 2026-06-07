# Questions For User

Status: answered. Unanswered items use the recommended answer below and should be treated as applied unless the user changes them later.

## Applied Decision Summary

- On `/forecast`, hide the close button and do not let the user close Ask AI from inside the panel.
- On `/forecast`, always keep Ask AI expanded and hide the collapse/shrink icon.
- Fully remove the old `/forecast` route content from normal user flow.
- In forecast mode, include all approved/accessible projects and Excel workbooks in LLM context when available, so the agent is not forced to rely only on web search.
- For true sector-only forecast questions, answer from approved external sources; for company/model-specific questions, ask the user to choose a workbook/company when needed.
- Force forecast mode for all `/forecast` prompts and follow-ups, while preserving finance-domain and safety guardrails.
- Auto-enable approved web search on `/forecast`.
- Do not always force quantitative tables for qualitative prompts; include them when requested or materially helpful.
- Hide or disable the attachment button on `/forecast` until direct chat upload is supported.

## Route Behavior

1. When the user clicks **Close Ask AI** while on `/forecast`, what should happen?
   - Option A: Navigate to the previous route or dashboard because `/forecast` only exists for chat.
   - Option B: Hide the panel but keep the user on a mostly blank `/forecast` route with the floating Ask AI tab available.
   - Option C: Disable/hide close on `/forecast`; allow only collapse or navigation through sidebar.
   - Recommended answer: Option A. Since `/forecast` is now only a dedicated expanded-chat entry point, closing the chat should leave that route instead of exposing a blank or confusing page.
   Answer: go with Option C
   Applied: Use Option C, but with collapse also disabled by answer 2. Users leave via sidebar/navigation, not the Ask AI close button.

2. Should users be allowed to collapse Ask AI on `/forecast`, or should `/forecast` always force expanded chat?
   - Recommended answer: Allow collapse, but keep `/forecast` expanded by default on route entry. This preserves user control while still making the route's primary purpose clear.
   Answer: It will always b expanded, hide the collapse/shrink icon
   Applied: Always expanded on `/forecast`; hide collapse/shrink icon.

3. Should the old `/forecast` route content be fully removed, or kept behind a feature flag/admin-only fallback for now?
   - Recommended answer: Fully remove it from the user route. The current sector/company/scenario controls conflict with the new flow and should not remain visible or reachable in normal usage.
   Answer: Remove that content
   Applied: Remove old route content.

## Forecast Chat Context

4. If no project/workbook is selected, should `/forecast` immediately show workbook-selection suggestions, or wait until the user asks a company/sector question?
   - Recommended answer: Show workbook/model-selection suggestions immediately in the empty state, while still allowing the user to type a sector/company question. This reduces friction and reuses the existing Ask AI workbook discovery flow.
   Answer: Please note that for forecasting add all the the approve projects/excel-workbooks in the LLM context too if available, otherwise you'll be totally relaying on websearching to answer user questions
   Applied: Add all approved/accessible projects and Excel workbooks to forecast LLM context when available. Keep workbook-selection UX available, but do not limit forecast context to the active project only.

5. For a sector-only forecast question with no company selected, should Ask AI answer from approved external sources only, or should it first ask the user to choose a workbook/company?
   - Recommended answer: Answer from approved external sources for true sector-only questions, but ask the user to choose a workbook/company when the question needs company financials, PDFs, or model-specific projections.
   Applied: Use recommended answer.

6. Should `/forecast` force forecast mode for every prompt, including short follow-ups like "summarise this" or "what assumptions should I use"?
   - Recommended answer: Yes, force forecast mode as the route default, while preserving safety/domain guardrails. Short follow-ups on `/forecast` should inherit forecast-chat context instead of falling back to generic project QA.
   Applied: Use recommended answer.

## Sources And Output

7. Should the route auto-enable approved web search for all `/forecast` prompts, or keep current behavior where the question wording determines `includeExternalSources`?
   - Recommended answer: Auto-enable approved web search for `/forecast`, but let the backend skip it when local evidence is already complete or the prompt does not require external facts. Forecasting often needs current market, macro, sector, and analyst context.
   Answer: auto enable approved web search
   Applied: Auto-enable approved web search on `/forecast`.

8. Should forecast answers always include quantitative tables when enough evidence exists, even if the user asks a qualitative question?
   - Recommended answer: No. Include quantitative tables when the user asks for quantitative output or when the numbers materially support the answer; for purely qualitative questions, keep tables optional and concise.
   Applied: Use recommended answer.

9. Should the route keep the existing attachment button, knowing uploaded PDFs are still handled by the project upload/indexing flow and not direct chat upload?
   - Recommended answer: Hide or disable the attachment button on `/forecast` until direct chat upload is supported. Keeping a button that only explains uploads happen elsewhere is likely to feel broken.
   Applied: Use recommended answer.
