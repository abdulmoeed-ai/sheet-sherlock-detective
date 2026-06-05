interface ProductWordmarkProps {
  className?: string;
  aiClassName?: string;
  prefix?: "F" | "f";
}

export function ProductWordmark({
  className = "",
  aiClassName = "text-[var(--color-brand)]",
  prefix = "F",
}: ProductWordmarkProps) {
  return (
    <span className={className}>
      {prefix}
      <span className={aiClassName}>(AI)</span>nance
    </span>
  );
}
