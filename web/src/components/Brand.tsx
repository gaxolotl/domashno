export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true">
      <rect x="4" y="4" width="92" height="92" rx="24" fill="#1E7A4C" />
      <path d="M30 52 L44 66 L72 34" fill="none" stroke="#ffffff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="26" y="76" width="48" height="9" rx="4.5" fill="#C7E86B" />
    </svg>
  );
}
