export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true">
      <rect x="3" y="3" width="94" height="94" rx="26" fill="#1E7A4C" />
      <rect x="24" y="15" width="52" height="70" rx="9" fill="#FFFFFF" />
      <rect x="67" y="20" width="20" height="21" rx="6" fill="#C7E86B" />
      <path
        d="M34 64 L44 75 L63 51"
        fill="none"
        stroke="#1E7A4C"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
