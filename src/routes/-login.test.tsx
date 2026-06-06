import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginPage } from "@/components/LoginPage";

vi.mock("@/hooks/use-auth", () => ({
  useLogin: () => ({
    error: null,
    isPending: false,
    mutateAsync: vi.fn(),
  }),
  useRegister: () => ({
    error: null,
    isPending: false,
    mutateAsync: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
});

describe("LoginPage", () => {
  it("renders the minimal market-ready login experience", () => {
    render(<LoginPage />);

    expect(screen.getByRole("heading", { name: "finance" })).toBeTruthy();
    expect(screen.getByText("AI-Enabled Finance Command Center")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Financial models, built for review." }),
    ).toBeTruthy();
    expect(screen.getByText("For analysts.")).toBeTruthy();
    expect(screen.getByText("For managers.")).toBeTruthy();
    expect(screen.getByText("For the next decision.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Welcome back." })).toBeTruthy();
    expect(screen.getByText("Sign in to continue your work.")).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeTruthy();
    expect(screen.getByText("Forgot password?")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Reset access" })).toBeTruthy();
    expect(screen.getByText("Cited. Checked. Approved. Auditable.")).toBeTruthy();

    expect(screen.queryByRole("button", { name: "Continue with SSO" })).toBeNull();
    expect(screen.queryByText("Board-ready forecast governance")).toBeNull();
    expect(screen.queryByText("Leadership outcomes")).toBeNull();
    expect(screen.queryByText("Source citations")).toBeNull();
    expect(screen.queryByText("Every forecast decision is backed")).toBeNull();
  });

  it("shows a validation error when the local form is submitted empty", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Sign In" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Enter your email and password to continue.",
    );
  });
});
