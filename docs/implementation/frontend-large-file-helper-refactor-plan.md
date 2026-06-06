# Frontend Large File Helper Refactor Plan

> **For agentic workers:** Refactor task for the current session. Keep behavior unchanged and verify with focused tests plus a production build.

**Goal:** Move pure helper logic out of `diagnosis.$projectId.tsx` and `WorkbookEditor.tsx` into focused frontend helper modules.

**Architecture:** Keep React components responsible for rendering and event wiring. Move workbook transformation/edit helpers into `src/lib/workbook-editor-utils.ts`, and route-specific diagnosis workbook/comment helpers into `src/lib/diagnosis-workbook.ts`.

**Tech Stack:** React, TanStack Router, Vitest, Bun, TypeScript.

---

## Tasks

- [x] Add focused characterization tests for the new helper modules.
- [x] Extract WorkbookEditor helper types and pure functions into `src/lib/workbook-editor-utils.ts`.
- [x] Extract diagnosis route workbook/comment helper types and pure functions into `src/lib/diagnosis-workbook.ts`.
- [x] Update imports in the two large files without changing UI flow.
- [x] Run focused tests and `bun run build`.
