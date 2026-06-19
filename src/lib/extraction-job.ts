import type { ExtractionJobResponse, ExtractionProgressEventResponse } from "./api/types";

const COMPLETE_STATUSES = new Set(["completed", "succeeded", "success"]);
const FAILED_STATUSES = new Set(["failed", "error", "cancelled", "canceled"]);

const STALL_THRESHOLD_MS = 3 * 60 * 1000; // 3 min without percent change
const MAX_WAIT_MS = 20 * 60 * 1000; // 20 min hard timeout

export async function waitForExtractionCompletion({
  projectId,
  initialJob,
  readJob,
  delayMs = 1500,
  onProgress,
  onStall,
}: {
  projectId: string;
  initialJob: ExtractionJobResponse;
  readJob: (projectId: string, jobId: string) => Promise<ExtractionJobResponse>;
  delayMs?: number;
  onProgress?: (job: ExtractionJobResponse) => void;
  onStall?: (job: ExtractionJobResponse) => void;
}): Promise<ExtractionJobResponse> {
  let current = initialJob;
  let lastPercent = current.percent;
  let lastProgressAt = Date.now();
  const startedAt = Date.now();

  while (true) {
    onProgress?.(current);
    if (isCompletedExtractionJob(current)) return current;
    if (isFailedExtractionJob(current)) {
      throw new Error(current.error || current.message || "Extraction failed.");
    }

    const now = Date.now();

    // Hard timeout
    if (now - startedAt > MAX_WAIT_MS) {
      throw new Error("Extraction timed out after 20 minutes. The worker may be unavailable.");
    }

    // Stall detection — percent hasn't advanced
    if (current.percent !== lastPercent) {
      lastPercent = current.percent;
      lastProgressAt = now;
    } else if (now - lastProgressAt > STALL_THRESHOLD_MS) {
      onStall?.(current);
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

export function latestExtractionEvent(events: ExtractionProgressEventResponse[]) {
  return events.at(-1) ?? null;
}

export function effectiveExtractionPercent(
  job: ExtractionJobResponse | null,
  events: ExtractionProgressEventResponse[],
  fallbackPercent = 0,
) {
  if (!job) return clampPercent(fallbackPercent);
  const eventPercent = Math.max(0, ...events.map((event) => event.percent));
  const queuedFloor = job.status.toLowerCase() === "queued" ? 10 : 0;
  return clampPercent(Math.max(job.percent, eventPercent, queuedFloor));
}

export function extractionFailureMessage(job: ExtractionJobResponse | null) {
  if (!job || !isFailedExtractionJob(job)) return null;
  return job.error || job.message || "Extraction failed. Please try again.";
}

export function extractionElapsedLabel(
  job: ExtractionJobResponse | null,
  events: ExtractionProgressEventResponse[],
  now: Date = new Date(),
) {
  const startedAt = parseTimestamp(job?.startedAt ?? events[0]?.createdAt ?? null);
  const completedAt = parseTimestamp(
    job?.completedAt ??
      (job && (isCompletedExtractionJob(job) || isFailedExtractionJob(job))
        ? job.updatedAt
        : null) ??
      events.at(-1)?.createdAt ??
      (job ? now.toISOString() : null),
  );
  if (!startedAt || !completedAt || completedAt.getTime() < startedAt.getTime()) return null;
  return formatDuration(completedAt.getTime() - startedAt.getTime());
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp);
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) return `${hours}h ${remainingMinutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
