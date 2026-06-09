type NotificationPermissionResult = NotificationPermission | "unsupported";

export function shouldNotifyAskAiCompletion({
  pageHidden,
  panelOpen,
}: {
  pageHidden: boolean;
  panelOpen: boolean;
}) {
  return pageHidden || !panelOpen;
}

export function askAiCompletionNotificationBody({
  threadTitle,
  question,
}: {
  threadTitle: string;
  question: string;
}) {
  const cleanTitle = compactNotificationText(threadTitle) || "Ask AI";
  const cleanQuestion = compactNotificationText(question);
  if (!cleanQuestion) return `${cleanTitle} is ready.`;
  return `${cleanTitle}: ${cleanQuestion}`.slice(0, 140);
}

export async function requestAskAiNotificationPermission(): Promise<NotificationPermissionResult> {
  if (typeof window === "undefined" || typeof window.Notification === "undefined") {
    return "unsupported";
  }
  if (window.Notification.permission !== "default") {
    return window.Notification.permission;
  }
  return window.Notification.requestPermission();
}

export function showAskAiCompletionNotification({
  threadTitle,
  question,
  panelOpen,
  onClick,
}: {
  threadTitle: string;
  question: string;
  panelOpen: boolean;
  onClick?: () => void;
}) {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (typeof window.Notification === "undefined") return false;
  if (window.Notification.permission !== "granted") return false;
  if (
    !shouldNotifyAskAiCompletion({ pageHidden: document.visibilityState === "hidden", panelOpen })
  ) {
    return false;
  }

  const notification = new window.Notification("Ask AI response ready", {
    body: askAiCompletionNotificationBody({ threadTitle, question }),
    tag: "ask-ai-response-ready",
  });
  if (onClick) {
    notification.onclick = () => {
      window.focus();
      onClick();
      notification.close();
    };
  }
  return true;
}

function compactNotificationText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
