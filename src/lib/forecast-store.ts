import type { ForecastRunResponse } from "@/lib/api/types";

const FORECAST_PREFIX = "sheet_sherlock_forecast:";

export function getStoredForecast(projectId: string): ForecastRunResponse | null {
  try {
    const raw = window.localStorage.getItem(`${FORECAST_PREFIX}${projectId}`);
    return raw ? (JSON.parse(raw) as ForecastRunResponse) : null;
  } catch {
    return null;
  }
}

export function setStoredForecast(projectId: string, forecast: ForecastRunResponse) {
  window.localStorage.setItem(`${FORECAST_PREFIX}${projectId}`, JSON.stringify(forecast));
}
