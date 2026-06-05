import { afterEach, describe, expect, it, vi } from "vitest";
import { createDebouncedCallback } from "./debounce";

afterEach(() => {
  vi.useRealTimers();
});

describe("createDebouncedCallback", () => {
  it("runs the latest scheduled call after the debounce delay", () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const debounced = createDebouncedCallback(callback, 100);

    debounced.run("first");
    vi.advanceTimersByTime(60);
    debounced.run("second");
    vi.advanceTimersByTime(99);

    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("second");
  });

  it("cancels pending calls", () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const debounced = createDebouncedCallback(callback, 100);

    debounced.run("pending");
    debounced.cancel();
    vi.advanceTimersByTime(100);

    expect(callback).not.toHaveBeenCalled();
  });
});
