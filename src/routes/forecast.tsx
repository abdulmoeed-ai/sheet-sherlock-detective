import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { PageShell } from "@/components/PageShell";
import { sidebarStore } from "@/lib/sidebar-store";

export const Route = createFileRoute("/forecast")({
  head: () => ({
    meta: [
      { title: "Ask AI" },
      {
        name: "description",
        content: "Expanded Ask AI forecasting chat for analyst forecasts and scenario assumptions.",
      },
    ],
  }),
  component: ForecastRoute,
});

function ForecastRoute() {
  useEffect(() => {
    sidebarStore.setCollapsed(false);
  }, []);

  return (
    <PageShell
      title="Ask AI"
      subtitle="Expanded Ask AI forecasting chat for analyst forecasts and scenario assumptions."
      hideProgress
    >
      <div
        className="min-h-[calc(100vh-8rem)] bg-[var(--color-page)]"
        aria-label="Ask AI workspace"
      />
    </PageShell>
  );
}
