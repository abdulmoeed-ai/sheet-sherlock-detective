import { describe, expect, it } from "bun:test";
import { cycleStore } from "../src/lib/cycle-store";

describe("cycle store document context", () => {
  it("tracks uploaded document ids for Ask Sherlock and clears them on reset", () => {
    cycleStore.reset();

    cycleStore.setProjectId("project-1");
    cycleStore.addDocumentId(" document-1 ");
    cycleStore.addDocumentId("");
    cycleStore.addDocumentId("document-1");
    cycleStore.addDocumentId("document-2");

    expect(cycleStore.get().documentIds).toEqual(["document-1", "document-2"]);

    cycleStore.reset();

    expect(cycleStore.get().documentIds).toEqual([]);
  });
});
