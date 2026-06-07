# Close Chat Fix Plan

## Current Bug

`sheet-sherlock-detective/src/components/AskAiTrigger.tsx` renders the header close button with:

```tsx
onClick={() => {
  abortStream();
  setOpen(false);
}}
```

There is no `abortStream()` function defined in the component. The component currently defines:

- `clearActiveStream()`
- `stopActiveStream()`

This explains why the close chat button is broken.

## Files

- Modify: `sheet-sherlock-detective/src/components/AskAiTrigger.tsx`
- Test: existing Ask AI tests if component-level test coverage is available.
- Test: `sheet-sherlock-detective/src/lib/ask-ai-stop.test.ts` only if stop-message behavior changes.

## Route Policy

- Outside `/forecast`, the Ask AI close button should work normally.
- On `/forecast`, the close button is hidden.
- On `/forecast`, the collapse/shrink icon is hidden and Ask AI remains expanded.
- Users leave `/forecast` through sidebar/navigation, not through Ask AI close.

## Task 1: Add A Dedicated Close Handler For Non-Forecast Routes

- [ ] Add a local handler such as `closeAskAiPanel()`.
- [ ] The handler should abort an active in-flight stream if there is one.
- [ ] The handler should clear `abortControllerRef.current` and `activeStreamIdRef.current`.
- [ ] The handler should set `asking` to false.
- [ ] The handler should close preview sidebars and history overlays if needed.
- [ ] The handler should set `open` to false only when `routePath !== "/forecast"`.

Recommended behavior outside `/forecast`:

- Close hides the panel.
- The floating Ask AI tab becomes visible again.
- If a stream was active, the stream is stopped and the message is marked stopped consistently with the existing stop button.

Required behavior on `/forecast`:

- Hide the close button.
- Hide the collapse/shrink button.
- Keep the panel expanded until the user navigates away.

## Task 2: Replace Missing Function Call

- [ ] Replace `abortStream(); setOpen(false);` with the dedicated close handler.
- [ ] Keep the stop button wired to `stopActiveStream()` so "stop response" and "close panel" remain distinct actions.
- [ ] Render the close button only when `routePath !== "/forecast"`.
- [ ] Render the collapse/shrink button only when `routePath !== "/forecast"`.

## Task 3: Regression Checks

- [ ] Verify TypeScript no longer reports `Cannot find name 'abortStream'`.
- [ ] Verify clicking close when idle closes the panel.
- [ ] Verify clicking close during a stream does not leave `asking` stuck true.
- [ ] Verify no close/collapse controls are visible on `/forecast`.
- [ ] Verify clicking the stop button during a stream still marks only that stream as stopped.
- [ ] Verify closing does not delete chat history or reset the current thread unless the user clicks New chat.

## Acceptance

- Close button works in normal Ask AI usage.
- Close and collapse buttons are hidden on `/forecast`.
- Existing stream lifecycle safeguards remain intact.
