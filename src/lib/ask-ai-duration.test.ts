import { describe, expect, it } from "vitest";
import { formatAskAiElapsedTime } from "@/lib/ask-ai-duration";

describe("formatAskAiElapsedTime", () => {
  it("formats sub-minute elapsed time in seconds", () => {
    expect(formatAskAiElapsedTime(0)).toBe("0.0s");
    expect(formatAskAiElapsedTime(4200)).toBe("4.2s");
    expect(formatAskAiElapsedTime(59900)).toBe("59.9s");
  });

  it("formats minute-plus elapsed time with padded seconds", () => {
    expect(formatAskAiElapsedTime(60000)).toBe("1m 00s");
    expect(formatAskAiElapsedTime(65000)).toBe("1m 05s");
    expect(formatAskAiElapsedTime(125000)).toBe("2m 05s");
  });

  it("clamps invalid elapsed time to zero seconds", () => {
    expect(formatAskAiElapsedTime(-1000)).toBe("0.0s");
    expect(formatAskAiElapsedTime(Number.NaN)).toBe("0.0s");
    expect(formatAskAiElapsedTime(Number.POSITIVE_INFINITY)).toBe("0.0s");
  });
});
