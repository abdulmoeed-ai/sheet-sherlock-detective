// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AskAiTrigger } from "./AskAiTrigger";

let pathname = "/forecast";

vi.mock("@tanstack/react-router", () => ({
  useRouterState: vi.fn(() => pathname),
}));

vi.mock("@/lib/project-store", () => ({
  setSelectedProjectId: vi.fn(),
  useSelectedProjectId: vi.fn(() => null),
}));

vi.mock("@/lib/sidebar-store", () => ({
  SIDEBAR_COLLAPSED_WIDTH: 64,
  SIDEBAR_WIDTH: 272,
  useSidebarCollapsed: vi.fn(() => false),
}));

vi.mock("@/hooks/use-ask-ai-stream", () => ({
  useAskAiStream: vi.fn(() => ({
    ask: vi.fn(),
  })),
}));

vi.mock("@/hooks/use-ask-ai-sessions", () => ({
  useAskAiSessions: vi.fn(() => ({
    sessions: [],
    loading: false,
    error: null,
    refreshSessions: vi.fn(),
    loadSession: vi.fn(),
    renameSession: vi.fn(),
    deleteSession: vi.fn(),
  })),
}));

vi.mock("@/hooks/use-projects", () => ({
  useWorkspace: vi.fn(() => ({
    data: null,
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
  afterEach(() => {
    cleanup();
    pathname = "/forecast";
  });

  it("lets forecast users open the expanded history sidebar", async () => {
    render(<AskAiTrigger />);

    await waitFor(() => expect(screen.getByLabelText("Toggle history")).not.toBeNull());

    fireEvent.click(screen.getByLabelText("Toggle history"));

    expect(screen.getByText("History")).not.toBeNull();
    expect(screen.getByText("No Ask AI threads yet.")).not.toBeNull();
  });

  it("closes the forecast Ask AI panel when navigating away from forecast", async () => {
    const { rerender } = render(<AskAiTrigger />);

    await waitFor(() => expect(screen.getByLabelText("Toggle history")).not.toBeNull());

    pathname = "/diagnosis/project-1";
    rerender(<AskAiTrigger />);

    await waitFor(() => expect(screen.queryByLabelText("Toggle history")).toBeNull());
    expect(screen.getByLabelText("Open Ask AI")).not.toBeNull();
  });
});
