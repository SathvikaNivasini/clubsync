export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="csg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#14b49c" />
          <stop offset="100%" stopColor="#0b8273" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="10" fill="url(#csg)" />
      <path d="M22 11.5a7 7 0 1 0 1.2 7.6" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <circle cx="22.2" cy="11" r="2.1" fill="#F0A63D" />
    </svg>
  );
}

export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2">
      <Logo size={size} />
      <span className="text-[1.0625rem] font-bold tracking-tight">ClubSync</span>
    </span>
  );
}
