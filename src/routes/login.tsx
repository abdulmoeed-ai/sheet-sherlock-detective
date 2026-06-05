import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/components/LoginPage";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Sheet Sherlock" },
      {
        name: "description",
        content: "Sign in to the Sheet Sherlock AI finance command center.",
      },
    ],
  }),
  component: LoginPage,
});
