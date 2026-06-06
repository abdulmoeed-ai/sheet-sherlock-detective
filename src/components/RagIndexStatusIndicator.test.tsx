import { describe, expect, it } from "vitest";
import { ragIndexStatusLabel } from "./RagIndexStatusIndicator";
import type { RagIndexStatusResponse } from "@/lib/api/types";

const baseStatus: RagIndexStatusResponse = {
  projectId: "project-1",
  status: "running",
  readyForAskAi: false,
  stale: false,
  stage: "embedding",
  percent: 35,
  message: "Preparing Ask AI search index.",
  latestJobId: "job-secret",
  embeddingModel: "text-embedding-secret",
  embeddingDim: 1536,
  indexVersion: "index-v1",
  errorCode: null,
  updatedAt: "2026-06-06T12:00:00Z",
};

describe("ragIndexStatusLabel", () => {
  it("labels running and queued status without exposing backend indexing details", () => {
    const label = ragIndexStatusLabel(baseStatus);

    expect(label).toBe("Preparing Ask AI PDF search (35%)");
    expect(label).not.toContain("text-embedding-secret");
    expect(label).not.toContain("1536");
    expect(label).not.toContain("job-secret");
  });

  it("prioritizes ready, stale, failed, and unavailable states", () => {
    expect(ragIndexStatusLabel({ ...baseStatus, status: "ready", readyForAskAi: true })).toBe(
      "Ask AI PDF search ready",
    );
    expect(ragIndexStatusLabel({ ...baseStatus, status: "failed", percent: 0 })).toBe(
      "Ask AI PDF search failed",
    );
    expect(ragIndexStatusLabel({ ...baseStatus, status: "ready", readyForAskAi: false, stale: true })).toBe(
      "Ask AI PDF search updating",
    );
    expect(ragIndexStatusLabel(null)).toBe("Ask AI PDF search status unavailable");
  });
});
