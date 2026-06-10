import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useNavigate,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Toaster, toast } from "sonner";
import { AskAiTrigger } from "@/components/AskAiTrigger";
import { ProductWordmark } from "@/components/ProductWordmark";
import { useCurrentUser } from "@/hooks/use-auth";
import { clearAuthTokens, getAccessToken } from "@/lib/auth-store";
import { ApiError } from "@/lib/api/errors";
import { canSeeRoute, defaultRouteForRole } from "@/lib/role-access";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "finance — Intelligent Financial Predictions" },
      {
        name: "description",
        content:
          "AI-powered FP&A platform for cell-level ingestion, balance sheet diagnosis and predictive forecasting.",
      },
      { property: "og:title", content: "finance — Intelligent Financial Predictions" },
      {
        property: "og:description",
        content:
          "AI-powered FP&A platform for cell-level ingestion, balance sheet diagnosis and predictive forecasting.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "finance — Intelligent Financial Predictions" },
      {
        name: "twitter:description",
        content:
          "AI-powered FP&A platform for cell-level ingestion, balance sheet diagnosis and predictive forecasting.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/41130c4b-ff95-494b-839d-9ae062472119/id-preview-48ea5185--b0fa8bfc-8135-4e19-b6b6-2b9beab7f185.lovable.app-1779285571019.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/41130c4b-ff95-494b-839d-9ae062472119/id-preview-48ea5185--b0fa8bfc-8135-4e19-b6b6-2b9beab7f185.lovable.app-1779285571019.png",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      toast.success(detail);
    };
    window.addEventListener("sherlock-toast", handler);
    return () => window.removeEventListener("sherlock-toast", handler);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthenticatedApp />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#E8F5E9",
            border: "1px solid #A7D7A9",
            color: "#2E7D32",
          },
        }}
      />
    </QueryClientProvider>
  );
}

function AuthenticatedApp() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const token = getAccessToken();
  const isLogin = pathname === "/login";
  const { data: user, error, isLoading, isError } = useCurrentUser();

  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) {
      clearAuthTokens();
      if (!isLogin) {
        navigate({ to: "/login" });
      }
      return;
    }
    if (isLogin) {
      if (user) {
        navigate({ to: defaultRouteForRole(user.role) as never });
      }
      return;
    }
    if (!token || isError) {
      navigate({ to: "/login" });
      return;
    }
    if (user && !canSeeRoute(user.role, pathname)) {
      navigate({ to: defaultRouteForRole(user.role) as never });
    }
  }, [error, isLogin, isError, navigate, pathname, token, user]);

  if (isLogin) return <Outlet />;
  if (!token || isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-page)] text-[13px] text-[var(--color-text-secondary)]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--color-brand)]" aria-hidden="true" />
          <div className="flex items-center gap-1.5 font-medium" role="status" aria-live="polite">
            <span>Loading</span>
            <ProductWordmark aiClassName="text-[var(--color-brand)]" />
            <span className="flex w-5 items-center gap-0.5" aria-hidden="true">
              <span className="h-1 w-1 animate-bounce rounded-full bg-[var(--color-brand)] [animation-delay:-0.2s]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-[var(--color-brand)] [animation-delay:-0.1s]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-[var(--color-brand)]" />
            </span>
          </div>
        </div>
      </div>
    );
  }
  return (
    <>
      <Outlet />
      <AskAiTrigger />
    </>
  );
}
