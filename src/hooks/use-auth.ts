import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { loginUser, readCurrentUser, registerUser } from "@/lib/api/auth";
import { queryKeys } from "@/lib/api/query-keys";
import { clearAuthTokens, getAccessToken, setAuthTokens } from "@/lib/auth-store";
import { defaultRouteForRole } from "@/lib/role-access";

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: readCurrentUser,
    enabled: !!getAccessToken(),
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: loginUser,
    onSuccess: async (tokens) => {
      setAuthTokens({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
      const user = await queryClient.fetchQuery({
        queryKey: queryKeys.me,
        queryFn: readCurrentUser,
      });
      navigate({ to: defaultRouteForRole(user.role) as never });
    },
  });
}

export function useRegister() {
  return useMutation({ mutationFn: registerUser });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return () => {
    clearAuthTokens();
    queryClient.clear();
    navigate({ to: "/login" });
  };
}
