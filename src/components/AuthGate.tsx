import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { AuthScreen } from "@/components/AuthScreen";
import { Button } from "@/components/ui/button";
import { clearSession, loadSession, type AuthSession } from "@/lib/auth-session";
import { roleOptions } from "@/lib/api/auth";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    setSession(loadSession());
    setHasLoaded(true);
  }, []);

  if (!hasLoaded) {
    return <div className="min-h-screen bg-page" />;
  }

  if (!session) {
    return <AuthScreen onAuthenticated={setSession} />;
  }

  const roleLabel = roleOptions.find((option) => option.value === session.user.role)?.label ?? session.user.role;

  return (
    <>
      <div className="fixed right-20 top-3 z-40 flex max-w-[calc(100vw-6rem)] items-center gap-2 rounded-md border border-border-default bg-card px-3 py-2 shadow-sm">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-text-primary">{session.user.name}</p>
          <p className="truncate text-[11px] text-text-muted">{roleLabel}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Sign out"
          onClick={() => {
            clearSession();
            setSession(null);
          }}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
      {children}
    </>
  );
}
