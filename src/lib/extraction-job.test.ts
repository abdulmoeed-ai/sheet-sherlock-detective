import { describe, expect, it, vi } from "vitest";
import {
  effectiveExtractionPercent,
  extractionElapsedLabel,
  extractionFailureMessage,
  latestExtractionEvent,
  mergeExtractionEvents,
  waitForExtractionCompletion,
} from "./extraction-job";
import type { ExtractionJobResponse, ExtractionProgressEventResponse } from "./api/types";

function job(status: string, overrides: Partial<ExtractionJobResponse> = {}): ExtractionJobResponse {
  return {
    id: "job-1",
    projectId: "project-1",
    status,
    percent: status === "completed" ? 100 : 50,
    message: status,
    documentIds: [],
    error: null,
    createdAt: null,
    updatedAt: null,
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

describe("waitForExtractionCompletion", () => {
  it("polls a queued extraction job until the backend reports completion", async () => {
    const readJob = vi
      .fn()
      .mockResolvedValueOnce(job("running"))
      .mockResolvedValueOnce(job("completed"));

    const result = await waitForExtractionCompletion({
      projectId: "project-1",
      initialJob: job("queued"),
      readJob,
      delayMs: 0,
    });

    expect(result.status).toBe("completed");
    expect(readJob).toHaveBeenCalledTimes(2);
    expect(readJob).toHaveBeenNthCalledWith(1, "project-1", "job-1");
  });

  it("rejects when the extraction job fails before completion", async () => {
    await expect(
      waitForExtractionCompletion({
        projectId: "project-1",
        initialJob: job("failed", { error: "PDF parse failed" }),
        readJob: vi.fn(),
        delayMs: 0,
      }),
    ).rejects.toThrow("PDF parse failed");
  });

  it("reports the initial and polled job progress", async () => {
    const onProgress = vi.fn();

    await waitForExtractionCompletion({
      projectId: "project-1",
      initialJob: job("queued", { percent: 0, message: "Extraction queued." }),
      readJob: vi.fn().mockResolvedValueOnce(job("completed", { percent: 100, message: "Done." })),
      delayMs: 0,
      onProgress,
    });

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ status: "queued", percent: 0 }),
    );
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed", percent: 100 }),
    );
  });
});

function event(
  eventId: string,
  createdAt: string,
  overrides: Partial<ExtractionProgressEventResponse> = {},
): ExtractionProgressEventResponse {
  return {
    eventId,
    projectId: "project-1",
    jobId: "job-1",
    documentId: null,
    documentFilename: null,
    stage: "queued",
    status: "pending",
    percent: 0,
    title: "Queued",
    message: "Extraction queued.",
    ruleCodes: [],
    cellRef: null,
    sheetName: null,
    confidenceLevel: null,
    details: {},
    createdAt,
    ...overrides,
  };
}

describe("mergeExtractionEvents", () => {
  it("deduplicates replayed backend events and keeps timeline order", () => {
    const merged = mergeExtractionEvents(
      [event("event-2", "2026-06-04T10:00:02.000Z")],
      [
        event("event-1", "2026-06-04T10:00:01.000Z"),
        event("event-2", "2026-06-04T10:00:02.000Z", { message: "Updated replay row" }),
      ],
    );

    expect(merged.map((item) => item.eventId)).toEqual(["event-1", "event-2"]);
    expect(merged[1].message).toBe("Updated replay row");
  });
});

describe("extraction progress helpers", () => {
  it("uses backend event percent instead of upload completion fallback for queued jobs", () => {
    expect(effectiveExtractionPercent(job("queued", { percent: 0 }), [], 100)).toBe(10);
    expect(
      effectiveExtractionPercent(
        job("queued", { percent: 0 }),
        [event("event-1", "2026-06-04T10:00:01.000Z", { percent: 35 })],
        100,
      ),
    ).toBe(35);
  });

  it("returns latest event and user-facing failure message", () => {
    const events = [
      event("event-1", "2026-06-04T10:00:01.000Z"),
      event("event-2", "2026-06-04T10:00:02.000Z", { message: "Parsing failed." }),
    ];

    expect(latestExtractionEvent(events)?.eventId).toBe("event-2");
    expect(extractionFailureMessage(job("failed", { error: "PDF parse failed" }))).toBe(
      "PDF parse failed",
    );
  });

  it("formats elapsed extraction time from backend job timestamps", () => {
    expect(
      extractionElapsedLabel(
        job("completed", {
          startedAt: "2026-06-04T10:00:00.000Z",
          completedAt: "2026-06-04T10:02:05.000Z",
        }),
        [],
      ),
    ).toBe("2m 5s");
  });

  it("falls back to event timestamps for elapsed extraction time", () => {
    expect(
      extractionElapsedLabel(null, [
        event("event-1", "2026-06-04T10:00:00.000Z"),
        event("event-2", "2026-06-04T10:00:07.000Z"),
      ]),
    ).toBe("7s");
  });
});
