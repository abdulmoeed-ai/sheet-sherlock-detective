# Sheet Sherlock — Feature Enhancement Plan

Five connected enhancements spanning sector configuration, ingestion transparency, source verification, version diffing, and AI citations. All UI-only with mock data (no backend yet) — matches the existing prototype pattern in the codebase.

---

## Step 1 — Sector-Based Mapping System

**Files**: new `src/lib/sector-packs.ts`, edit `src/lib/cycle-store.ts`, edit `src/routes/index.tsx` (dashboard sector picker), edit `src/routes/ingestion.tsx`

- Define 8 sector packs as typed objects: `Engineering & Industrials`, `Banking`, `Oil & Gas`, `Fertilizers`, `IT & Software`, `Pharmaceuticals`, `Food & FMCG`, `Textiles`. Each pack has: rule count, template name, year-end, macro variables, regulatory tags, sector-override rule list.
- Extend `cycleStore` with `activeSectorPack` derived from selected sector.
- On ingestion page, add an "Active rule pack" chip showing pack name + rule count + template + year-end. Click opens a modal listing the 40 rules with "Sector override" badges on pack-specific rules.

## Step 2 — Per-Source Ingestion Manifest

**Files**: edit `src/routes/ingestion.tsx`

- Extend each of the 13 (currently 8) source cards with an expand chevron.
- Add mock `manifest` data per source: array of `{field, value, sheet, cell, confidence, timestamp}`.
- Inline expand reveals a table styled per spec (12px text, monospace cells, confidence pill, amber left border on low-confidence rows).
- Add summary strip above the source grid: total fields · live sources · low-confidence sources · empty sources.
- Add "View in diff queue →" link per row deep-linking to `/diff-review#row-{id}`.
- Persist expand state in `sessionStorage`.

## Step 3 — Source PDF Preview

**Files**: new `src/components/SourcePreviewPanel.tsx`, edit `src/routes/ingestion.tsx` (OCR queue), edit `src/routes/diff-review.tsx`

- Mock PDF preview using a generated image placeholder (page background + bounding box overlay). Use a single mock PNG asset rendered via SVG overlay for the bounding box and label.
- In Diff Reviewer: every row gets a source chip "MTL Annual Report 2025 · p. 107". Click/hover-1s opens a right-side 40%-width panel synced to the active row.
- In OCR confidence queue (ingestion page): low-confidence rows show inline value + snippet side-by-side.
- Bounding box color = confidence tier (green/amber/red).

## Step 4 — Diff Checker (Version Comparison)

**Files**: heavy edit `src/routes/diff-review.tsx` (or extend existing if present)

- Two-column Old | New table with materiality tiers: <2% auto-approved, 2–10% confirm, >10% blocked.
- Blocked rows: amber left border + reason-code dropdown (sign error / wrong period / source mismatch / other) + free-text justification; approve button disabled until filled.
- Right panel shows live Excel preview (reuse `ExcelAddIn` component) updating as diffs approve.
- Top summary strip + progress bar + disabled "Apply to model" CTA until all cleared.
- Audit log entries appended to a mock store on each approval.

## Step 5 — Ask AI Citations

**Files**: edit `src/components/AskAiPanel.tsx`

- Below every assistant response, render a collapsible "Sources used" section with horizontal-scroll cards (52px height).
- Card types: web (Tavily-style with favicon, date, 2-line excerpt, external link), model-internal (purple border, cell ref + sheet + value), ingestion-log (source doc + timestamp).
- Inline `[1] [2]` citation markers in response text linking to cards.
- Collapsed by default for short responses; auto-expanded for Prediction Agent outputs.
- Mock 3–5 citations per canned response.

---

## Technical notes

- All five steps use mock/seeded data — no new API routes, no backend, no DB.
- Reuse existing design tokens from `src/styles.css` (`--color-brand`, `--color-text-primary`, etc.). No new color literals in components.
- Each step is independently shippable. Recommend implementing in order 1 → 2 → 4 → 3 → 5 (rule pack first since others reference it; PDF preview after diff structure exists).

## Scope confirmation needed

This is ~6–8 hours of focused UI work across 8+ files. Before I start: **should I build all 5 steps in this single response, or implement them one step at a time so you can review each?** One-at-a-time gives you tighter control and faster iteration; all-at-once ships faster but is harder to course-correct.
