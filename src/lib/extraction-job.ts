import type { ExtractionJobResponse, ExtractionProgressEventResponse } from "./api/types";

const COMPLETE_STATUSES = new Set(["completed", "succeeded", "success"]);
const FAILED_STATUSES = new Set(["failed", "error", "cancelled", "canceled"]);

export async function waitForExtractionCompletion({
  projectId,
  initialJob,
  readJob,
  delayMs = 1500,
  onProgress,
}: {
  projectId: string;
  initialJob: ExtractionJobResponse;
  readJob: (projectId: string, jobId: string) => Promise<ExtractionJobResponse>;
  delayMs?: number;
  onProgress?: (job: ExtractionJobResponse) => void;
}): Promise<ExtractionJobResponse> {
  let current = initialJob;

  while (true) {
    onProgress?.(current);
    if (isCompletedExtractionJob(current)) return current;
    if (isFailedExtractionJob(current)) {
      throw new Error(current.error || current.message || "Extraction failed.");
    }

    await delay(delayMs);
    current = await readJob(projectId, current.id);
  }
}

function isCompletedExtractionJob(job: ExtractionJobResponse) {
  return COMPLETE_STATUSES.has(job.status.toLowerCase());
}

function isFailedExtractionJob(job: ExtractionJobResponse) {
  return FAILED_STATUSES.has(job.status.toLowerCase());
}

function delay(ms: number) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function mergeExtractionEvents(
  current: ExtractionProgressEventResponse[],
  next: ExtractionProgressEventResponse[],
) {
  const byId = new Map<string, ExtractionProgressEventResponse>();
  for (const event of [...current, ...next]) {
    byId.set(event.eventId, event);
  }
  return [...byId.values()].sort((left, right) => {
    const timeDelta = Date.parse(left.createdAt) - Date.parse(right.createdAt);
    if (timeDelta !== 0) return timeDelta;
    return left.eventId.localeCompare(right.eventId);
  });
}
