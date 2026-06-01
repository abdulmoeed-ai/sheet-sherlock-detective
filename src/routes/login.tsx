import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Search, ShieldCheck } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import type { FrontendRole } from "@/lib/api/types";
import { useLogin, useRegister } from "@/hooks/use-auth";
import { backendRole } from "@/lib/role-access";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Sheet Sherlock" },
      { name: "description", content: "Sign in to Sheet Sherlock by role." },
    ],
  }),
  component: Login,
});

type RegisterRole = Exclude<FrontendRole, "admin">;

function Login() {
  const login = useLogin();
  const register = useRegister();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [role, setRole] = useState<RegisterRole>("analyst");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const error = message ?? apiError(login.error) ?? apiError(register.error);
  const loading = login.isPending || register.isPending;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (mode === "register") {
      await register.mutateAsync({ name, email, password, role: backendRole(role) });
      setMessage("User registered. Signing in...");
    }
    await login.mutateAsync({ email, password });
  };

  return (
    <main className="flex min-h-screen bg-[var(--color-page)]">
      <section className="hidden w-[42%] flex-col justify-between bg-[var(--color-sidebar-bg)] p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-brand)]">
            <Search className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[16px] font-semibold">Sheet Sherlock</div>
            <div className="text-[11px] uppercase tracking-wider text-[var(--color-sidebar-icon)]">
              FP&amp;A workflow
            </div>
          </div>
        </div>
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-[12px]">
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-sidebar-icon)]" />
            Role-aware access
          </div>
          <h1 className="max-w-md text-[32px] font-bold leading-tight">
            Connect the detective workflow to live backend data.
          </h1>
          <p className="mt-4 max-w-md text-[14px] leading-relaxed text-[var(--color-sidebar-text)]">
            Analysts work from Inbox through model preparation. Managers review packs. CFOs sign
            off. Admins manage source controls.
          </p>
        </div>
        <div className="text-[11px] text-[var(--color-sidebar-text)]">
          Use seeded Admin credentials for admin login.
        </div>
      </section>
      <section className="flex flex-1 items-center justify-center px-5">
        <form
          onSubmit={submit}
          className="w-full max-w-[420px] rounded-xl border bg-white p-6"
          style={{ borderColor: "var(--color-border-default)" }}
        >
          <div className="mb-5">
            <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Welcome
            </div>
            <h2 className="mt-1 text-[24px] font-bold text-[var(--color-text-primary)]">
              {mode === "login" ? "Sign in" : "Create user"}
            </h2>
          </div>

          <div
            className="mb-5 grid grid-cols-2 rounded-lg border p-1"
            style={{ borderColor: "var(--color-border-default)" }}
          >
            {(["login", "register"] as const).map((nextMode) => (
              <button
                key={nextMode}
                type="button"
                onClick={() => setMode(nextMode)}
                className="h-9 rounded-md text-[13px] font-semibold"
                style={
                  mode === nextMode
                    ? { background: "var(--color-brand)", color: "#fff" }
                    : { color: "var(--color-text-secondary)" }
                }
              >
                {nextMode === "login" ? "Login" : "Register"}
              </button>
            ))}
          </div>

          {mode === "register" && (
            <>
              <label className="mb-3 block">
                <span className="mb-1 block text-[12px] font-semibold text-[var(--color-text-secondary)]">
                  Name
                </span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-10 w-full rounded-md border px-3 text-[13px]"
                  style={{ borderColor: "var(--color-border-strong)" }}
                  required
                />
              </label>
              <div className="mb-3 grid grid-cols-3 gap-2">
                {(["analyst", "manager", "cfo"] as RegisterRole[]).map((nextRole) => (
                  <button
                    key={nextRole}
                    type="button"
                    onClick={() => setRole(nextRole)}
                    className="h-9 rounded-md border text-[12px] font-semibold capitalize"
                    style={
                      role === nextRole
                        ? {
                            borderColor: "var(--color-brand)",
                            background: "var(--color-tag-bg)",
                            color: "var(--color-brand)",
                          }
                        : {
                            borderColor: "var(--color-border-default)",
                            color: "var(--color-text-secondary)",
                          }
                    }
                  >
                    {nextRole}
                  </button>
                ))}
              </div>
            </>
          )}

          <label className="mb-3 block">
            <span className="mb-1 block text-[12px] font-semibold text-[var(--color-text-secondary)]">
              Email
            </span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-10 w-full rounded-md border px-3 text-[13px]"
              style={{ borderColor: "var(--color-border-strong)" }}
              required
            />
          </label>
          <label className="mb-4 block">
            <span className="mb-1 block text-[12px] font-semibold text-[var(--color-text-secondary)]">
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-10 w-full rounded-md border px-3 text-[13px]"
              style={{ borderColor: "var(--color-border-strong)" }}
              required
            />
          </label>

          {error && (
            <div
              className="mb-4 rounded-md border px-3 py-2 text-[12px]"
              style={{
                borderColor: "var(--color-danger-border)",
                background: "var(--color-danger-bg)",
                color: "var(--color-danger-fg)",
              }}
            >
              {error}
            </div>
          )}

          <button
            disabled={loading}
            className="h-10 w-full rounded-lg text-[13px] font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--color-brand)" }}
          >
            {loading ? "Working..." : mode === "login" ? "Sign in" : "Create and sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

function apiError(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Request failed.";
}
