interface ProductLogoProps {
  className?: string;
}

export function ProductLogo({ className = "" }: ProductLogoProps) {
  return (
    <div
      aria-hidden="true"
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[rgba(158,149,245,0.28)] bg-[var(--color-brand)] shadow-[0_10px_24px_rgba(123,104,238,0.24)] ${className}`}
    >
      <svg viewBox="0 0 64 64" className="h-[78%] w-[78%]" fill="none">
        <rect x="13" y="34" width="7" height="16" rx="1.5" fill="#DAD7FF" opacity="0.72" />
        <rect x="24" y="27" width="7" height="23" rx="1.5" fill="#EDE9FE" opacity="0.86" />
        <rect x="35" y="19" width="7" height="31" rx="1.5" fill="#FFFFFF" opacity="0.96" />

        <path
          d="M16.5 31.5 27.5 24 38.5 15.5"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M38.5 15.5 48.5 9.5 56 5"
          stroke="#DAD7FF"
          strokeWidth="3"
          strokeDasharray="5 4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <circle cx="16.5" cy="31.5" r="3.3" fill="#FFFFFF" />
        <circle cx="27.5" cy="24" r="3.3" fill="#FFFFFF" />
        <circle cx="38.5" cy="15.5" r="4" fill="#FFFFFF" stroke="#EDE9FE" strokeWidth="2" />
        <circle cx="48.5" cy="9.5" r="3.2" fill="#DAD7FF" />
        <circle cx="56" cy="5" r="3.4" fill="#DAD7FF" />

        <path d="M10 53.5h43" stroke="#C4B5FD" strokeWidth="2" strokeLinecap="round" />
        <path d="M10 53.5V15" stroke="#C4B5FD" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}
