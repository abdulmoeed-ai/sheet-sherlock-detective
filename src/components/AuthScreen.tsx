import { useState } from "react";
import { LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getCurrentUser,
  loginUser,
  registerUser,
  roleOptions,
  selfServiceRoleOptions,
  type HumanRole,
  type User,
} from "@/lib/api/auth";
import { saveSession, type AuthSession } from "@/lib/auth-session";

type AuthMode = "login" | "signup";

export function AuthScreen({ onAuthenticated }: { onAuthenticated: (session: AuthSession) => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<HumanRole>("finance_analyst");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      let user: User | null = null;
      if (mode === "signup") {
        user = await registerUser({ name, email, password, role });
      }

      const tokens = await loginUser({ email, password });
      const currentUser = user ?? (await getCurrentUser(tokens.access_token));
      onAuthenticated(saveSession(tokens, currentUser));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedRole = roleOptions.find((option) => option.value === role) ?? roleOptions[0];

  return (
    <main className="min-h-screen bg-page px-4 py-6 text-text-primary sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center">
        <section className="grid w-full overflow-hidden rounded-lg border border-border-default bg-card shadow-sm lg:grid-cols-[0.95fr_1.05fr]">
          <div className="flex flex-col justify-between border-b border-border-default bg-table-header p-6 sm:p-8 lg:border-b-0 lg:border-r">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand text-white">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h1 className="text-xl font-semibold tracking-normal text-text-primary">Sheet Sherlock</h1>
                  <p className="text-sm text-text-secondary">Role-based financial workflow access</p>
                </div>
              </div>

              <div className="mt-10 space-y-4">
                {roleOptions.map((option) => (
                  <div
                    key={option.value}
                    className="rounded-md border border-border-default bg-card p-4"
                  >
                    <p className="text-sm font-semibold text-text-primary">{option.label}</p>
                    <p className="mt-1 text-sm leading-6 text-text-secondary">{option.summary}</p>
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-8 text-xs leading-5 text-text-muted">
              Sheet Sherlock System remains an internal AI audit actor and is not a signup role.
            </p>
          </div>

          <div className="p-6 sm:p-8">
            <div className="mb-8 flex gap-2 rounded-md border border-border-default bg-table-header p-1">
              <Button
                type="button"
                variant={mode === "login" ? "default" : "ghost"}
                className="flex-1"
                onClick={() => setMode("login")}
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                Sign in
              </Button>
              <Button
                type="button"
                variant={mode === "signup" ? "default" : "ghost"}
                className="flex-1"
                onClick={() => setMode("signup")}
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Create account
              </Button>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-semibold tracking-normal text-text-primary">
                {mode === "login" ? "Sign in to continue" : "Create your workspace access"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                {mode === "login"
                  ? "Use the credentials created for your analysis workflow."
                  : "Choose the human role that matches your Sheet Sherlock workflow lane."}
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              {mode === "signup" ? (
                <div className="space-y-2">
                  <Label htmlFor="auth-name">Name</Label>
                  <Input
                    id="auth-name"
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="auth-email">Email</Label>
                <Input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="auth-password">Password</Label>
                <Input
                  id="auth-password"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>

              {mode === "signup" ? (
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={role} onValueChange={(value) => setRole(value as HumanRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {selfServiceRoleOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs leading-5 text-text-muted">{selectedRole.summary}</p>
                </div>
              ) : null}

              {error ? (
                <div className="rounded-md border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger-fg">
                  {error}
                </div>
              ) : null}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {mode === "login" ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                {isSubmitting ? "Working..." : mode === "login" ? "Sign in" : "Create account"}
              </Button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
