export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      role="presentation"
    >
      <rect width="32" height="32" rx="9" fill="#191F29" />
      <path
        d="M22.5 11.2a8 8 0 1 0 1.3 9"
        stroke="#35C6B1"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M9.5 20.8a8 8 0 0 1 11.4-10.5"
        stroke="#F2AE52"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="22.6" cy="10.4" r="2.3" fill="#F2AE52" />
      <circle cx="9.4" cy="21.6" r="2.3" fill="#35C6B1" />
    </svg>
  );
}

export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <Logo size={size} />
      <span className="text-[1.0625rem] font-bold tracking-tight text-ink">
        Club<span className="text-primary">Sync</span>
      </span>
    </span>
  );
}
