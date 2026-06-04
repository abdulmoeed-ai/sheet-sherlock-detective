import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/api/query-keys";
import { invalidateComments } from "./use-project-actions";

describe("project action hooks", () => {
  it("does not invalidate the workspace when comments change", () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockImplementation(() => Promise.resolve());

    invalidateComments(queryClient, "project-1");

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.comments("project-1"),
    });
    expect(invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: queryKeys.workspace("project-1"),
    });
  });
});
