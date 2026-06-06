import { describe, expect, it } from "vitest";
import { ragStatusRefetchInterval } from "./use-rag-index-status";

describe("ragStatusRefetchInterval", () => {
  it("keeps polling before the RAG job row exists and while indexing is active", () => {
    expect(ragStatusRefetchInterval(undefined)).toBe(5000);
    expect(ragStatusRefetchInterval("not_indexed")).toBe(5000);
    expect(ragStatusRefetchInterval("queued")).toBe(5000);
    expect(ragStatusRefetchInterval("running")).toBe(5000);
    expect(ragStatusRefetchInterval("stale")).toBe(5000);
  });

  it("stops polling only after terminal RAG status states", () => {
    expect(ragStatusRefetchInterval("ready")).toBe(false);
    expect(ragStatusRefetchInterval("failed")).toBe(false);
  });
});
