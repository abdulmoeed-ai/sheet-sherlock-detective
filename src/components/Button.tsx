import type { ButtonHTMLAttributes, ReactNode } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  children: ReactNode;
}

export function Button({ variant = "primary", children, className = "", ...rest }: Props) {
  const base =
    "inline-flex cursor-pointer items-center justify-center gap-2 text-[14px] font-semibold rounded-lg transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
  const variants: Record<string, string> = {
    primary: "h-11 px-6 text-white",
    secondary: "h-10 px-5",
    ghost: "h-9 px-3",
    danger: "h-10 px-5 text-white",
  };
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: "var(--color-brand)" },
    secondary: {
      background: "#fff",
      color: "var(--color-brand)",
      border: "1px solid var(--color-border-strong)",
    },
    ghost: { background: "transparent", color: "var(--color-text-secondary)" },
    danger: { background: "var(--color-danger)" },
  };
  return (
    <button
      {...rest}
      className={`${base} ${variants[variant]} ${className}`}
      style={styles[variant]}
    >
      {children}
    </button>
  );
}
