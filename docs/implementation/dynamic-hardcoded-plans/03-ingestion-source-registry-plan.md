# Ingestion Source Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static source registry, random feed simulation, static OCR issues, and synthetic source preview with backend ingestion preview, extraction job polling, and real PDF page images.

**Architecture:** The frontend should start extraction, poll the extraction job and ingestion preview endpoints, render PRD source groups from backend data, and open source previews through the backend page-image route when a document-backed field has page metadata.

**Tech Stack:** TanStack Router, React, FastAPI extraction endpoints, source ingestion preview service, document image service, Bun tests, pytest.

---

## Hardcoded Evidence

- `src/routes/ingestion.tsx:57` defines 13 static `SOURCES`.
- `src/routes/ingestion.tsx:195` defines static OCR issues.
- `src/routes/ingestion.tsx:205` runs local timers and random cell/duration values.
- `src/routes/ingestion.tsx:346` says `PDF, XLSX`, but backend rejects non-PDF uploads.
- `src/components/SourcePreviewPanel.tsx:38` explicitly states no real PDFs are loaded.

## Backend Current State

- `POST /api/projects/{project_id}/extractions` starts extraction and returns a job id.
- `GET /api/projects/{project_id}/extractions/{job_id}` returns job status, percent, message, and error.
- `GET /api/projects/{project_id}/ingestion/preview` returns source cards and fields.
- `GET /api/projects/{project_id}/documents/{document_id}/pages/{pdf_page_index}/image` returns real PNG bytes.

## Files

- Modify: `sheet-sherlock-detective/src/lib/api/projects.ts`
- Modify: `sheet-sherlock-detective/src/routes/ingestion.tsx`
- Modify: `sheet-sherlock-detective/src/components/SourcePreviewPanel.tsx`
- Test: `sheet-sherlock-detective/tests/projects-api.test.ts`
- Test: `sheet-sherlock-detective/e2e/03-ingestion-and-source-preview.e2e.ts`
- Optional backend test: `backend_code/backend/tests/integration/test_project_api.py`

### Task 1: Add Frontend API Wrappers

- [ ] **Step 1: Extend API tests**

Add to `sheet-sherlock-detective/tests/projects-api.test.ts`:

```ts
import { getExtractionJob, getSourceIngestionPreview } from "../src/lib/api/projects";

it("loads extraction job and source ingestion preview", async () => {
  withSession();
  const requests: Request[] = [];
  globalThis.fetch = ((input, init) => {
    requests.push(new Request(input, init));
    const path = new URL(String(input)).pathname;
    if (path.endsWith("/extractions/job-1")) {
      return jsonResponse({ id: "job-1", projectId: "project-1", status: "completed", percent: 100, message: "Done" });
    }
    return jsonResponse({
      projectId: "project-1",
      runId: "run-1",
      summary: { totalFields: 2, totalSources: 13, sourcesLive: 1, lowConfidenceFields: 1, lowConfidenceSources: 1, unavailableSources: 0 },
      sources: [{ sourceId: "psx", sourceName: "Pakistan Stock Exchange", status: "completed", fieldCount: 2, lowConfidenceCount: 1, fields: [] }],
    });
  }) as typeof fetch;

  const job = await getExtractionJob("project-1", "job-1");
  const preview = await getSourceIngestionPreview("project-1");

  expect(job.percent).toBe(100);
  expect(preview.summary.totalSources).toBe(13);
  expect(requests[0].url).toEndWith("/api/projects/project-1/extractions/job-1");
  expect(requests[1].url).toEndWith("/api/projects/project-1/ingestion/preview");
});
```

- [ ] **Step 2: Add client types/functions**

In `sheet-sherlock-detective/src/lib/api/projects.ts`, add:

```ts
export type SourceIngestionPreview = {
  projectId: string;
  runId: string | null;
  summary: Record<string, number>;
  sources: Array<Record<string, unknown>>;
};

export async function getExtractionJob(projectId: string, jobId: string): Promise<ExtractionJobResponse> {
  return apiRequest(`/api/projects/${projectId}/extractions/${jobId}`);
}

export async function getSourceIngestionPreview(projectId: string, runId?: string | null): Promise<SourceIngestionPreview> {
  const query = runId ? `?run_id=${encodeURIComponent(runId)}` : "";
  return apiRequest(`/api/projects/${projectId}/ingestion/preview${query}`);
}

export function documentPageImageUrl(projectId: string, documentId: string, pdfPageIndex: number): string {
  return `${API_BASE_URL}/api/projects/${projectId}/documents/${documentId}/pages/${pdfPageIndex}/image`;
}
```

- [ ] **Step 3: Run API tests**

Run: `cd sheet-sherlock-detective && bun test tests/projects-api.test.ts`

Expected: PASS.

### Task 2: Replace Local Feed With Job Polling

- [ ] **Step 1: Track job id**

In `src/routes/ingestion.tsx`, replace `runLocalFeed()` with:

```ts
const [job, setJob] = useState<ExtractionJobResponse | null>(null);
const [preview, setPreview] = useState<SourceIngestionPreview | null>(null);
```

After `startProjectExtraction(project.id)`:

```ts
const extraction = await startProjectExtraction(project.id);
setJob(extraction);
setRunning(true);
setFeedDone(false);
```

- [ ] **Step 2: Poll job and preview**

Add:

```ts
useEffect(() => {
  if (!projectId || !job || job.status === "completed" || job.status === "failed") return;
  const timer = window.setInterval(async () => {
    const nextJob = await getExtractionJob(projectId, job.id);
    setJob(nextJob);
    const nextPreview = await getSourceIngestionPreview(projectId);
    setPreview(nextPreview);
    if (nextJob.status === "completed" || nextJob.status === "failed") {
      setFeedDone(nextJob.status === "completed");
      window.clearInterval(timer);
    }
  }, 1500);
  return () => window.clearInterval(timer);
}, [projectId, job?.id, job?.status]);
```

- [ ] **Step 3: Render source cards from preview**

Map backend statuses:

```ts
function sourceStatus(source: Record<string, unknown>): SourceStatus {
  if (source.status === "completed") return "live";
  if (source.status === "unavailable") return "down";
  if (source.freshnessStatus === "stale") return "stale";
  return "stale";
}
```

Build `SourceRegistry` input from `preview?.sources ?? []`. Use `preview.summary.sourcesLive`, `lowConfidenceSources`, and `unavailableSources` for counts.

### Task 3: Fix Upload Contract

- [ ] **Step 1: Make accepted file types match backend**

In `src/routes/ingestion.tsx`, change:

```tsx
PDF only (max. 50MB)
```

and:

```tsx
accept=".pdf"
```

- [ ] **Step 2: Add client-side guard**

Before upload:

```ts
if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
  setIngestionError("Only PDF annual reports are supported for this extraction flow.");
  return;
}
```

### Task 4: Use Real Source Preview Images

- [ ] **Step 1: Extend `SourceRef`**

In `src/components/SourcePreviewPanel.tsx`, add optional image fields:

```ts
projectId?: string;
documentId?: string;
pdfPageIndex?: number;
imageUrl?: string;
```

- [ ] **Step 2: Render image when available**

Replace the synthetic-only body with:

```tsx
{source.imageUrl ? (
  <img src={source.imageUrl} alt={`${source.doc} page ${source.page}`} className="h-full w-full object-contain" />
) : (
  <SyntheticPage source={source} compact={compact} />
)}
```

Keep the bbox overlay above both image and synthetic fallback.

- [ ] **Step 3: Build image URLs from evidence**

When mapping ingestion/review fields, set:

```ts
imageUrl:
  field.documentId && typeof field.pdfPageIndex === "number"
    ? documentPageImageUrl(projectId, String(field.documentId), Number(field.pdfPageIndex))
    : undefined
```

Backend may need to include `pdfPageIndex` in ingestion fields if it is absent. Add it in `backend/app/services/ingestion/preview.py` only when source fields are document-backed.

### Task 5: Run Checks

- [ ] **Step 1: Frontend**

Run: `cd sheet-sherlock-detective && bun test tests/projects-api.test.ts`

Expected: PASS.

Run: `cd sheet-sherlock-detective && bun run build`

Expected: build completes.

- [ ] **Step 2: Backend if preview payload changed**

Run: `cd backend_code/backend && uv run python -m pytest tests/unit/test_source_ingestion_preview.py tests/integration/test_project_api.py::test_source_ingestion_preview_route_requires_auth_and_returns_source_cards -q`

Expected: PASS.

### Task 6: Commit

- [ ] **Step 1: Commit**

```bash
cd sheet-sherlock-detective
git add src/lib/api/projects.ts src/routes/ingestion.tsx src/components/SourcePreviewPanel.tsx tests/projects-api.test.ts e2e/03-ingestion-and-source-preview.e2e.ts
git commit -m "feat(ingestion): render source preview from backend jobs"
```

If backend changed:

```bash
cd backend_code
git add backend/app/services/ingestion/preview.py backend/tests/unit/test_source_ingestion_preview.py backend/tests/integration/test_project_api.py
git commit -m "feat(ingestion): expose document-backed preview references"
```

