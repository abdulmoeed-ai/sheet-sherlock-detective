import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/components/LoginPage";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — F(AI)nance" },
      {
        name: "description",
        content: "Sign in to the F(AI)nance AI finance command center.",
      },
    ],
  }),
  component: LoginPage,
});
