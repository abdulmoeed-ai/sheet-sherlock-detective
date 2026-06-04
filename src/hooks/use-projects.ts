import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createProject, listProjects, readWorkspace } from "@/lib/api/projects";
import { queryKeys } from "@/lib/api/query-keys";

export function useProjects() {
  return useQuery({ queryKey: queryKeys.projects, queryFn: listProjects });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects }),
  });
}

export function useWorkspace(projectId: string | null) {
  return useQuery({
    queryKey: projectId ? queryKeys.workspace(projectId) : ["projects", "none", "workspace"],
    queryFn: () => readWorkspace(projectId as string),
    enabled: !!projectId,
    staleTime: 0,
    refetchOnMount: "always",
  });
}
