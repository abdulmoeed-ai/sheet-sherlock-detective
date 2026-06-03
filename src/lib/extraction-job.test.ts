import { describe, expect, it, vi } from "vitest";
import { waitForExtractionCompletion } from "./extraction-job";
import type { ExtractionJobResponse } from "./api/types";

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
