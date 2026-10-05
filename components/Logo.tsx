export default function Logo({ size = 42 }: { size?: number }) {
  return (
    <span className="logoWrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 72 72" role="img" aria-label="Logo DG" style={{ position: "relative", zIndex: 1, display: "block" }}>
        <defs>
          <linearGradient id="dgG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8b6cff" /><stop offset=".55" stopColor="#4f2df0" /><stop offset="1" stopColor="#2b6bff" /></linearGradient>
          <linearGradient id="dgS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".28" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
        </defs>
        <rect width="72" height="72" rx="20" fill="url(#dgG)" />
        <rect width="72" height="36" rx="20" fill="url(#dgS)" />
        <g fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 24 H21 A12 12 0 0 1 21 48 Z" />
          <path d="M59.81 28.61 A11.5 11.5 0 1 0 62.5 36 H51" />
        </g>
      </svg>
      <span className="shine" />
    </span>
  );
}
