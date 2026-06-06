import { describe, expect, it } from "vitest";
import { clampPage, pageCountFor, paginateItems, visiblePageRange } from "./pagination";

describe("pagination helpers", () => {
  it("uses one page for empty or short listings", () => {
    expect(pageCountFor(0)).toBe(1);
    expect(pageCountFor(10)).toBe(1);
  });

  it("counts an extra page when records exceed the page size", () => {
    expect(pageCountFor(11)).toBe(2);
    expect(pageCountFor(25)).toBe(3);
  });

  it("clamps requested pages into the available range", () => {
    expect(clampPage(-4, 25)).toBe(1);
    expect(clampPage(99, 25)).toBe(3);
    expect(clampPage(Number.NaN, 25)).toBe(1);
  });

  it("returns the requested page slice", () => {
    const items = Array.from({ length: 25 }, (_, index) => index + 1);
    expect(paginateItems(items, 2)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  it("reports visible row numbers for the current page", () => {
    expect(visiblePageRange(3, 25)).toEqual({ from: 21, to: 25 });
    expect(visiblePageRange(1, 0)).toEqual({ from: 0, to: 0 });
  });
});
