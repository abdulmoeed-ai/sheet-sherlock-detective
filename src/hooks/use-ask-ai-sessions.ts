import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteAskAiSession,
  listAskAiSessions,
  readAskAiSession,
  renameAskAiSession,
} from "@/lib/api/projects";
import { queryKeys } from "@/lib/api/query-keys";

export function useAskAiSessions() {
  const queryClient = useQueryClient();
  const sessionsQuery = useQuery({
    queryKey: queryKeys.askAiSessions,
    queryFn: () => listAskAiSessions({ limit: 20 }),
    staleTime: 0,
    refetchOnMount: false,
    enabled: false,
  });

  const renameMutation = useMutation({
    mutationFn: ({ sessionId, title }: { sessionId: string; title: string }) =>
      renameAskAiSession(sessionId, title),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.askAiSessions }),
  });

  const deleteMutation = useMutation({
    mutationFn: (sessionId: string) => deleteAskAiSession(sessionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.askAiSessions }),
  });

  return {
    sessions: sessionsQuery.data ?? [],
    loading: sessionsQuery.isFetching,
    error: sessionsQuery.error instanceof Error ? sessionsQuery.error.message : null,
    refreshSessions: sessionsQuery.refetch,
    loadSession: readAskAiSession,
    renameSession: (sessionId: string, title: string) => renameMutation.mutateAsync({ sessionId, title }),
    deleteSession: (sessionId: string) => deleteMutation.mutateAsync(sessionId),
  };
}
