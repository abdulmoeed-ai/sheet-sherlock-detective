import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useLogin } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api/errors";

export function LoginPage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[var(--color-sidebar-bg)] px-5 py-8 text-slate-100 sm:px-8">
      <BackgroundTexture />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col">
        <BrandHeader />
        <section className="grid flex-1 items-center gap-10 py-10 md:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] md:gap-16">
          <div className="order-2 md:order-1">
            <LoginIntroCopy />
          </div>
          <div className="order-1 flex justify-center md:order-2 md:justify-end">
            <LoginCard />
          </div>
        </section>
        <FooterTrustLine />
      </div>
    </main>
  );
}

function BrandHeader() {
  return (
    <header className="mx-auto max-w-3xl text-center">
      <h1 className="text-4xl font-semibold leading-none text-white sm:text-5xl">Sheet Sherlock</h1>
      <p className="mt-3 text-sm font-medium uppercase tracking-[0.18em] text-[var(--color-accent-mid)]">
        AI-Enabled Finance Command Center
      </p>
    </header>
  );
}

function LoginIntroCopy() {
  return (
    <section className="mx-auto max-w-xl text-center md:mx-0 md:text-left">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">Model review</p>
      <h2 className="mt-4 text-4xl font-semibold leading-tight text-white sm:text-5xl">
        Financial models, built for review.
      </h2>
      <div className="mt-8 space-y-3 text-xl font-medium leading-8 text-slate-300 sm:text-2xl">
        <p>For analysts.</p>
        <p>For managers.</p>
        <p>For the next decision.</p>
      </div>
    </section>
  );
}

function LoginCard() {
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const error = localError ?? apiError(login.error);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);

    if (!email.trim() || !password) {
      setLocalError("Enter your email and password to continue.");
      return;
    }

    await login.mutateAsync({ email: email.trim(), password });
  };

  return (
    <form
      noValidate
      onSubmit={submit}
      className="w-full max-w-[420px] rounded-2xl border border-white/85 bg-white p-6 text-slate-950 shadow-[0_30px_90px_rgba(2,6,23,0.4)] sm:p-8"
    >
      <div>
        <h2 className="text-3xl font-semibold leading-tight text-slate-950">Welcome back.</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">Sign in to continue your work.</p>
      </div>

      <div className="mt-7 space-y-4">
        <label className="block" htmlFor="email">
          <span className="text-sm font-semibold text-slate-700">Email</span>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="analyst@company.com"
            className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[var(--color-brand)] focus:ring-4 focus:ring-[rgba(123,104,238,0.16)]"
          />
        </label>

        <label className="block" htmlFor="password">
          <span className="text-sm font-semibold text-slate-700">Password</span>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[var(--color-brand)] focus:ring-4 focus:ring-[rgba(123,104,238,0.16)]"
          />
        </label>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={login.isPending}
        className="mt-6 h-11 w-full rounded-xl bg-[var(--color-brand)] text-sm font-semibold text-white shadow-lg shadow-[rgba(123,104,238,0.24)] hover:bg-[var(--color-brand-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-2 disabled:opacity-70"
      >
        {login.isPending ? "Signing in..." : "Sign In"}
      </Button>

      <div className="mt-5 flex items-center justify-between gap-4 text-sm">
        <span className="text-slate-500">Forgot password?</span>
        <a
          href="#reset-access"
          className="font-semibold text-[var(--color-brand)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]"
        >
          Reset access
        </a>
      </div>
    </form>
  );
}

function FooterTrustLine() {
  return (
    <footer className="pb-2 text-center text-sm font-medium tracking-[0.08em] text-slate-400">
      Cited. Checked. Approved. Auditable.
    </footer>
  );
}

function BackgroundTexture() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_32%,rgba(123,104,238,0.24),transparent_30%),linear-gradient(135deg,var(--color-sidebar-bg)_0%,#151b2a_48%,var(--color-sidebar-active)_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.055] [background-image:linear-gradient(rgba(237,233,254,0.34)_1px,transparent_1px),linear-gradient(90deg,rgba(237,233,254,0.34)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/[0.08] to-transparent" />
    </>
  );
}

function apiError(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Request failed.";
}
