import { createContext, useContext } from "react";
import type { AuthSession } from "@/lib/auth-session";

export type AuthContextValue = {
  session: AuthSession;
  signOut: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthGate.");
  }
  return context;
}
