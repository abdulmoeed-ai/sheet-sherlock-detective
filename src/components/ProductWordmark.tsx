interface ProductWordmarkProps {
  className?: string;
  aiClassName?: string;
}

export function ProductWordmark({
  className = "",
  aiClassName = "text-[var(--color-brand)]",
}: ProductWordmarkProps) {
  return (
    <span className={className}>
      F<span className={aiClassName}>(AI)</span>nance
    </span>
  );
}
