interface ProductWordmarkProps {
  className?: string;
  aiClassName?: string;
  textClassName?: string;
}

export function ProductWordmark({
  className = "",
  aiClassName = "text-[var(--color-brand)]",
  textClassName = "text-[var(--color-text-primary)]",
}: ProductWordmarkProps) {
  return (
    <span className={className} aria-label="finance">
      <span className={textClassName}>fin</span>
      <span className={aiClassName}>ai</span>
      <span className={textClassName}>nce</span>
    </span>
  );
}
