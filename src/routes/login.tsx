import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/components/LoginPage";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — finance" },
      {
        name: "description",
        content: "Sign in to the finance AI finance command center.",
      },
    ],
  }),
  component: LoginPage,
});
