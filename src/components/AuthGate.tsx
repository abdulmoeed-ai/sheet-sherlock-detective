import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthScreen } from "@/components/AuthScreen";
import { AuthContext } from "@/lib/auth-context";
import { clearSession, loadSession, type AuthSession } from "@/lib/auth-session";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    setSession(loadSession());
    setHasLoaded(true);
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  const contextValue = useMemo(() => (session ? { session, signOut } : null), [session, signOut]);

  if (!hasLoaded) {
    return <div className="min-h-screen bg-page" />;
  }

  if (!session) {
    return <AuthScreen onAuthenticated={setSession} />;
  }

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
