## Sheet Sherlock — Guided Cycle Flow Build

Implement the full guided cycle (Dashboard → Ingestion → Diff Review → Diagnosis → Forecast → Assumptions → Audit) with the ClickUp color system, a progress spine, and a persistent Ask AI panel.

### 1. Color system overhaul (`src/styles.css`)
Replace existing tokens with the full ClickUp palette spec:
- Sidebar: `#191F2E` bg, `#2A3153` active, `#9E95F5` accent, `#8892A4` muted text
- Primary `#7B68EE`, hover `#6455D6`, light `#EDE9FE`, accent `#9E95F5`, sparkle `#5E4BF1`
- Page bg `#F7F8FA`, card `#FFFFFF`, tag `#F3F0FF`
- Borders `#E3E6EA` / `#D0D5DD`, focus ring `#7B68EE`
- Text `#292D34` / `#4F546B` / `#818EA0` / `#A0A8B8`
- Success / Danger / Warning / Info families as specified
- Update `--color-brand`, `--color-accent-green`, `--color-accent-sparkle`, etc. so existing components inherit the new theme

Update `Sidebar.tsx` to use the new navy-purple bg, lavender active item, and purple icon accent.

### 2. Cycle state store (`src/lib/cycle-store.ts`)
Zustand-style lightweight store with:
- `cycle: { sector, company, period, status, startedAt }`
- `startCycle()`, `setStatus(step)`, `reset()`
- Step statuses: `idle | ingestion | diff-review | diagnosis | forecast | assumptions | review`

### 3. Progress spine (`src/components/CycleProgress.tsx`)
Horizontal stepper rendered above page content when `cycle.status !== 'idle'`. Shows 6 steps (Ingestion → Diff → Diagnosis → Forecast → Assumptions → Review) with completed/current/upcoming states using `#7B68EE` for active, `#22C55E` for done, muted otherwise. Mounted in `PageShell`.

### 4. Dashboard wiring (`src/routes/index.tsx`)
"New ingestion cycle" button calls `startCycle()` with current sector/company/period selections and navigates to `/ingestion`. Keep existing dashboard intact otherwise.

### 5. `/ingestion` rewrite
- PDF dropzone (turns into file chip on upload) + OCR confidence threshold slider
- Live source registry grid (8 sources with health dots: PSX/ADB/Bloomberg/SBP/PBS/WSJ/APCMA/NEPRA)
- Warning row for stale/unreachable sources
- Sticky footer: "Start ingestion →" (disabled until PDF uploaded)
- On click → swap source grid for live progress feed (sequential spinner→check rows with timings), then append "OCR Quality Review" table (4 rows, confirm/edit actions)
- Footer becomes progress bar + "Review diffs →" (enabled once OCR flags resolved) → navigates to `/diff-review`

### 6. `/diff-review` rewrite
- 55/45 split
- Left: diff queue card with header counter + progress bar, table of 6 rows (auto-approved dimmed, confirm with approve/reject, blocked with justify expansion), sticky "Apply to model →" CTA (disabled until resolved)
- Right: live model preview mini-grid (CSS grid, 7 cols × 12 rows, dummy financial values). Approved cells flash `#D1FAE5` for 1s; blocked cells show locked state
- On apply → `/diagnosis`

### 7. `/diagnosis` rewrite
- 1.5s "Running 3-statement check..." spinner state
- Default → State B (imbalance): red banner + Sherlock AI diagnosis card with findings list, proposed correction block (Dr/Cr), confidence label, override dropdown + Apply correction
- On apply → 1s re-check → State A (clean): green banner + 3 ratio KPI cards + "Continue to forecast →"

### 8. `/forecast` rewrite
- Top card: scenario pill group (Base/Bull/Bear), Recharts LineChart (240px) with 3 lines + confidence band, FY2030 endpoint callout
- What-if sliders: KIBOR / CPI / PKR-USD (mock recalc that adjusts series multipliers in state)
- Bottom row: Scenario summary table + Key assumptions card (pills + amber risk rows)
- Sticky footer → `/assumptions`

### 9. `/assumptions` rewrite
- Subtitle + Export CSV
- Table with 8 rows including confidence badges + sensitivity badges + inline edit
- Sticky footer: Save draft + "Submit for Manager review →"
- Submit opens confirmation modal → on confirm shows success toast + navigates to `/` and sets cycle status to `review`

### 10. `/audit` enrichment
- Cycle status banner at top (green if approved, amber if in review) using cycle store
- Keep existing trail
- Add "Export signed PDF" primary button top-right (triggers placeholder download)

### 11. Persistent Ask AI panel (`src/components/AskAiTrigger.tsx`)
- Fixed right-edge trigger button (36×96, brand purple, sparkle + vertical "AI" text)
- Slide-in 380px panel with header, context pill, suggested prompts, chat input
- Prediction flow: clarification card → 4-step status stream (staggered 0.8s) → final response bubble with mini chart + assumption pills + risk rows + two CTAs
- Mounted in `__root.tsx` so visible on every page
- Adapt existing `AskAiPanel` rather than rebuild from scratch

### Technical details
- Add `recharts` (already used) and ensure `framer-motion` is available for panel slide
- Keep all colors via CSS variables; no hardcoded hex in components except in chart strokes where needed
- Use TanStack Router's `useNavigate` for all flow transitions
- No backend; all state in zustand store + local component state
- Toast via existing `sonner`

### Files to create
- `src/lib/cycle-store.ts`
- `src/components/CycleProgress.tsx`
- `src/components/AskAiTrigger.tsx`
- `src/components/ModelPreviewGrid.tsx` (mini spreadsheet)

### Files to edit
- `src/styles.css`, `src/components/Sidebar.tsx`, `src/components/PageShell.tsx`, `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/routes/ingestion.tsx`, `src/routes/diff-review.tsx`, `src/routes/diagnosis.tsx`, `src/routes/forecast.tsx`, `src/routes/assumptions.tsx`, `src/routes/audit.tsx`
