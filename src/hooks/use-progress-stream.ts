import { useEffect, useState } from "react";
import { wsUrl } from "@/lib/api/config";

export interface ProgressEvent {
  projectId?: string;
  stage?: string;
  percent?: number;
  message?: string;
  status?: string;
  [key: string]: unknown;
}

export function useProgressStream(projectId: string | null) {
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    const socket = new WebSocket(wsUrl(`/api/ws/projects/${projectId}/progress`));
    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onerror = () => setConnected(false);
    socket.onmessage = (message) => {
      try {
        setEvents((current) => [...current.slice(-49), JSON.parse(message.data)]);
      } catch {
        setEvents((current) => [...current.slice(-49), { message: String(message.data) }]);
      }
    };
    return () => socket.close();
  }, [projectId]);

  return { events, connected, lastEvent: events.at(-1) ?? null };
}
