// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AskAiTrigger } from "./AskAiTrigger";

let pathname = "/forecast";
let selectedProjectId: string | null = null;
let sendQuestionMock = vi.fn();
let refreshSessionsMock = vi.fn();
let loadSessionMock = vi.fn();
let mockSessions: Array<{
  kind: "project" | "forecast";
  id: string;
  title: string | null;
  companyName: string | null;
  projectLabel: string | null;
  projectId: string | null;
  routePath: string | null;
  screenName: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}> = [];

vi.mock("@tanstack/react-router", () => ({
  useRouterState: vi.fn(() => pathname),
}));

vi.mock("@/lib/project-store", () => ({
  setSelectedProjectId: vi.fn(),
  useSelectedProjectId: vi.fn(() => selectedProjectId),
}));

vi.mock("@/lib/sidebar-store", () => ({
  SIDEBAR_COLLAPSED_WIDTH: 64,
  SIDEBAR_WIDTH: 272,
  useSidebarCollapsed: vi.fn(() => false),
}));

vi.mock("@/hooks/use-ask-ai-stream", () => ({
  useAskAiStream: vi.fn(() => ({
    sendQuestion: sendQuestionMock,
  })),
}));

vi.mock("@/hooks/use-ask-ai-sessions", () => ({
  useAskAiSessions: vi.fn(() => ({
    sessions: mockSessions,
    loading: false,
    error: null,
    refreshSessions: refreshSessionsMock,
    loadSession: loadSessionMock,
    renameSession: vi.fn(),
    deleteSession: vi.fn(),
  })),
}));

vi.mock("@/hooks/use-projects", () => ({
  useWorkspace: vi.fn(() => ({
    data: selectedProjectId
      ? {
          project: {
            id: selectedProjectId,
            companyName: "Millat Tractors",
            projectLabel: "FY2025",
            fiscalYear: "FY2025",
            sector: "Engineering",
          },
          documents: [],
        }
      : null,
  })),
}));

vi.mock("@/components/DiagnosisSourcePreviewModal", () => ({
  CitationPreviewSidebar: () => null,
}));

vi.mock("@/components/MarkdownContent", () => ({
  MarkdownContent: ({ markdown }: { markdown: string }) => <div>{markdown}</div>,
}));

vi.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));

describe("AskAiTrigger", () => {
  beforeEach(() => {
    selectedProjectId = null;
    sendQuestionMock = vi.fn().mockResolvedValue({
      answer: "Done",
      sessionId: "chat-complete",
      sourcesUsed: [],
      modelCitations: [],
      sourceCitations: [],
      warnings: [],
      usage: {},
    });
    refreshSessionsMock = vi.fn();
    loadSessionMock = vi.fn();
  });

  afterEach(() => {
    cleanup();
    pathname = "/forecast";
    selectedProjectId = null;
    mockSessions = [];
    vi.clearAllMocks();
  });

  it("lets forecast users open the expanded history sidebar", async () => {
    render(<AskAiTrigger />);

    await waitFor(() => expect(screen.getByLabelText("Toggle history")).not.toBeNull());

    fireEvent.click(screen.getByLabelText("Toggle history"));

    expect(screen.getByText("History")).not.toBeNull();
    expect(screen.getByText("No Ask AI threads yet.")).not.toBeNull();
  });

  it("keeps forecast history row actions out of the title layout until hover or focus", async () => {
    mockSessions = [
      {
        kind: "forecast",
        id: "forecast-chat-1",
        title: "Give me 5 year forecasting assumptions",
        companyName: null,
        projectLabel: null,
        projectId: null,
        routePath: "/forecast",
        screenName: "Forecast",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 2,
      },
    ];

    render(<AskAiTrigger />);

    fireEvent.click(await screen.findByLabelText("Toggle history"));

    const titleButton = screen.getByRole("button", {
      name: /Give me 5 year forecasting assumptions/i,
    });
    const row = titleButton.parentElement;
    const actions = row?.querySelector(".absolute");

    expect(row?.className).toContain("relative");
    expect(titleButton.className).toContain("w-full");
    expect(actions?.className).toContain("pointer-events-none");
    expect(actions?.className).toContain("group-hover:pointer-events-auto");
  });

  it("closes the forecast Ask AI panel when navigating away from forecast", async () => {
    const { rerender } = render(<AskAiTrigger />);

    await waitFor(() => expect(screen.getByLabelText("Toggle history")).not.toBeNull());

    pathname = "/diagnosis/project-1";
    rerender(<AskAiTrigger />);

    await waitFor(() => expect(screen.queryByLabelText("Toggle history")).toBeNull());
    expect(screen.getByLabelText("Open Ask AI")).not.toBeNull();
  });

  it("keeps an in-flight Ask AI response running when the panel is closed", async () => {
    pathname = "/diagnosis/project-1";
    selectedProjectId = "project-1";
    let capturedSignal: AbortSignal | undefined;
    sendQuestionMock = vi.fn((_input, _callbacks, options) => {
      capturedSignal = options.signal;
      return new Promise(() => undefined);
    });

    render(<AskAiTrigger />);

    const launcher = screen.getByLabelText("Open Ask AI");
    fireEvent.pointerDown(launcher, { clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(launcher, { clientY: 300, pointerId: 1 });
    fireEvent.change(screen.getByLabelText("Ask AI prompt"), {
      target: { value: "Explain revenue" },
    });
    fireEvent.click(screen.getByLabelText("Send Ask AI prompt"));

    await waitFor(() => expect(sendQuestionMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByLabelText("Close Ask AI"));

    expect(capturedSignal?.aborted).toBe(false);
    expect(screen.getByLabelText("Open Ask AI")).not.toBeNull();
  });

  it("marks the loaded Ask AI thread in history", async () => {
    const now = new Date().toISOString();
    mockSessions = [
      {
        kind: "forecast",
        id: "forecast-chat-1",
        title: "Forecast assumptions",
        companyName: null,
        projectLabel: null,
        projectId: null,
        routePath: "/forecast",
        screenName: "Forecast",
        createdAt: now,
        updatedAt: now,
        messageCount: 2,
      },
    ];
    loadSessionMock = vi.fn().mockResolvedValue({
      ...mockSessions[0],
      messages: [],
    });

    render(<AskAiTrigger />);

    fireEvent.click(await screen.findByLabelText("Toggle history"));
    fireEvent.click(screen.getByRole("button", { name: /Forecast assumptions/i }));

    await waitFor(() => expect(screen.queryByText("History")).toBeNull());
    fireEvent.click(screen.getByLabelText("Toggle history"));

    const loadedThread = await screen.findByRole("button", { name: /Forecast assumptions/i });

    expect(loadedThread.getAttribute("aria-current")).toBe("true");
    expect(screen.queryByText("Current thread")).toBeNull();
  });

  it("shows a newly sent Ask AI message in history immediately", async () => {
    render(<AskAiTrigger />);

    fireEvent.change(screen.getByLabelText("Ask AI prompt"), {
      target: { value: "Can you please give me the analysis of revenue?" },
    });
    fireEvent.click(screen.getByLabelText("Send Ask AI prompt"));

    await waitFor(() => expect(sendQuestionMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByLabelText("Toggle history"));

    const draftThread = screen.getByRole("button", {
      name: /Can you please give me the analysis of revenue/i,
    });
    expect(draftThread.getAttribute("aria-current")).toBe("true");
  });
});
