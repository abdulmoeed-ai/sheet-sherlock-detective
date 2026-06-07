import { useState, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  Sparkles,
  X,
  Send,
  Square,
  Check,
  Loader2,
  ChevronDown,
  ChevronRight,
  Copy,
  Paperclip,
  FileText as FileIcon,
  Maximize2,
  Minimize2,
  Database,
  History,
  Plus,
  ExternalLink,
  Clock,
  TableProperties,
  Pencil,
  Trash2,
} from "lucide-react";
import { setSelectedProjectId, useSelectedProjectId } from "@/lib/project-store";
import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_WIDTH,
  useSidebarCollapsed,
} from "@/lib/sidebar-store";
import { useAskAiStream } from "@/hooks/use-ask-ai-stream";
import { useAskAiSessions } from "@/hooks/use-ask-ai-sessions";
import { useWorkspace } from "@/hooks/use-projects";
import { MarkdownContent } from "@/components/MarkdownContent";
import { ProductWordmark } from "@/components/ProductWordmark";
import {
  CitationPreviewSidebar,
  type DiagnosisSourcePreview,
} from "@/components/DiagnosisSourcePreviewModal";
import { IconTooltip } from "@/components/IconTooltip";
import {
  ASK_AI_PROMPT_MIN_HEIGHT,
  getAskAiPromptKeyAction,
  getAskAiPromptTextareaLayout,
} from "@/lib/ask-ai-input";
import {
  askAiSuggestionsForRoute,
  buildAskAiContextChips,
  buildAskAiSubtitleParts,
  shouldUseProjectContextForRoute,
} from "@/lib/ask-ai-context";
import {
  buildNoProjectAskAiResponse,
  isWorkbookInventoryQuestion,
} from "@/lib/ask-ai-empty-context";
import { listAskAiWorkbooks, searchAskAiModels } from "@/lib/api/projects";
import {
  buildModelSelectionPrompt,
  buildWorkbookInventoryPrompt,
  isConfidentSingleModelMatch,
  matchModelSelection,
  shouldSearchModelsBeforeAskAi,
  workbookInventoryToModelCandidates,
} from "@/lib/ask-ai-model-selection";
import { buildAskAiRequestPayload } from "@/lib/ask-ai-request";
import {
  getAskAiCitationPillLabel,
  getAskAiCitationPreview,
  getAskAiCitationTitle,
  type AskAiCitationPreview,
} from "@/lib/ask-ai-citations";
import { buildAskAiReasoningSummary } from "@/lib/ask-ai-reasoning";
import { normalizeForecastAnalysis, normalizeForecastVisuals } from "@/lib/ask-ai-forecast";
import { askAiRouteModeForPath } from "@/lib/ask-ai-route-mode";
import { askAiSessionToMessages } from "@/lib/ask-ai-threads";
import { markAskAiStreamStopped } from "@/lib/ask-ai-stop";
import { clearLegacyAskAiChatHistoryStorage } from "@/lib/ask-ai-storage";
import { askAiTokenUsageLabel } from "@/lib/ask-ai-usage";
import { userFacingAskAiWarnings } from "@/lib/ask-ai-warnings";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { AskAiMsg as Msg } from "@/lib/ask-ai-message-types";
import type { AskAiChatSessionSummary } from "@/lib/api/types";
import type { AskAiModelCandidate } from "@/lib/api/types";
import type {
  AskAiClaimSourceGroup,
  AskAiFinalResponse,
  AskAiForecastAnalysis,
  AskAiForecastVisuals,
  AskAiSourceEvent,
  AskAiStatusEvent,
} from "@/lib/api/ask-ai-stream";

type ExternalSourcePreview = {
  title: string;
  url: string;
  excerpt: string;
  meta: string;
};

type HistoryDialogState =
  | { type: "rename"; chat: AskAiChatSessionSummary }
  | { type: "delete"; chat: AskAiChatSessionSummary }
  | null;

type PendingModelSelection = {
  question: string | null;
  candidates: AskAiModelCandidate[];
};

export function AskAiTrigger() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const [previewSource, setPreviewSource] = useState<DiagnosisSourcePreview | null>(null);
  const [externalPreviewSource, setExternalPreviewSource] = useState<ExternalSourcePreview | null>(
    null,
  );
  const [historyDialog, setHistoryDialog] = useState<HistoryDialogState>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [historyDialogBusy, setHistoryDialogBusy] = useState(false);
  const [historyDialogError, setHistoryDialogError] = useState<string | null>(null);
  const [buttonY, setButtonY] = useState<number | null>(null);
  const [activeSession, setActiveSession] = useState<AskAiChatSessionSummary | null>(null);
  const [modelProjectContext, setModelProjectContext] = useState<AskAiModelCandidate | null>(null);
  const [pendingModelSelection, setPendingModelSelection] = useState<PendingModelSelection | null>(
    null,
  );

  const routePath = useRouterState({ select: (s) => s.location.pathname });
  const routeMode = askAiRouteModeForPath(routePath);
  const selectedProjectId = useSelectedProjectId();
  const routeProjectId = shouldUseProjectContextForRoute(routePath) ? selectedProjectId : null;
  const activeProjectId = activeSession?.projectId ?? modelProjectContext?.id ?? routeProjectId;
  const activeRoutePath = routeMode.isForecastRoute ? routePath : activeSession?.routePath ?? routePath;
  const activeScreenName = routeMode.isForecastRoute
    ? screenNameForPath(routePath)
    : activeSession?.screenName ?? screenNameForPath(routePath);
  const sidebarCollapsed = useSidebarCollapsed();
  const askAi = useAskAiStream(activeProjectId);
  const sessionsApi = useAskAiSessions();
  const workspace = useWorkspace(activeProjectId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activeStreamIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const chatSessionIdRef = useRef(`chat-${Date.now()}`);
  const dragStateRef = useRef({ dragging: false, startY: 0, startButtonY: 0 });

  const isDiagnosisRoute = routePath.startsWith("/diagnosis/");
  const panelOpen = routeMode.forceOpen || open;
  const panelExpanded = routeMode.forceExpanded || expanded;
  const suggestions = askAiSuggestionsForRoute(routePath);

  const clearActiveStream = () => {
    abortControllerRef.current = null;
    activeStreamIdRef.current = null;
    setAsking(false);
  };

  const stopActiveStream = () => {
    const streamId = activeStreamIdRef.current;
    if (!streamId) return;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    activeStreamIdRef.current = null;
    setMessages((messages) => markAskAiStreamStopped(messages, streamId));
    setAsking(false);
  };

  const closeAskAiPanel = () => {
    if (routeMode.isForecastRoute) return;
    if (activeStreamIdRef.current) {
      stopActiveStream();
    } else {
      clearActiveStream();
    }
    setPreviewSource(null);
    setExternalPreviewSource(null);
    setShowHistory(false);
    setOpen(false);
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, panelOpen]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = `${ASK_AI_PROMPT_MIN_HEIGHT}px`;
    const layout = getAskAiPromptTextareaLayout(textarea.scrollHeight);
    textarea.style.height = `${layout.height}px`;
    textarea.style.overflowY = layout.overflowY;
  }, [input, open]);

  useEffect(() => () => clearActiveStream(), []);

  useEffect(() => {
    clearLegacyAskAiChatHistoryStorage();
  }, []);

  useEffect(() => {
    if (panelOpen) void sessionsApi.refreshSessions();
  }, [panelOpen]);

  useEffect(() => {
    if (!routeMode.forceOpen) return;
    setOpen(true);
    setExpanded(true);
  }, [routeMode.forceOpen, routePath]);

  const contextChips = buildAskAiContextChips({
    company: activeSession?.companyName ?? workspace.data?.project.companyName,
    period: activeSession?.projectLabel ?? workspace.data?.project.fiscalYear,
    sector: workspace.data?.project.sector,
    documentCount: workspace.data?.documents.length,
    isDiagnosis: isDiagnosisRoute,
    screenName: activeScreenName,
  });
  const subtitleParts = buildAskAiSubtitleParts({
    company: activeSession?.companyName ?? workspace.data?.project.companyName,
    screenName: activeScreenName,
    period: activeSession?.projectLabel ?? workspace.data?.project.fiscalYear,
  });
  const expandedLeft = sidebarCollapsed
    ? routeMode.reserveSidebar
      ? SIDEBAR_COLLAPSED_WIDTH
      : 0
    : SIDEBAR_WIDTH;

  const startNewChat = () => {
    setMessages([]);
    setInput("");
    setShowHistory(false);
    setActiveSession(null);
    setModelProjectContext(null);
    setPendingModelSelection(null);
    chatSessionIdRef.current = `chat-${Date.now()}`;
  };

  const loadChat = async (chat: AskAiChatSessionSummary) => {
    const session = await sessionsApi.loadSession(chat.id);
    setMessages(askAiSessionToMessages(session));
    chatSessionIdRef.current = session.id;
    setActiveSession(session);
    setModelProjectContext(null);
    setPendingModelSelection(null);
    setShowHistory(false);
  };

  const closeHistoryDialog = () => {
    if (historyDialogBusy) return;
    setHistoryDialog(null);
    setHistoryDialogError(null);
  };

  const openRenameChatDialog = (chat: AskAiChatSessionSummary) => {
    setRenameTitle(chat.title || "Untitled Ask AI thread");
    setHistoryDialogError(null);
    setHistoryDialog({ type: "rename", chat });
  };

  const openDeleteChatDialog = (chat: AskAiChatSessionSummary) => {
    setHistoryDialogError(null);
    setHistoryDialog({ type: "delete", chat });
  };

  const confirmRenameChat = async () => {
    if (historyDialog?.type !== "rename") return;
    const title = renameTitle.trim();
    if (!title) {
      setHistoryDialogError("Enter a thread name before saving.");
      return;
    }
    setHistoryDialogBusy(true);
    setHistoryDialogError(null);
    try {
      const updated = await sessionsApi.renameSession(historyDialog.chat.id, title);
      if (activeSession?.id === updated.id) setActiveSession(updated);
      await sessionsApi.refreshSessions();
      setHistoryDialog(null);
    } catch (error) {
      setHistoryDialogError(
        error instanceof Error ? error.message : "Could not rename this thread.",
      );
    } finally {
      setHistoryDialogBusy(false);
    }
  };

  const confirmDeleteChat = async () => {
    if (historyDialog?.type !== "delete") return;
    const chat = historyDialog.chat;
    setHistoryDialogBusy(true);
    setHistoryDialogError(null);
    try {
      await sessionsApi.deleteSession(chat.id);
      if (activeSession?.id === chat.id) startNewChat();
      await sessionsApi.refreshSessions();
      setHistoryDialog(null);
    } catch (error) {
      setHistoryDialogError(
        error instanceof Error ? error.message : "Could not delete this thread.",
      );
    } finally {
      setHistoryDialogBusy(false);
    }
  };

  useEffect(() => {
    if (!historyDialog || historyDialogBusy) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeHistoryDialog();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [historyDialog, historyDialogBusy]);

  // Draggable button handlers
  const handleButtonPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const currentY = buttonY ?? window.innerHeight / 2;
    dragStateRef.current = { dragging: false, startY: e.clientY, startButtonY: currentY };
  };

  const handleButtonPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const dy = e.clientY - dragStateRef.current.startY;
    if (!dragStateRef.current.dragging && Math.abs(dy) < 5) return;
    dragStateRef.current.dragging = true;
    const newY = Math.max(
      48,
      Math.min(window.innerHeight - 48, dragStateRef.current.startButtonY + dy),
    );
    setButtonY(newY);
  };

  const handleButtonPointerUp = () => {
    if (!dragStateRef.current.dragging) {
      setOpen(true);
    }
    dragStateRef.current.dragging = false;
  };

  const onPickFile = (file: File) => {
    const sizeKB = (file.size / 1024).toFixed(0);
    setMessages((m) => [
      ...m,
      {
        id: `u-${Date.now()}`,
        role: "user",
        text: "Use this PDF as project evidence.",
        attachment: { name: file.name, size: `${sizeKB} KB` },
      },
      {
        id: `a-${Date.now()}`,
        role: "ai",
        kind: "text",
        text: "PDF uploads are handled by the project upload flow. Once the document is indexed, Ask Sherlock will cite it from the backend evidence stream.",
      },
    ]);
  };

  const send = async (text: string) => {
    if (!text.trim()) return;
    if (asking) return;
    clearActiveStream();
    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", text };
    setMessages((m) => [...m, userMsg]);
    setInput("");

    let modelOverride: AskAiModelCandidate | null = null;
    if (pendingModelSelection && !activeProjectId) {
      const selected = matchModelSelection(text, pendingModelSelection.candidates);
      if (!selected) {
        setMessages((m) => [
          ...m,
          {
            id: `a-${Date.now()}`,
            role: "ai",
            kind: "text",
            text: "I could not match that to one of the listed models. Please type the number or model name.",
          },
        ]);
        return;
      }
      modelOverride = selected;
      setPendingModelSelection(null);
      setModelProjectContext(selected);
      setActiveSession(null);
      setSelectedProjectId(selected.id);
      if (!pendingModelSelection.question) {
        setMessages((m) => [
          ...m,
          {
            id: `a-${Date.now()}`,
            role: "ai",
            kind: "text",
            text: `Opened ${selected.companyName}. Ask a question and I will use that workbook with citations.`,
          },
        ]);
        return;
      }
      text = pendingModelSelection.question;
    } else if (!activeProjectId && isWorkbookInventoryQuestion(text)) {
      try {
        const result = await listAskAiWorkbooks();
        const candidates = workbookInventoryToModelCandidates(result.items);
        if (candidates.length > 0) {
          setPendingModelSelection({ question: null, candidates });
        }
        setMessages((m) => [
          ...m,
          {
            id: `a-${Date.now()}`,
            role: "ai",
            kind: "text",
            text: buildWorkbookInventoryPrompt(result.items),
          },
        ]);
      } catch (error) {
        setMessages((m) => [
          ...m,
          {
            id: `a-${Date.now()}`,
            role: "ai",
            kind: "text",
            text:
              error instanceof Error
                ? `I could not check your workbooks: ${error.message}`
                : "I could not check your workbooks.",
          },
        ]);
      }
      return;
    } else if (!activeProjectId && shouldSearchModelsBeforeAskAi(text)) {
      try {
        const result = await searchAskAiModels({ query: text });
        if (result.candidates.length > 0) {
          if (!isConfidentSingleModelMatch(result.candidates)) {
            setPendingModelSelection({ question: text, candidates: result.candidates });
            setMessages((m) => [
              ...m,
              {
                id: `a-${Date.now()}`,
                role: "ai",
                kind: "text",
                text: buildModelSelectionPrompt(result.candidates),
              },
            ]);
            return;
          }
          modelOverride = result.candidates[0];
          setModelProjectContext(modelOverride);
          setActiveSession(null);
          setSelectedProjectId(modelOverride.id);
        }
      } catch (error) {
        setMessages((m) => [
          ...m,
          {
            id: `a-${Date.now()}`,
            role: "ai",
            kind: "text",
            text:
              error instanceof Error
                ? `I could not search available finance models: ${error.message}`
                : "I could not search available finance models.",
          },
        ]);
        return;
      }
    }

    const effectiveProjectId = modelOverride?.id ?? activeProjectId;
    if (!effectiveProjectId && !routeMode.isForecastRoute) {
      setMessages((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: "ai",
          kind: "text",
          text: buildNoProjectAskAiResponse(text),
        },
      ]);
      return;
    }

    setAsking(true);
    const aiId = `a-${Date.now()}`;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    activeStreamIdRef.current = aiId;
    setMessages((m) => [
      ...m,
      { id: aiId, role: "ai", kind: "stream", text: "", activity: [], approaches: [], done: false },
    ]);

    try {
      let streamError = false;
      const requestProject =
        modelOverride ??
        (workspace.data?.project
          ? {
              companyName: activeSession?.companyName ?? workspace.data.project.companyName,
              projectLabel: activeSession?.projectLabel ?? workspace.data.project.projectLabel,
              fiscalYear: workspace.data.project.fiscalYear,
            }
          : activeSession
            ? {
                companyName: activeSession.companyName,
                projectLabel: activeSession.projectLabel,
                fiscalYear: null,
              }
            : null);
      const final = await askAi.sendQuestion(
        buildAskAiRequestPayload({
          question: text,
          sessionId: chatSessionIdRef.current,
          routePath: activeRoutePath,
          screenName: activeScreenName,
          documents: modelOverride ? [] : workspace.data?.documents,
          project: requestProject,
        }),
        {
          onStatus: (event) => updateStreamMessage(aiId, { type: "status", event }),
          onSource: (event) => updateStreamMessage(aiId, { type: "source", event }),
          onApproach: (event) =>
            updateStreamMessage(aiId, { type: "approach", summary: event.summary }),
          onToken: (event) => updateStreamMessage(aiId, { type: "token", delta: event.delta }),
          onFinal: (event) => {
            if (event.sessionId) chatSessionIdRef.current = event.sessionId;
            updateStreamMessage(aiId, { type: "final", final: event });
          },
          onError: (event) => {
            streamError = true;
            updateStreamMessage(aiId, { type: "error", message: event.message });
          },
        },
        { projectIdOverride: modelOverride?.id, signal: abortController.signal },
      );
      if (!final && !streamError && activeStreamIdRef.current === aiId) {
        updateStreamMessage(aiId, {
          type: "error",
          message: "Ask AI did not return a final answer.",
        });
      }
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
      if (activeStreamIdRef.current === aiId) {
        activeStreamIdRef.current = null;
        setAsking(false);
        void sessionsApi.refreshSessions();
      }
    }
  };

  const updateStreamMessage = (
    id: string,
    update:
      | { type: "status"; event: AskAiStatusEvent }
      | { type: "source"; event: AskAiSourceEvent }
      | { type: "approach"; summary: string }
      | { type: "token"; delta: string }
      | { type: "final"; final: AskAiFinalResponse }
      | { type: "error"; message: string },
  ) => {
    setMessages((messages) =>
      messages.map((message) => {
        if (message.id !== id || message.role !== "ai" || message.kind !== "stream") {
          return message;
        }
        if (activeStreamIdRef.current !== id && !message.done && update.type !== "final") {
          return message;
        }
        if (update.type === "status") {
          return {
            ...message,
            activity: [
              ...message.activity,
              {
                type: "status",
                stage: update.event.stage,
                message: update.event.message,
                percent: update.event.percent,
              },
            ],
          };
        }
        if (update.type === "source") {
          return {
            ...message,
            activity: [
              ...message.activity,
              {
                type: "source",
                kind: update.event.kind,
                message: update.event.message,
                count: update.event.count,
                items: update.event.items,
                queries: update.event.queries,
              },
            ],
          };
        }
        if (update.type === "approach") {
          return { ...message, approaches: [...message.approaches, update.summary] };
        }
        if (update.type === "token") {
          return { ...message, text: `${message.text}${update.delta}` };
        }
        if (update.type === "error") {
          return { ...message, error: update.message, done: true };
        }
        return { ...message, text: update.final.answer, final: update.final, done: true };
      }),
    );
  };

  return (
    <>
      {!panelOpen && (
        <>
          <style>{`
            @keyframes askAiGlow {
              0%, 100% { box-shadow: 0 4px 20px -2px rgba(123,104,238,0.45); }
              50%       { box-shadow: 0 4px 36px 4px rgba(123,104,238,0.85); }
            }
            @keyframes askAiSpark {
              0%, 100% { opacity: 1;   transform: scale(1);    }
              50%       { opacity: 0.7; transform: scale(1.18); }
            }
            .ask-ai-tab          { animation: askAiGlow  2.8s ease-in-out infinite; }
            .ask-ai-tab-icon     { animation: askAiSpark 2.8s ease-in-out infinite; }
            .ask-ai-tab:hover    { animation: none; }
          `}</style>
          <button
            onPointerDown={handleButtonPointerDown}
            onPointerMove={handleButtonPointerMove}
            onPointerUp={handleButtonPointerUp}
            aria-label="Open Ask AI"
            className="ask-ai-tab fixed right-0 z-40 flex cursor-grab flex-col items-center gap-2.5 rounded-l-2xl px-3 py-5 text-white transition-shadow active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] focus:ring-offset-2"
            style={{
              top: buttonY !== null ? `${buttonY}px` : "50%",
              transform: "translateY(-50%)",
              background: "var(--color-brand)",
              touchAction: "none",
            }}
          >
            <Sparkles className="ask-ai-tab-icon h-5 w-5" />
            <span
              className="text-[11px] font-bold tracking-widest"
              style={{ writingMode: "vertical-rl" as const }}
            >
              Ask AI
            </span>
          </button>
        </>
      )}

      {panelOpen && (
        <aside
          className={`fixed right-0 top-0 z-50 flex h-screen max-w-full overflow-hidden bg-[var(--color-page)] slide-in-right ${
            panelExpanded ? "flex-row" : "flex-col w-[430px]"
          }`}
          style={{
            left: panelExpanded ? expandedLeft : undefined,
            width: panelExpanded ? `calc(100vw - ${expandedLeft}px)` : undefined,
            borderLeft: "1px solid var(--color-border-default)",
            boxShadow: "-24px 0 64px -32px rgba(17,24,39,0.45)",
          }}
        >
          {/* Expanded mode: integrated left history column */}
          {panelExpanded && showHistory && (
            <div
              className="flex h-full w-[268px] shrink-0 flex-col border-r"
              style={{ borderColor: "var(--color-border-default)" }}
            >
              <div
                className="flex h-14 shrink-0 items-center justify-between border-b px-4"
                style={{ borderColor: "var(--color-border-default)" }}
              >
                <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                  History
                </span>
                <button
                  onClick={() => setShowHistory(false)}
                  className="rounded-md p-1.5 transition hover:bg-[var(--color-tag-bg)]"
                  aria-label="Close history"
                >
                  <X className="h-4 w-4 text-[var(--color-text-muted)]" />
                </button>
              </div>
              <div className="shrink-0 px-3 pb-2 pt-3">
                <button
                  onClick={startNewChat}
                  className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium transition hover:bg-[var(--color-tag-bg)]"
                  style={{
                    borderColor: "var(--color-border-default)",
                    color: "var(--color-text-primary)",
                  }}
                >
                  <Plus className="h-4 w-4 text-[var(--color-brand)]" />
                  New chat
                </button>
              </div>
              <HistoryChatList
                sessions={sessionsApi.sessions}
                loading={sessionsApi.loading}
                error={sessionsApi.error}
                onRetry={() => void sessionsApi.refreshSessions()}
                onLoadChat={(chat) => void loadChat(chat)}
                onRenameChat={openRenameChatDialog}
                onDeleteChat={openDeleteChatDialog}
              />
            </div>
          )}

          {/* Main chat column — always rendered */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {/* Header */}
            <div
              className="flex min-h-[60px] shrink-0 items-center justify-between border-b bg-white/95 px-5 backdrop-blur"
              style={{ borderColor: "var(--color-border-default)" }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand)] text-white shadow-[0_10px_24px_-14px_rgba(123,104,238,0.9)]">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-[16px] font-bold text-[var(--color-text-primary)]">
                    <ProductWordmark />
                  </div>
                  <div className="truncate text-[11px] text-[var(--color-text-muted)]">
                    {subtitleParts.join(" · ")}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                {messages.length > 0 && (
                  <IconTooltip label="New chat">
                    <button
                      onClick={startNewChat}
                      className="cursor-pointer rounded-md p-1.5 transition hover:bg-[var(--color-tag-bg)] focus:outline-none"
                      aria-label="New chat"
                    >
                      <Plus className="h-[18px] w-[18px] text-[var(--color-text-muted)]" />
                    </button>
                  </IconTooltip>
                )}
                {routeMode.showCollapse && (
                  <IconTooltip label={panelExpanded ? "Collapse chat" : "Expand chat"}>
                    <button
                      onClick={() => setExpanded((v) => !v)}
                      className="cursor-pointer rounded-md p-1.5 transition hover:bg-[var(--color-tag-bg)] focus:outline-none"
                      aria-label={panelExpanded ? "Collapse chat" : "Expand chat"}
                    >
                      {panelExpanded ? (
                        <Minimize2 className="h-[18px] w-[18px] text-[var(--color-text-muted)]" />
                      ) : (
                        <Maximize2 className="h-[18px] w-[18px] text-[var(--color-text-muted)]" />
                      )}
                    </button>
                  </IconTooltip>
                )}
                {routeMode.showClose && (
                  <IconTooltip label="Close Ask AI">
                    <button
                      onClick={closeAskAiPanel}
                      className="cursor-pointer rounded-md p-1.5 transition hover:bg-[var(--color-tag-bg)] focus:outline-none"
                      aria-label="Close Ask AI"
                    >
                      <X className="h-[18px] w-[18px] text-[var(--color-text-muted)]" />
                    </button>
                  </IconTooltip>
                )}
              </div>
            </div>

            {/* Context chips row */}
            {!showHistory && (
              <div
                className="flex shrink-0 flex-wrap gap-1.5 border-b px-4 py-2.5"
                style={{
                  borderColor: "var(--color-border-default)",
                  background: "var(--color-table-header)",
                }}
              >
                {contextChips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                    style={{
                      background: "var(--color-tag-bg)",
                      color: "var(--color-brand)",
                      border: "1px solid rgba(123,104,238,0.25)",
                    }}
                  >
                    {chip}
                  </span>
                ))}
              </div>
            )}

            {/* Tab bar — non-expanded mode only */}
            {!panelExpanded && (
              <div
                className="flex shrink-0 border-b"
                style={{ borderColor: "var(--color-border-default)" }}
              >
                {(["Chat", "History"] as const).map((tab) => {
                  const active = tab === "History" ? showHistory : !showHistory;
                  return (
                    <button
                      key={tab}
                      onClick={() => setShowHistory(tab === "History")}
                      className="flex-1 py-2 text-[13px] font-medium transition"
                      style={{
                        color: active ? "var(--color-brand)" : "var(--color-text-muted)",
                        borderBottom: active
                          ? "2px solid var(--color-brand)"
                          : "2px solid transparent",
                      }}
                    >
                      {tab}
                    </button>
                  );
                })}
                {/* History toggle for expanded mode */}
                {panelExpanded && (
                  <IconTooltip label={showHistory ? "Close history" : "Show history"}>
                    <button
                      onClick={() => setShowHistory((v) => !v)}
                      className="px-3 py-2 transition hover:bg-[var(--color-tag-bg)]"
                      aria-label="Toggle history"
                    >
                      <History
                        className="h-4 w-4"
                        style={{
                          color: showHistory ? "var(--color-brand)" : "var(--color-text-muted)",
                        }}
                      />
                    </button>
                  </IconTooltip>
                )}
              </div>
            )}

            {/* Non-expanded History tab content */}
            {!panelExpanded && showHistory ? (
              <>
                <div className="shrink-0 px-3 pb-2 pt-3">
                  <button
                    onClick={startNewChat}
                    className="flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-medium transition hover:bg-[var(--color-tag-bg)]"
                    style={{
                      borderColor: "var(--color-border-default)",
                      color: "var(--color-text-primary)",
                    }}
                  >
                    <Plus className="h-4 w-4 text-[var(--color-brand)]" />
                    New chat
                  </button>
                </div>
                <div
                  className="flex shrink-0 items-center gap-1.5 border-b px-4 py-2"
                  style={{ borderColor: "var(--color-border-default)" }}
                >
                  <Clock className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
                    Past Chats
                  </span>
                </div>
                <HistoryChatList
                  sessions={sessionsApi.sessions}
                  loading={sessionsApi.loading}
                  error={sessionsApi.error}
                  onRetry={() => void sessionsApi.refreshSessions()}
                  onLoadChat={(chat) => void loadChat(chat)}
                  onRenameChat={openRenameChatDialog}
                  onDeleteChat={openDeleteChatDialog}
                />
              </>
            ) : (
              <>
                <div
                  ref={scrollRef}
                  className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4"
                >
                  {messages.length === 0 && (
                    <div className={`mx-auto w-full space-y-2.5 ${panelExpanded ? "max-w-[80%]" : ""}`}>
                      {/* Finance expert ready card */}
                      <div
                        className="rounded-2xl border p-4"
                        style={{
                          borderColor: "rgba(123,104,238,0.3)",
                          background: "rgba(123,104,238,0.06)",
                        }}
                      >
                        <div className="flex items-center gap-2 text-[15px] font-semibold text-[var(--color-text-primary)]">
                          <Sparkles className="h-4 w-4 text-[var(--color-brand)]" />
                          Finance expert ready
                        </div>
                        <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
                          {routeMode.emptyStateDescription}
                        </p>
                      </div>
                      {/* Suggestion pills */}
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          onClick={() => void send(s)}
                          disabled={asking}
                          className="w-full rounded-xl border bg-white px-4 py-3 text-left text-[13px] transition hover:border-[var(--color-brand)] hover:bg-[var(--color-tag-bg)] disabled:cursor-not-allowed disabled:opacity-60"
                          style={{
                            borderColor: "var(--color-border-default)",
                            color: "var(--color-text-primary)",
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}

                  {messages.map((m) => {
                    if (m.role === "user") {
                      return (
                        <div key={m.id} className="mx-auto flex w-full max-w-[1180px] justify-end">
                          <div
                            className={`group flex flex-col items-end gap-1 ${
                              panelExpanded ? "max-w-[72%]" : "max-w-[86%]"
                            }`}
                          >
                            <div
                              className="rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed text-white shadow-[0_12px_28px_-18px_rgba(123,104,238,0.9)]"
                              style={{
                                background: "var(--color-brand)",
                                borderRadius: "16px 16px 4px 16px",
                              }}
                            >
                              {m.attachment && (
                                <div
                                  className="mb-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px]"
                                  style={{ background: "rgba(255,255,255,0.18)" }}
                                >
                                  <FileIcon className="h-3.5 w-3.5" />
                                  <span className="font-semibold">{m.attachment.name}</span>
                                  <span className="opacity-70">· {m.attachment.size}</span>
                                </div>
                              )}
                              {m.text}
                            </div>
                            <CopyButton
                              text={m.text}
                              className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                            />
                          </div>
                        </div>
                      );
                    }
                    if (m.kind === "text") {
                      return (
                        <AiBubble key={m.id} copyText={m.text} expanded={panelExpanded}>
                          <MarkdownContent
                            markdown={m.text}
                            size={panelExpanded ? "expanded" : "default"}
                          />
                        </AiBubble>
                      );
                    }
                    if (m.kind === "stream") {
                      return (
                        <StreamingAiBubble
                          key={m.id}
                          message={m}
                          expanded={panelExpanded}
                          projectId={activeProjectId}
                          onPreviewSource={setPreviewSource}
                          onPreviewExternalSource={setExternalPreviewSource}
                        />
                      );
                    }
                    if (m.kind === "status") {
                      return <StatusStream key={m.id} steps={m.steps} />;
                    }
                    return null;
                  })}
                </div>

                <div
                  className="border-t bg-white/95 p-3 backdrop-blur"
                  style={{ borderColor: "var(--color-border-default)" }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onPickFile(file);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  />
                  <div className={panelExpanded ? "mx-auto max-w-[1180px]" : ""}>
                    <div
                      className="rounded-2xl border bg-white p-2 shadow-[0_12px_34px_-24px_rgba(17,24,39,0.55)] focus-within:border-[var(--color-brand)] focus-within:ring-2 focus-within:ring-[rgba(123,104,238,0.14)]"
                      style={{ borderColor: "var(--color-border-default)" }}
                    >
                      <label htmlFor="ask-ai-input" className="sr-only">
                        Ask AI prompt
                      </label>
                      <textarea
                        id="ask-ai-input"
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          const action = getAskAiPromptKeyAction(e);
                          if (action === "submit") {
                            e.preventDefault();
                            void send(input);
                          }
                        }}
                        placeholder={routeMode.placeholder}
                        rows={1}
                        className="max-h-[136px] min-h-11 w-full resize-none overflow-hidden bg-transparent px-2 py-2 text-[13px] leading-5 text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-placeholder)]"
                      />
                      <div
                        className="mt-1 flex items-center justify-between gap-2 border-t pt-2"
                        style={{ borderColor: "var(--color-border-default)" }}
                      >
                        <div className="flex items-center gap-1.5">
                          {routeMode.showAttachment && (
                            <IconTooltip label="Attach PDF">
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                aria-label="Attach PDF"
                                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border text-[var(--color-text-secondary)] transition hover:bg-[var(--color-tag-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                                style={{ borderColor: "var(--color-border-default)" }}
                              >
                                <Paperclip className="h-4 w-4" />
                              </button>
                            </IconTooltip>
                          )}
                          <span className="hidden text-[11px] text-[var(--color-text-muted)] sm:inline">
                            Enter to send · Shift+Enter for new line
                          </span>
                        </div>
                        <IconTooltip label={asking ? "Stop Ask AI response" : "Send Ask AI prompt"}>
                          <button
                            type="button"
                            onClick={asking ? stopActiveStream : () => void send(input)}
                            disabled={!asking && !input.trim()}
                            className="flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-lg px-2 text-white transition hover:bg-[var(--color-brand-hover)] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] focus:ring-offset-2"
                            style={{ background: "var(--color-brand)" }}
                            aria-label={asking ? "Stop Ask AI response" : "Send Ask AI prompt"}
                          >
                            {asking ? (
                              <Square className="h-3.5 w-3.5 fill-current" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </button>
                        </IconTooltip>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          {/* end main chat column */}
        </aside>
      )}

      <CitationPreviewSidebar
        source={previewSource}
        askAiExpanded={panelExpanded}
        expandedLeft={expandedLeft}
        onClose={() => setPreviewSource(null)}
      />
      <ExternalSourcePreviewSidebar
        source={externalPreviewSource}
        askAiExpanded={panelExpanded}
        expandedLeft={expandedLeft}
        onClose={() => setExternalPreviewSource(null)}
      />
      <HistoryThreadDialog
        dialog={historyDialog}
        renameTitle={renameTitle}
        busy={historyDialogBusy}
        error={historyDialogError}
        onRenameTitleChange={setRenameTitle}
        onClose={closeHistoryDialog}
        onConfirmRename={() => void confirmRenameChat()}
        onConfirmDelete={() => void confirmDeleteChat()}
      />
    </>
  );
}

function HistoryThreadDialog({
  dialog,
  renameTitle,
  busy,
  error,
  onRenameTitleChange,
  onClose,
  onConfirmRename,
  onConfirmDelete,
}: {
  dialog: HistoryDialogState;
  renameTitle: string;
  busy: boolean;
  error: string | null;
  onRenameTitleChange: (value: string) => void;
  onClose: () => void;
  onConfirmRename: () => void;
  onConfirmDelete: () => void;
}) {
  if (!dialog) return null;

  const isRename = dialog.type === "rename";
  const title = isRename ? "Rename thread" : "Delete thread";
  const description = isRename
    ? "Update the title shown in Ask AI history."
    : "This Ask AI thread will be permanently removed from history.";
  const chatTitle = dialog.chat.title || "Untitled Ask AI thread";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(15,23,42,0.42)] px-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-ai-history-dialog-title"
        aria-describedby="ask-ai-history-dialog-description"
        className="w-full max-w-[420px] overflow-hidden rounded-2xl border bg-white shadow-[0_24px_70px_-32px_rgba(15,23,42,0.55)]"
        style={{ borderColor: "var(--color-border-default)" }}
      >
        <div
          className="flex items-start justify-between gap-4 border-b px-4 py-3.5"
          style={{ borderColor: "var(--color-border-default)", background: "#FAFBFF" }}
        >
          <div className="min-w-0">
            <h2
              id="ask-ai-history-dialog-title"
              className="text-[14px] font-semibold text-[var(--color-text-primary)]"
            >
              {title}
            </h2>
            <p
              id="ask-ai-history-dialog-description"
              className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-secondary)]"
            >
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border bg-white text-[var(--color-text-secondary)] transition hover:bg-[var(--color-tag-bg)] hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
            style={{ borderColor: "var(--color-border-default)" }}
            aria-label="Close dialog"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <form
          className="space-y-4 px-4 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (isRename) onConfirmRename();
            else onConfirmDelete();
          }}
        >
          {isRename ? (
            <div>
              <label
                htmlFor="ask-ai-thread-title"
                className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]"
              >
                Thread name
              </label>
              <input
                id="ask-ai-thread-title"
                autoFocus
                value={renameTitle}
                onChange={(event) => onRenameTitleChange(event.target.value)}
                disabled={busy}
                className="h-10 w-full rounded-lg border bg-white px-3 text-[13px] text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[rgba(123,104,238,0.16)] disabled:cursor-not-allowed disabled:opacity-60"
                style={{ borderColor: "var(--color-border-default)" }}
                placeholder="Name this Ask AI thread"
              />
            </div>
          ) : (
            <div
              className="rounded-xl border px-3 py-3"
              style={{ borderColor: "rgba(220,38,38,0.18)", background: "var(--color-danger-bg)" }}
            >
              <div className="flex items-start gap-2.5">
                <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-danger-fg)]" />
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-[var(--color-text-primary)]">
                    {chatTitle}
                  </div>
                  <div className="mt-1 text-[12px] leading-relaxed text-[var(--color-danger-fg)]">
                    This action cannot be undone.
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div
              className="rounded-lg px-3 py-2 text-[12px]"
              style={{ background: "var(--color-danger-bg)", color: "var(--color-danger-fg)" }}
            >
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="h-9 cursor-pointer rounded-lg border bg-white px-3 text-[12px] font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-table-header)] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
              style={{ borderColor: "var(--color-border-default)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || (isRename && !renameTitle.trim())}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] focus:ring-offset-2"
              style={{ background: isRename ? "var(--color-brand)" : "var(--color-danger-fg)" }}
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isRename ? "Save" : "Delete"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AiBubble({
  children,
  copyText,
  wide = false,
  expanded = false,
}: {
  children: ReactNode;
  copyText?: string;
  wide?: boolean;
  expanded?: boolean;
}) {
  return (
    <div className={`mx-auto flex w-full min-w-0 ${expanded ? "max-w-[1180px]" : ""}`}>
      <div className="group flex w-full min-w-0 flex-col items-end gap-1">
        <div
          className="w-full min-w-0 overflow-hidden rounded-xl border bg-white px-3.5 py-3 text-[13px]"
          style={{
            borderColor: "var(--color-border-default)",
            borderRadius: "12px 12px 12px 2px",
            color: "var(--color-text-primary)",
          }}
        >
          {children}
        </div>
        {copyText && (
          <CopyButton
            text={copyText}
            className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
          />
        )}
      </div>
    </div>
  );
}

function CollapsibleSection({
  icon,
  title,
  meta,
  summary,
  defaultOpen,
  children,
}: {
  icon: ReactNode;
  title: string;
  meta?: string;
  summary?: ReactNode;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      className="overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
      style={{ borderColor: open ? "rgba(123,104,238,0.22)" : "var(--color-border-default)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-[var(--color-table-header)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--color-brand)]"
        aria-expanded={open}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--color-tag-bg)]">
            {icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 text-[12px] font-semibold text-[var(--color-text-primary)]">
                {title}
              </span>
              {summary}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
          {meta && (
            <span className="rounded-full bg-[var(--color-tag-bg)] px-2 py-0.5 font-semibold text-[var(--color-brand)]">
              {meta}
            </span>
          )}
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </span>
      </button>
      {open && (
        <div className="border-t px-3 py-3" style={{ borderColor: "var(--color-border-default)" }}>
          {children}
        </div>
      )}
    </section>
  );
}

function ContextSummary({ context, isDiagnosis }: { context: string; isDiagnosis: boolean }) {
  const parts = context.split(" · ").filter(Boolean);
  return (
    <CollapsibleSection
      icon={
        isDiagnosis ? (
          <TableProperties className="h-3.5 w-3.5 text-[var(--color-brand)]" />
        ) : (
          <Database className="h-3.5 w-3.5 text-[var(--color-brand)]" />
        )
      }
      title={isDiagnosis ? "Diagnosis model context" : "Project context"}
      meta={`${parts.length} signals`}
      defaultOpen={false}
      summary={
        <span className="truncate text-[12px] font-medium text-[var(--color-text-secondary)]">
          {context}
        </span>
      }
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {parts.map((part) => (
          <div
            key={part}
            className="rounded-lg border bg-white px-3 py-2 text-[11px] font-medium text-[var(--color-text-secondary)]"
            style={{ borderColor: "var(--color-border-default)" }}
          >
            {part}
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}

function useStreamMeta(done: boolean) {
  const startRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (done) return;
    const id = window.setInterval(() => {
      setElapsed(Date.now() - startRef.current);
    }, 100);
    return () => window.clearInterval(id);
  }, [done]);

  const finalElapsed = done ? elapsed || Date.now() - startRef.current : elapsed;
  return { elapsed: finalElapsed };
}

function StreamingAiBubble({
  message,
  expanded,
  projectId,
  onPreviewSource,
  onPreviewExternalSource,
}: {
  message: Extract<Msg, { kind: "stream" }>;
  expanded: boolean;
  projectId: string | null;
  onPreviewSource: (source: DiagnosisSourcePreview) => void;
  onPreviewExternalSource: (source: ExternalSourcePreview) => void;
}) {
  const citations = message.final?.sourcesUsed ?? [];
  const answer = message.final?.answer || message.text;
  const warnings = userFacingAskAiWarnings(message.final?.warnings, {
    requestMode: message.final?.requestMode,
  });
  const forecastVisuals = normalizeForecastVisuals(message.final?.forecastVisuals);
  const forecastAnalysis = normalizeForecastAnalysis(message.final?.forecastAnalysis);
  const claimSourceGroups = message.final?.claimSourceGroups ?? [];
  const reasoning = buildAskAiReasoningSummary({
    activity: message.activity,
    approaches: message.approaches,
    done: message.done,
    final: message.final,
  });
  const { elapsed } = useStreamMeta(message.done);
  // Estimate from live streaming text so it increments token-by-token
  const liveText = message.final?.answer ?? message.text;
  const estTokens = Math.round(liveText.length / 3.8);
  const tokenUsageLabel = askAiTokenUsageLabel({
    usage: message.final?.usage,
    estimatedTokens: estTokens,
    done: message.done,
  });

  return (
    <AiBubble copyText={answer} wide expanded={expanded}>
      <div className="min-w-0 space-y-3 overflow-hidden">
        {/* Token + time meta row */}
        <div
          className="flex items-center gap-3 text-[11px]"
          style={{ color: "var(--color-text-muted)" }}
        >
          <span className="flex items-center gap-1">
            <Loader2
              className={`h-3 w-3 ${message.done ? "hidden" : "animate-spin"}`}
              style={{ color: "var(--color-brand)" }}
            />
            <span
              className="tnum font-medium"
              style={{ color: message.done ? "var(--color-success)" : "var(--color-brand)" }}
            >
              {(elapsed / 1000).toFixed(1)}s
            </span>
          </span>
          <span className="h-3 w-px" style={{ background: "var(--color-border-default)" }} />
          <span className="tnum">{tokenUsageLabel}</span>
        </div>

        <CurrentEventPanel summary={reasoning} message={message} />
        {forecastAnalysis && <ForecastAnalysisPanel analysis={forecastAnalysis} />}
        {forecastVisuals && <ForecastSnapshot visuals={forecastVisuals} />}
        {message.error ? (
          <div
            className="break-words rounded-md px-3 py-2 text-[12px]"
            style={{ background: "var(--color-danger-bg)", color: "var(--color-danger-fg)" }}
          >
            {message.error}
          </div>
        ) : null}

        {answer ? (
          <div className="min-w-0 overflow-visible break-words">
            <MarkdownContent
              markdown={answer}
              renderCitation={() => null}
              size={expanded ? "expanded" : "default"}
            />
          </div>
        ) : (
          <div className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>
            The answer will appear here as soon as AI starts drafting it.
          </div>
        )}

        {warnings.length > 0 && (
          <div
            className="rounded-md px-2.5 py-1.5 text-[12px]"
            style={{ background: "#FFFBEB", color: "var(--color-warning-fg)" }}
          >
            {warnings.join(" · ")}
          </div>
        )}

        {message.done && (citations.length > 0 || claimSourceGroups.length > 0) && (
          <CitationFooter
            citations={citations}
            claimSourceGroups={claimSourceGroups}
            projectId={projectId}
            onPreviewSource={onPreviewSource}
            onPreviewExternalSource={onPreviewExternalSource}
          />
        )}
      </div>
    </AiBubble>
  );
}

// ─── Bottom Citations ────────────────────────────────────────────────────────

function CitationFooter({
  citations,
  claimSourceGroups,
  projectId,
  onPreviewSource,
  onPreviewExternalSource,
}: {
  citations: Array<Record<string, unknown>>;
  claimSourceGroups: AskAiClaimSourceGroup[];
  projectId: string | null;
  onPreviewSource: (source: DiagnosisSourcePreview) => void;
  onPreviewExternalSource: (source: ExternalSourcePreview) => void;
}) {
  return (
    <section
      className="mt-3 min-w-0 space-y-2 rounded-xl border bg-[#FAFBFF] p-2.5"
      style={{ borderColor: "var(--color-border-default)" }}
      aria-label="Answer sources"
    >
      <SourcesList
        citations={citations}
        projectId={projectId}
        onPreviewSource={onPreviewSource}
        onPreviewExternalSource={onPreviewExternalSource}
      />
      {claimSourceGroups.length > 0 && (
        <GroupedSourcePills
          groups={claimSourceGroups}
          citations={citations}
          projectId={projectId}
          onPreviewSource={onPreviewSource}
          onPreviewExternalSource={onPreviewExternalSource}
        />
      )}
    </section>
  );
}

function SourcesList({
  citations,
  projectId,
  onPreviewSource,
  onPreviewExternalSource,
}: {
  citations: Array<Record<string, unknown>>;
  projectId: string | null;
  onPreviewSource: (source: DiagnosisSourcePreview) => void;
  onPreviewExternalSource: (source: ExternalSourcePreview) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  if (citations.length === 0) return null;
  const visible = showAll ? citations : citations.slice(0, 5);
  const overflow = Math.max(0, citations.length - visible.length);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <div className="flex min-w-0 flex-wrap items-center">
        {visible.map((citation, i) => (
          <SourceBubble
            key={String(citation.index ?? i)}
            citation={citation}
            stackIndex={i}
            totalVisible={visible.length}
            projectId={projectId}
            onPreviewSource={onPreviewSource}
            onPreviewExternalSource={onPreviewExternalSource}
          />
        ))}
        {overflow > 0 && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="relative -ml-1.5 flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-full border bg-white px-2 text-[10px] font-bold text-[var(--color-text-secondary)] shadow-sm transition hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
            style={{ borderColor: "var(--color-border-default)", zIndex: 0 }}
            aria-label={`Show ${overflow} additional sources`}
          >
            +{overflow}
          </button>
        )}
      </div>
      <span className="shrink-0 text-[11px] font-semibold text-[var(--color-text-secondary)]">
        {citations.length} source{citations.length === 1 ? "" : "s"}
      </span>
    </div>
  );
}

function SourceBubble({
  citation,
  stackIndex,
  totalVisible,
  projectId,
  onPreviewSource,
  onPreviewExternalSource,
}: {
  citation: Record<string, unknown>;
  stackIndex: number;
  totalVisible: number;
  projectId: string | null;
  onPreviewSource: (source: DiagnosisSourcePreview) => void;
  onPreviewExternalSource: (source: ExternalSourcePreview) => void;
}) {
  const preview = getAskAiCitationPreview(citation);
  const title = getAskAiCitationTitle(citation);
  const excerpt = String(citation.excerpt ?? citation.currentValue ?? citation.value ?? "");
  const bubble = (
    <span
      className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-sm transition hover:scale-105"
      style={{
        background: sourceBubbleColor(citation),
        marginLeft: stackIndex > 0 ? "-8px" : "0",
        position: "relative",
        zIndex: totalVisible - stackIndex,
      }}
      aria-hidden="true"
    >
      {sourceBubbleLabel(citation)}
    </span>
  );

  if (preview?.type === "external_url") {
    return (
      <IconTooltip label={title}>
        <button
          type="button"
          onClick={() =>
            onPreviewExternalSource(buildExternalPreviewSource({ citation, preview, excerpt }))
          }
          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
          aria-label={title}
        >
          {bubble}
        </button>
      </IconTooltip>
    );
  }

  if (preview?.type === "document_page" && projectId) {
    return (
      <IconTooltip label={title}>
        <button
          type="button"
          onClick={() =>
            onPreviewSource(buildCitationPreviewSource({ citation, preview, projectId, excerpt }))
          }
          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
          aria-label={title}
        >
          {bubble}
        </button>
      </IconTooltip>
    );
  }

  return (
    <IconTooltip label={title}>
      <span>{bubble}</span>
    </IconTooltip>
  );
}

function sourceBubbleLabel(citation: Record<string, unknown>): string {
  const kind = String(citation.kind ?? "");
  if (kind === "model" || kind === "diagnosis_workbook_cell") return "M";
  if (kind === "uploaded_pdf") return "P";
  if (kind === "uploaded_sheet") return "S";
  const sourceName = String(citation.sourceName ?? citation.title ?? "W").trim();
  return (sourceName.charAt(0) || "W").toUpperCase();
}

function sourceBubbleColor(citation: Record<string, unknown>): string {
  const kind = String(citation.kind ?? "");
  if (kind === "uploaded_pdf") return "#DC2626";
  if (kind === "uploaded_sheet") return "#2563EB";
  if (kind === "source_registry" || kind === "web") return "#059669";
  return "var(--color-brand)";
}

function SourcePill({
  citation,
  projectId,
  onPreviewSource,
  onPreviewExternalSource,
}: {
  citation: Record<string, unknown>;
  projectId: string | null;
  onPreviewSource: (source: DiagnosisSourcePreview) => void;
  onPreviewExternalSource: (source: ExternalSourcePreview) => void;
}) {
  const preview = getAskAiCitationPreview(citation);
  const title = getAskAiCitationTitle(citation);
  const excerpt = String(citation.excerpt ?? citation.currentValue ?? citation.value ?? "");
  const content = (
    <>
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ background: sourceBubbleColor(citation) }}
      >
        {sourceBubbleLabel(citation)}
      </span>
      <span className="max-w-[150px] truncate">{getAskAiCitationPillLabel(citation)}</span>
    </>
  );
  const className =
    "inline-flex max-w-full items-center gap-1.5 rounded-full border bg-white px-1.5 py-1 text-[10px] font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]";

  if (preview?.type === "external_url") {
    return (
      <IconTooltip label={title}>
        <button
          type="button"
          onClick={() =>
            onPreviewExternalSource(buildExternalPreviewSource({ citation, preview, excerpt }))
          }
          className={className}
          style={{ borderColor: "var(--color-border-default)" }}
          aria-label={title}
        >
          {content}
        </button>
      </IconTooltip>
    );
  }

  if (preview?.type === "document_page" && projectId) {
    return (
      <IconTooltip label={title}>
        <button
          type="button"
          onClick={() =>
            onPreviewSource(buildCitationPreviewSource({ citation, preview, projectId, excerpt }))
          }
          className={className}
          style={{ borderColor: "var(--color-border-default)" }}
          aria-label={title}
        >
          {content}
        </button>
      </IconTooltip>
    );
  }

  return (
    <IconTooltip label={title}>
      <span className={className} style={{ borderColor: "var(--color-border-default)" }}>
        {content}
      </span>
    </IconTooltip>
  );
}

function citationSubline(citation: Record<string, unknown>): string {
  if (citation.kind === "diagnosis_workbook_cell") {
    return [
      citation.sheetName,
      citation.cellReference,
      citation.rowNumber ? `row ${String(citation.rowNumber)}` : undefined,
    ]
      .filter(Boolean)
      .map(String)
      .join(" · ");
  }
  if (citation.kind === "uploaded_pdf") {
    const page = citation.pageNumber ?? citation.page ?? citation.pdfPageIndex;
    return page ? `p. ${String(page)}` : String(citation.filename ?? "");
  }
  if (citation.kind === "model") {
    const ref = [citation.sheetName, citation.cellReference]
      .filter(Boolean)
      .map(String)
      .join(" · ");
    return ref || String(citation.period ?? "");
  }
  if (typeof citation.url === "string" && citation.url) {
    try {
      return new URL(citation.url).hostname.replace(/^www\./, "");
    } catch {
      return String(citation.sourceName ?? "");
    }
  }
  return String(citation.sourceName ?? "");
}

// ─── Forecast snapshot ───────────────────────────────────────────────────────

function ForecastAnalysisPanel({ analysis }: { analysis: AskAiForecastAnalysis }) {
  const scenarioPeriods = Array.from(
    new Set(analysis.scenarioTable.flatMap((row) => Object.keys(row.values))),
  ).slice(0, 6);
  return (
    <section
      className="min-w-0 overflow-hidden rounded-xl border bg-white"
      style={{ borderColor: "var(--color-border-default)" }}
    >
      <div
        className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5"
        style={{ borderColor: "var(--color-border-default)", background: "#F8FAFC" }}
      >
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-[var(--color-text-primary)]">
            Forecast analysis
          </div>
          <div className="truncate text-[10px] text-[var(--color-text-muted)]">
            {[analysis.metric, analysis.unit, analysis.mode].filter(Boolean).join(" · ")}
          </div>
        </div>
        {analysis.forecastHorizon && (
          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-[var(--color-brand)]">
            {analysis.forecastHorizon} year horizon
          </span>
        )}
      </div>
      <div className="space-y-3 p-3">
        {analysis.historicalSeries.length > 0 && (
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[440px] border-separate border-spacing-0 text-left text-[11px]">
              <thead className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                <tr>
                  <th className="border-b px-2 py-1.5 font-semibold">Period</th>
                  <th className="border-b px-2 py-1.5 text-right font-semibold">Value</th>
                  <th className="border-b px-2 py-1.5 font-semibold">Treatment</th>
                  <th className="border-b px-2 py-1.5 font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody>
                {analysis.historicalSeries.slice(0, 8).map((item) => (
                  <tr key={`${item.period}-${item.treatment}`}>
                    <td className="border-b px-2 py-1.5 font-medium text-[var(--color-text-primary)]">
                      {item.period}
                    </td>
                    <td className="border-b px-2 py-1.5 text-right tabular-nums">
                      {formatForecastValue(item.value)}
                    </td>
                    <td className="border-b px-2 py-1.5">
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{
                          background:
                            item.treatment === "excluded"
                              ? "var(--color-warning-bg)"
                              : "var(--color-success-bg)",
                          color:
                            item.treatment === "excluded"
                              ? "var(--color-warning-fg)"
                              : "var(--color-success-fg)",
                        }}
                      >
                        {item.treatment}
                      </span>
                    </td>
                    <td className="max-w-[220px] border-b px-2 py-1.5 text-[var(--color-text-secondary)]">
                      <span className="line-clamp-2">{item.reason ?? ""}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(analysis.cagrResults.length > 0 || analysis.normalizedBase) && (
          <div className="grid gap-2 sm:grid-cols-2">
            {analysis.cagrResults.slice(0, 4).map((result) => (
              <div
                key={`${result.label}-${result.basis}`}
                className="rounded-lg border px-2.5 py-2"
                style={{ borderColor: "var(--color-border-default)", background: "#FAFBFF" }}
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                  {result.basis}
                </div>
                <div className="mt-1 text-[14px] font-semibold text-[var(--color-text-primary)]">
                  {formatPercent(result.value)}
                </div>
                <div className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
                  {result.startPeriod} to {result.endPeriod}
                </div>
              </div>
            ))}
            {analysis.normalizedBase && (
              <div
                className="rounded-lg border px-2.5 py-2"
                style={{ borderColor: "var(--color-border-default)", background: "#FAFBFF" }}
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                  Normalized base
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                  {typeof analysis.normalizedBase.mean === "number" && (
                    <span>Mean {formatForecastValue(analysis.normalizedBase.mean)}</span>
                  )}
                  {typeof analysis.normalizedBase.median === "number" && (
                    <span>Median {formatForecastValue(analysis.normalizedBase.median)}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {analysis.scenarioTable.length > 0 && (
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[420px] border-separate border-spacing-0 text-left text-[11px]">
              <thead className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                <tr>
                  <th className="border-b px-2 py-1.5 font-semibold">Scenario</th>
                  {scenarioPeriods.map((period) => (
                    <th key={period} className="border-b px-2 py-1.5 text-right font-semibold">
                      {period}
                    </th>
                  ))}
                  <th className="border-b px-2 py-1.5 font-semibold">Basis</th>
                </tr>
              </thead>
              <tbody>
                {analysis.scenarioTable.slice(0, 3).map((row) => (
                  <tr key={row.scenario}>
                    <td className="border-b px-2 py-1.5 font-semibold text-[var(--color-text-primary)]">
                      {row.scenario}
                    </td>
                    {scenarioPeriods.map((period) => (
                      <td
                        key={`${row.scenario}-${period}`}
                        className="border-b px-2 py-1.5 text-right tabular-nums"
                      >
                        {formatScenarioValue(row.values[period])}
                      </td>
                    ))}
                    <td className="max-w-[220px] border-b px-2 py-1.5 text-[var(--color-text-secondary)]">
                      <span className="line-clamp-2">{row.basis}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {analysis.missingInputs.length > 0 && (
          <div
            className="rounded-lg px-2.5 py-2 text-[11px]"
            style={{ background: "var(--color-warning-bg)", color: "var(--color-warning-fg)" }}
          >
            Missing inputs: {analysis.missingInputs.join(", ")}
          </div>
        )}
      </div>
    </section>
  );
}

function ForecastSnapshot({ visuals }: { visuals: AskAiForecastVisuals }) {
  const charts = visuals.chartSeries.slice(0, 4);
  return (
    <section
      className="min-w-0 overflow-hidden rounded-xl border bg-white"
      style={{ borderColor: "var(--color-border-default)" }}
    >
      <div
        className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5"
        style={{ borderColor: "var(--color-border-default)", background: "#FAFBFF" }}
      >
        <div className="text-[12px] font-semibold text-[var(--color-text-primary)]">
          Forecast snapshot
        </div>
        {visuals.confidence && (
          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-[var(--color-brand)]">
            {visuals.confidence} confidence
          </span>
        )}
      </div>
      <div className="space-y-3 p-3">
        {charts.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {charts.map((series) => (
              <div
                key={series.id}
                className="min-w-0 rounded-lg border bg-white p-2"
                style={{ borderColor: "var(--color-border-default)" }}
              >
                <div className="mb-1 truncate text-[11px] font-semibold text-[var(--color-text-secondary)]">
                  {series.title}
                </div>
                <ChartContainer
                  className="h-[150px] min-h-[150px] w-full aspect-auto"
                  config={{ value: { label: series.title, color: "var(--color-brand)" } }}
                >
                  <LineChart
                    data={series.points}
                    margin={{ left: 0, right: 10, top: 10, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} width={36} />
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="var(--color-value)"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  </LineChart>
                </ChartContainer>
              </div>
            ))}
          </div>
        )}
        {visuals.assumptionPills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {visuals.assumptionPills.map((pill) => (
              <span
                key={pill}
                className="rounded-full bg-[var(--color-tag-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-brand)]"
              >
                {pill}
              </span>
            ))}
          </div>
        )}
        {visuals.riskCallouts.length > 0 && (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {visuals.riskCallouts.map((risk) => (
              <div
                key={`${risk.severity}-${risk.label}`}
                className="flex min-w-0 items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[11px]"
                style={{
                  background: riskBackground(risk.severity),
                  color: riskColor(risk.severity),
                }}
              >
                <span className="min-w-0 truncate font-medium">{risk.label}</span>
                <span className="shrink-0 font-semibold">{risk.severity}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function GroupedSourcePills({
  groups,
  citations,
  projectId,
  onPreviewSource,
  onPreviewExternalSource,
}: {
  groups: AskAiClaimSourceGroup[];
  citations: Array<Record<string, unknown>>;
  projectId: string | null;
  onPreviewSource: (source: DiagnosisSourcePreview) => void;
  onPreviewExternalSource: (source: ExternalSourcePreview) => void;
}) {
  const visibleGroups = groups.filter((group) => group.citationIndexes.length > 1);
  if (visibleGroups.length === 0) return null;
  return (
    <div
      className="mt-3 space-y-1.5 rounded-lg border bg-[#FAFBFF] px-2.5 py-2"
      style={{ borderColor: "var(--color-border-default)" }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
        Cross-check sources
      </div>
      {visibleGroups.map((group) => (
        <div
          key={group.claimId}
          className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px]"
        >
          <span className="max-w-[180px] truncate text-[var(--color-text-secondary)]">
            {formatClaimId(group.claimId)}
          </span>
          {group.citationIndexes.map((index) => (
            <InlineCitationBadge
              key={`${group.claimId}-${index}`}
              index={index}
              citations={citations}
              projectId={projectId}
              onPreviewSource={onPreviewSource}
              onPreviewExternalSource={onPreviewExternalSource}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function riskBackground(severity: string): string {
  if (severity === "High") return "var(--color-danger-bg)";
  if (severity === "Medium") return "var(--color-warning-bg)";
  return "var(--color-success-bg)";
}

function riskColor(severity: string): string {
  if (severity === "High") return "var(--color-danger-fg)";
  if (severity === "Medium") return "var(--color-warning-fg)";
  return "var(--color-success-fg)";
}

function formatClaimId(value: string): string {
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function formatForecastValue(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatScenarioValue(value: number | string | undefined): string {
  if (typeof value === "number") return formatForecastValue(value);
  if (typeof value === "string" && value.trim()) return value;
  return "-";
}

function InlineCitationBadge({
  index,
  citations,
  projectId,
  onPreviewSource,
  onPreviewExternalSource,
}: {
  index: number;
  citations: Array<Record<string, unknown>>;
  projectId: string | null;
  onPreviewSource: (source: DiagnosisSourcePreview) => void;
  onPreviewExternalSource: (source: ExternalSourcePreview) => void;
}) {
  const citation = citations.find((item) => Number(item.index ?? 0) === index);
  if (!citation) {
    return <span className="font-semibold text-[var(--color-brand)]">{index}</span>;
  }
  return (
    <span className="inline-flex max-w-full align-baseline">
      <SourcePill
        citation={citation}
        projectId={projectId}
        onPreviewSource={onPreviewSource}
        onPreviewExternalSource={onPreviewExternalSource}
      />
    </span>
  );
}

function citationMeta(citation: Record<string, unknown>): string {
  if (citation.kind === "diagnosis_workbook_cell") {
    const value = citation.currentValue ?? citation.value;
    return [
      citation.sheetName,
      citation.cellReference,
      citation.rowNumber ? `row ${String(citation.rowNumber)}` : undefined,
      citation.period,
      value !== undefined && value !== null && value !== "" ? `value ${String(value)}` : undefined,
      citation.formula ? `formula ${String(citation.formula)}` : undefined,
    ]
      .filter(Boolean)
      .map(String)
      .join(" · ");
  }
  if (citation.kind === "uploaded_pdf") {
    const page = citation.pageNumber ?? citation.page ?? citation.pdfPageIndex;
    return [citation.filename, page ? `page ${String(page)}` : undefined]
      .filter(Boolean)
      .map(String)
      .join(" · ");
  }
  if (citation.kind === "model") {
    return [citation.sheetName, citation.cellReference, citation.period]
      .filter(Boolean)
      .map(String)
      .join(" · ");
  }
  return [citation.sourceName, citation.date, citation.url].filter(Boolean).map(String).join(" · ");
}
// citationMeta kept for InlineCitationBadge tooltip

function buildCitationPreviewSource({
  citation,
  preview,
  projectId,
  excerpt,
}: {
  citation: Record<string, unknown>;
  preview: Extract<AskAiCitationPreview, { type: "document_page" }>;
  projectId: string;
  excerpt: string;
}): DiagnosisSourcePreview {
  return {
    projectId,
    documentId: preview.documentId,
    documentFilename: String(citation.filename ?? preview.title),
    pdfPageIndex: preview.pdfPageIndex,
    printedPageNumber: Number.parseInt(preview.pageLabel, 10) || preview.pdfPageIndex + 1,
    label: preview.title,
    value: String(citation.currentValue ?? citation.value ?? ""),
    sourceText: excerpt || null,
    boundingBox: null,
  };
}

function buildExternalPreviewSource({
  citation,
  preview,
  excerpt,
}: {
  citation: Record<string, unknown>;
  preview: Extract<AskAiCitationPreview, { type: "external_url" }>;
  excerpt: string;
}): ExternalSourcePreview {
  return {
    title: preview.title,
    url: preview.url,
    excerpt,
    meta: citationMeta(citation),
  };
}

function ExternalSourcePreviewSidebar({
  source,
  onClose,
  askAiExpanded = false,
  expandedLeft = 0,
}: {
  source: ExternalSourcePreview | null;
  onClose: () => void;
  askAiExpanded?: boolean;
  expandedLeft?: number;
}) {
  if (!source) return null;
  const hostname = safeHostname(source.url);
  const sidebarStyle: CSSProperties = askAiExpanded
    ? {
        right: 0,
        width: "400px",
        zIndex: 55,
        borderColor: "#E3E6EA",
        boxShadow: "-8px 0 24px -12px rgba(17,24,39,0.25)",
      }
    : {
        right: "430px",
        width: "360px",
        zIndex: 40,
        borderColor: "#E3E6EA",
        boxShadow: "-8px 0 24px -12px rgba(17,24,39,0.18)",
      };
  if (askAiExpanded && expandedLeft > 0) {
    sidebarStyle.maxWidth = `calc(100vw - ${expandedLeft}px)`;
  }

  return (
    <aside
      className="fixed top-0 flex h-screen flex-col overflow-hidden border-l bg-white"
      style={sidebarStyle}
      aria-label="External source preview"
    >
      <div
        className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3"
        style={{ borderColor: "#E3E6EA", background: "#F8FAFC" }}
      >
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[var(--color-text-primary)]">
            External source
          </div>
          <div className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]">
            {hostname || source.url}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border bg-white text-[var(--color-text-secondary)] transition hover:bg-[var(--color-tag-bg)] hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
          style={{ borderColor: "#E3E6EA" }}
          aria-label="Close source preview"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="space-y-3">
          <div className="rounded-xl border bg-[#FAFBFF] p-3" style={{ borderColor: "#E3E6EA" }}>
            <div className="text-[12px] font-semibold text-[var(--color-text-primary)]">
              {source.title}
            </div>
            {source.meta && (
              <div className="mt-1 break-words text-[11px] text-[var(--color-text-muted)]">
                {source.meta}
              </div>
            )}
            {source.excerpt && (
              <div className="mt-3 rounded-lg bg-white p-2.5 text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
                {source.excerpt}
              </div>
            )}
          </div>
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-semibold text-[var(--color-brand)] transition hover:bg-[var(--color-tag-bg)]"
            style={{ borderColor: "rgba(123,104,238,0.28)" }}
          >
            Open source
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </aside>
  );
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// ─── Current event panel ─────────────────────────────────────────────────────

function CurrentEventPanel({
  summary,
  message,
}: {
  summary: ReturnType<typeof buildAskAiReasoningSummary>;
  message: Extract<Msg, { kind: "stream" }>;
}) {
  const current = currentStreamEvent(message);
  const isAnswering = message.text.length > 0 || message.done;
  const displayTitle = message.done && !message.error ? summary.compactLabel : current.title;
  const displayMessage = message.done && !message.error ? "" : current.message;

  return (
    <div
      className="min-w-0 rounded-2xl border px-3 py-2.5"
      style={{
        borderColor: message.done ? "var(--color-border-default)" : "rgba(123,104,238,0.22)",
        background: message.done ? "#fff" : "#FAFBFF",
      }}
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
            style={{
              background: message.done ? "var(--color-success-bg)" : "var(--color-tag-bg)",
              color: message.done ? "var(--color-success)" : "var(--color-brand)",
            }}
          >
            {message.done ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
          </span>
          <div className="min-w-0">
            <div
              className="truncate text-[12px] font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              {displayTitle}
            </div>
            {displayMessage && (
              <div
                className="mt-0.5 break-words text-[12px] leading-relaxed"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {displayMessage}
              </div>
            )}
          </div>
        </div>
        <span
          className="shrink-0 text-[11px] font-medium"
          style={{ color: "var(--color-text-muted)" }}
        >
          {message.done ? "done" : "live"}
        </span>
      </div>
      {!isAnswering && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {summary.chips.length > 0 ? (
            summary.chips.map((chip) => (
              <span
                key={chip}
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ background: "#F5F7FB", color: "var(--color-text-muted)" }}
              >
                {chip}
              </span>
            ))
          ) : (
            <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
              Waiting for context, retrieval, and AI activity...
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function currentStreamEvent(message: Extract<Msg, { kind: "stream" }>): {
  title: string;
  message: string;
} {
  if (message.done) {
    return {
      title: message.error ? "Ask AI stopped" : "Answer ready",
      message: message.error ?? "AI finished generating the cited answer.",
    };
  }

  const latestApproach = message.approaches.at(-1);
  if (latestApproach) {
    return {
      title: "Planning answer",
      message: latestApproach,
    };
  }

  const latest = message.activity.at(-1);
  if (!latest) {
    return {
      title: "Opening Ask AI stream",
      message: "Connecting to the backend and preparing project context.",
    };
  }

  if (latest.type === "status") {
    return {
      title: statusTitle(latest.stage),
      message: sanitizeAiActivityMessage(latest.message),
    };
  }

  return {
    title: `${sourceTitle(latest.kind)} (${latest.count})`,
    message: sanitizeAiActivityMessage(latest.message),
  };
}

function sanitizeAiActivityMessage(message: string): string {
  return message
    .replace(/Gemini/gi, "AI")
    .replace(/\bLLM\b/g, "AI")
    .replace(/^Calling AI$/i, "Drafting cited answer")
    .trim();
}

function statusTitle(stage: string): string {
  if (stage === "context") return "Reading project context";
  if (stage === "retrieval") return "Matching workbook and PDF evidence";
  if (stage === "web") return "Checking approved external sources";
  if (stage === "llm") return "Asking AI";
  if (stage === "finalizing") return "Finalizing citations";
  return "Processing";
}

function sourceTitle(kind: string): string {
  if (kind === "uploaded_pdf") return "PDFs";
  if (kind === "uploaded_sheet") return "Screen context";
  if (kind === "model") return "Model fields";
  if (kind === "source_registry") return "Registered sources";
  if (kind === "web") return "Web results";
  return "Evidence source";
}

// ─── Copy button ─────────────────────────────────────────────────────────────

function CopyButton({ text, className = "" }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const value = text.trim();
    if (!value) return;
    await navigator.clipboard?.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1000);
  };
  return (
    <IconTooltip label={copied ? "Copied" : "Copy message"}>
      <button
        type="button"
        onClick={() => void copy()}
        className={`copy-button flex h-6 w-6 shrink-0 items-center justify-center rounded-md border bg-white transition hover:bg-[var(--color-tag-bg)] ${className}`}
        style={{
          borderColor: "var(--color-border-default)",
          color: "var(--color-text-muted)",
        }}
        aria-label={copied ? "Copied" : "Copy message"}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </IconTooltip>
  );
}

// ─── Status stream ────────────────────────────────────────────────────────────

function StatusStream({ steps }: { steps: string[] }) {
  const [done, setDone] = useState(0);
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= steps.length; i++) {
      timers.push(setTimeout(() => setDone(i), i * 800));
    }
    return () => timers.forEach(clearTimeout);
  }, [steps.length]);

  const durations = ["1.2s", "0.8s", "2.1s", "1.4s"];

  return (
    <AiBubble>
      <div className="space-y-2">
        {steps.map((s, i) => {
          const isDone = i < done;
          return (
            <div
              key={s}
              className="flex items-center justify-between py-1"
              style={{
                borderBottom: i < steps.length - 1 ? "1px solid #F3F4F6" : undefined,
                opacity: i <= done ? 1 : 0.35,
              }}
            >
              <div className="flex items-center gap-2">
                {isDone ? (
                  <Check className="h-3.5 w-3.5" style={{ color: "var(--color-success)" }} />
                ) : (
                  <Loader2
                    className="h-3.5 w-3.5 animate-spin"
                    style={{ color: "var(--color-brand)" }}
                  />
                )}
                <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                  {s}
                </span>
              </div>
              <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                {isDone ? `done · ${durations[i] ?? "1.0s"}` : "…"}
              </span>
            </div>
          );
        })}
      </div>
    </AiBubble>
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function screenNameForPath(path: string): string {
  const clean = path.replace(/^\/+/, "") || "Dashboard";
  const labelByPath: Record<string, string> = {
    inbox: "Analysis Requests",
  };
  if (labelByPath[clean]) return labelByPath[clean];
  return clean
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function HistoryChatList({
  sessions,
  loading,
  error,
  onRetry,
  onLoadChat,
  onRenameChat,
  onDeleteChat,
}: {
  sessions: AskAiChatSessionSummary[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onLoadChat: (chat: AskAiChatSessionSummary) => void;
  onRenameChat: (chat: AskAiChatSessionSummary) => void;
  onDeleteChat: (chat: AskAiChatSessionSummary) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
      {loading ? (
        <div
          className="px-2 py-4"
          role="status"
          aria-live="polite"
          aria-label="Loading past Ask AI chats"
        >
          <div
            className="mb-3 flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5"
            style={{ borderColor: "var(--color-border-default)" }}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-tag-bg)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-brand)]" />
            </span>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-[var(--color-text-primary)]">
                Loading past chats
              </div>
              <div className="text-[11px] text-[var(--color-text-muted)]">
                Fetching your Ask AI thread history...
              </div>
            </div>
          </div>
          <div className="space-y-2" aria-hidden="true">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="rounded-lg border bg-white px-3 py-2"
                style={{ borderColor: "var(--color-border-default)" }}
              >
                <div
                  className="h-3 w-3/4 animate-pulse rounded-full"
                  style={{ background: "var(--color-table-header)" }}
                />
                <div
                  className="mt-2 h-2.5 w-1/2 animate-pulse rounded-full"
                  style={{ background: "var(--color-table-header)" }}
                />
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="px-2 py-8 text-center">
          <History className="mx-auto mb-2 h-8 w-8 text-[var(--color-text-muted)]" />
          <div className="text-[12px] text-[var(--color-danger-fg)]">{error}</div>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-md border px-3 py-1.5 text-[12px] font-medium"
            style={{
              borderColor: "var(--color-border-default)",
              color: "var(--color-text-primary)",
            }}
          >
            Retry
          </button>
        </div>
      ) : sessions.length === 0 ? (
        <div className="px-2 py-8 text-center">
          <History className="mx-auto mb-2 h-8 w-8 text-[var(--color-text-muted)]" />
          <div className="text-[12px] text-[var(--color-text-muted)]">No Ask AI threads yet.</div>
        </div>
      ) : (
        groupChatsByDate(sessions).map((group) => (
          <div key={group.label} className="mb-2">
            <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {group.label}
            </div>
            {group.chats.map((chat) => (
              <div
                key={chat.id}
                className="group flex w-full items-center gap-1 rounded-lg px-2 py-1.5 transition hover:bg-[var(--color-tag-bg)]"
              >
                <button
                  type="button"
                  onClick={() => onLoadChat(chat)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-[13px] text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]">
                    {chat.title || "Untitled Ask AI thread"}
                  </span>
                  <span className="block truncate text-[10px] text-[var(--color-text-muted)]">
                    {[chat.companyName, chat.screenName].filter(Boolean).join(" · ")}
                  </span>
                </button>
                <IconTooltip label="Rename thread">
                  <button
                    type="button"
                    onClick={() => onRenameChat(chat)}
                    className="rounded-md p-1 opacity-0 transition hover:bg-white group-hover:opacity-100 focus:opacity-100"
                    aria-label="Rename thread"
                  >
                    <Pencil className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                  </button>
                </IconTooltip>
                <IconTooltip label="Delete thread">
                  <button
                    type="button"
                    onClick={() => onDeleteChat(chat)}
                    className="rounded-md p-1 opacity-0 transition hover:bg-white group-hover:opacity-100 focus:opacity-100"
                    aria-label="Delete thread"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-[var(--color-danger-fg)]" />
                  </button>
                </IconTooltip>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

function groupChatsByDate(
  chats: AskAiChatSessionSummary[],
): Array<{ label: string; chats: AskAiChatSessionSummary[] }> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const groups: Array<{ label: string; test: (ms: number) => boolean }> = [
    { label: "Today", test: (ms) => ms >= startOfToday },
    { label: "Yesterday", test: (ms) => ms >= startOfToday - 86400000 },
    { label: "Previous 7 days", test: (ms) => ms >= startOfToday - 7 * 86400000 },
    { label: "Previous 30 days", test: (ms) => ms >= startOfToday - 30 * 86400000 },
    { label: "Older", test: () => true },
  ];
  const result: Array<{ label: string; chats: AskAiChatSessionSummary[] }> = [];
  const remaining = [...chats];
  for (const group of groups) {
    const matched = remaining.filter((c) => group.test(new Date(c.updatedAt).getTime()));
    matched.forEach((c) => remaining.splice(remaining.indexOf(c), 1));
    if (matched.length > 0) result.push({ label: group.label, chats: matched });
  }
  return result;
}

export function useGlobalToast() {
  const routerLoc = useRouterState({ select: (s) => s.location.pathname });
  return routerLoc;
}
