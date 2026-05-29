export function Logo({ size = 20 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 font-display text-[var(--color-primary-ink)]">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
      >
        <circle cx="12" cy="12" r="10.5" stroke="currentColor" strokeWidth="1.2" />
        <path
          d="M5 12 H 9 L 10.5 8 L 13.5 16 L 15 12 H 19"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      <span className="text-[16px] tracking-tight">
        QuidoLabs<span className="font-semibold text-[var(--color-primary)]"> CTMS</span>
      </span>
    </span>
  );
}
