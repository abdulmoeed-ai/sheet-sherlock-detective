export function formatAskAiElapsedTime(elapsedMs: number): string {
  const safeElapsedMs = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const elapsedSeconds = safeElapsedMs / 1000;

  if (elapsedSeconds < 60) {
    return `${elapsedSeconds.toFixed(1)}s`;
  }

  const totalSeconds = Math.floor(elapsedSeconds);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}
