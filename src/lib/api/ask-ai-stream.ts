export type AskAiForecastChartPoint = {
  label: string;
  value: number;
};

export type AskAiForecastChartSeries = {
  id: string;
  title: string;
  metric: "revenue" | "eps" | "share_price" | "pe_vs_sector" | string;
  points: AskAiForecastChartPoint[];
};

export type AskAiRiskCallout = {
  label: string;
  severity: "High" | "Medium" | "Low";
};

export type AskAiForecastAssumptionPill = {
  label: string;
  value?: string;
};

export type AskAiForecastVisuals = {
  executiveSummary?: string[];
  chartSeries: AskAiForecastChartSeries[];
  assumptionPills: AskAiForecastAssumptionPill[];
  riskCallouts: AskAiRiskCallout[];
  confidence?: string;
};

export type AskAiClaimSourceGroup = {
  claimId: string;
  citationIndexes: number[];
};

export type AskAiForecastHistoricalSeriesItem = {
  period: string;
  value: number;
  citationIndexes: number[];
  treatment: "included" | "excluded" | "review";
  reason?: string;
};

export type AskAiForecastCagrResult = {
  label: string;
  startPeriod: string;
  endPeriod: string;
  value: number;
  basis: "reported" | "normalized" | "trendline" | "volume" | "nominal" | string;
};

export type AskAiForecastNormalizedBase = {
  mean?: number;
  median?: number;
  selectedValue?: number;
  citationIndexes: number[];
};

export type AskAiForecastScenarioRow = {
  scenario: string;
  values: Record<string, number | string>;
  basis: string;
  citationIndexes: number[];
};

export type AskAiForecastSet = {
  kind: "trend_only" | "cycle_recovery" | string;
  points: Record<string, number>;
  basis: string;
};

export type AskAiForecastAssumption = {
  label: string;
  value: string;
  scenario?: string;
  citationIndexes: number[];
};

export type AskAiForecastAnalysis = {
  mode?: string;
  metric?: string;
  unit?: string;
  forecastHorizon?: number;
  historicalSeries: AskAiForecastHistoricalSeriesItem[];
  cagrResults: AskAiForecastCagrResult[];
  normalizedBase?: AskAiForecastNormalizedBase;
  scenarioTable: AskAiForecastScenarioRow[];
  forecastSets: AskAiForecastSet[];
  assumptions: AskAiForecastAssumption[];
  missingInputs: string[];
};

export type AskAiFinalResponse = {
  answer: string;
  sessionId?: string | null;
  requestMode?: string | null;
  elapsedMs?: number;
  sourcesUsed: Array<Record<string, unknown>>;
  modelCitations: Array<Record<string, unknown>>;
  sourceCitations: Array<Record<string, unknown>>;
  warnings: string[];
  usage: Record<string, unknown>;
  activityLog?: Array<Record<string, unknown>>;
  forecastVisuals?: AskAiForecastVisuals | null;
  forecastAnalysis?: AskAiForecastAnalysis | null;
  claimSourceGroups?: AskAiClaimSourceGroup[];
  tavilyQuestions?: string[];
};

export type AskAiStatusEvent = {
  stage: "context" | "retrieval" | "web" | "llm" | "finalizing" | string;
  message: string;
  percent: number;
};

export type AskAiSourceEvent = {
  kind: "model" | "uploaded_pdf" | "uploaded_sheet" | "source_registry" | "web" | string;
  message: string;
  count: number;
  items: Array<Record<string, unknown>>;
  queries?: string[];
};

export type AskAiApproachEvent = {
  summary: string;
};

export type AskAiTokenEvent = {
  delta: string;
};

export type AskAiErrorEvent = {
  message: string;
  code?: string;
};

export type ParsedSseEvent = {
  type: string;
  payload: Record<string, unknown>;
};

export type AskAiStreamCallbacks = {
  onStatus?: (event: AskAiStatusEvent) => void;
  onSource?: (event: AskAiSourceEvent) => void;
  onApproach?: (event: AskAiApproachEvent) => void;
  onToken?: (event: AskAiTokenEvent) => void;
  onFinal?: (event: AskAiFinalResponse) => void;
  onError?: (event: AskAiErrorEvent) => void;
  onChunk?: (answer: string) => void;
};

export async function readAskAiSseStream(
  response: Response,
  callbacks: AskAiStreamCallbacks = {},
): Promise<AskAiFinalResponse | null> {
  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    throw new Error("Ask AI requires a streaming response.");
  }

  const reader = response.body?.getReader();
  if (!reader) return null;

  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
  let finalResponse: AskAiFinalResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    const result = dispatchSseEvents(parts, callbacks, answer);
    answer = result.answer;
    finalResponse = result.finalResponse ?? finalResponse;
    if (result.terminalError) {
      await reader.cancel();
      return null;
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    const result = dispatchSseEvents([buffer], callbacks, answer);
    answer = result.answer;
    finalResponse = result.finalResponse ?? finalResponse;
    if (result.terminalError) return null;
  }

  return finalResponse;
}

export function parseSseEvents(chunks: string[]): ParsedSseEvent[] {
  return chunks
    .join("")
    .split("\n\n")
    .map((block) => parseSseBlock(block))
    .filter((event): event is ParsedSseEvent => event !== null);
}

function dispatchSseEvents(
  blocks: string[],
  callbacks: AskAiStreamCallbacks,
  currentAnswer: string,
): { answer: string; finalResponse: AskAiFinalResponse | null; terminalError: boolean } {
  let answer = currentAnswer;
  let finalResponse: AskAiFinalResponse | null = null;
  let terminalError = false;

  for (const event of blocks.map((block) => parseSseBlock(block))) {
    if (!event) continue;
    if (event.type === "status") {
      callbacks.onStatus?.(event.payload as AskAiStatusEvent);
    } else if (event.type === "source") {
      callbacks.onSource?.(event.payload as AskAiSourceEvent);
    } else if (event.type === "approach") {
      callbacks.onApproach?.(event.payload as AskAiApproachEvent);
    } else if (event.type === "token") {
      const token = event.payload as AskAiTokenEvent;
      answer += token.delta ?? "";
      callbacks.onToken?.(token);
      callbacks.onChunk?.(answer);
    } else if (event.type === "final") {
      finalResponse = event.payload as AskAiFinalResponse;
      answer = finalResponse.answer ?? answer;
      callbacks.onFinal?.(finalResponse);
      callbacks.onChunk?.(answer);
    } else if (event.type === "error") {
      callbacks.onError?.(event.payload as AskAiErrorEvent);
      terminalError = true;
      break;
    }
  }

  return { answer, finalResponse, terminalError };
}

function parseSseBlock(block: string): ParsedSseEvent | null {
  const lines = block.split(/\r?\n/);
  let type = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      type = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (dataLines.length === 0) return null;
  return { type, payload: JSON.parse(dataLines.join("\n")) as Record<string, unknown> };
}
