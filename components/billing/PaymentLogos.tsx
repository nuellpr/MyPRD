/** Logo & ikon metode pembayaran Indonesia (QRIS, GPN, GoPay, ShopeePay, DANA, OVO, LinkAja, bank) — inline SVG tanpa request eksternal. */

export function QrisBadgeIcon({ className = "h-4 w-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 24" className={className} fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="9" height="9" rx="1.8" stroke="currentColor" strokeWidth="2.1" />
      <rect x="4.5" y="4.5" width="3" height="3" rx="0.5" fill="currentColor" />
      <rect x="17.5" y="1.5" width="9" height="9" rx="1.8" stroke="currentColor" strokeWidth="2.1" />
      <rect x="20.5" y="4.5" width="3" height="3" rx="0.5" fill="currentColor" />
      <rect x="1.5" y="13.5" width="9" height="9" rx="1.8" stroke="currentColor" strokeWidth="2.1" />
      <rect x="4.5" y="16.5" width="3" height="3" rx="0.5" fill="currentColor" />
      <path d="M14 4v5m0 3.5V15m3.5-1.5h3V18m-3 4h6m-9.5-2.5h3" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  );
}

export function QrisLogo({
  variant = "dark",
  className = "h-6 w-auto",
}: {
  variant?: "light" | "dark";
  className?: string;
}) {
  const fg = variant === "light" ? "#0f172a" : "#ffffff";
  const sub = variant === "light" ? "#475569" : "#94a3b8";
  const accent = variant === "light" ? "#e11d48" : "#35d6ff";
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 112 30" className="h-full w-auto" fill="none" aria-label="QRIS">
        <path d="M2 7V2h5M21 2h5v5M2 23v5h5" stroke={fg} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 28h5v-5" stroke={accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="6" y="6" width="6.5" height="6.5" rx="1" stroke={fg} strokeWidth="1.8" />
        <rect x="15.5" y="6" width="6.5" height="6.5" rx="1" stroke={fg} strokeWidth="1.8" />
        <rect x="6" y="15.5" width="6.5" height="6.5" rx="1" stroke={fg} strokeWidth="1.8" />
        <rect x="15.5" y="15.5" width="3" height="3" fill={fg} />
        <rect x="19.5" y="19.5" width="3" height="3" fill={accent} />
        <text
          x="33"
          y="18.5"
          fill={fg}
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize="16"
          fontWeight="800"
          letterSpacing="1.2"
        >
          QRIS
        </text>
        <text
          x="33.5"
          y="26.5"
          fill={sub}
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize="5.4"
          fontWeight="600"
          letterSpacing="0.4"
        >
          STANDAR PEMBAYARAN
        </text>
      </svg>
    </span>
  );
}

export function GpnLogo({ className = "h-5 w-auto" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-slate-900 ${className}`}
      title="Gerbang Pembayaran Nasional"
    >
      <svg viewBox="0 0 18 18" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
        <path d="M9 2 3 5v4.2c0 3.7 2.6 6.8 6 7.8 3.4-1 6-4.1 6-7.8V5L9 2Z" fill="#dc2626" />
        <path d="M9 4.5 5 6.4v2.9c0 2.5 1.7 4.6 4 5.4V4.5Z" fill="#1d4ed8" />
      </svg>
      <span>GPN</span>
    </span>
  );
}

interface WalletSpec {
  id: string;
  label: string;
  bg: string;
  dot: string;
  glyph: "gopay" | "shopeepay" | "dana" | "ovo" | "linkaja";
}

const WALLETS: WalletSpec[] = [
  { id: "gopay", label: "GoPay", bg: "border-[#00AED6]/40 bg-[#00AED6]/12 text-[#7ee8ff]", dot: "#00AED6", glyph: "gopay" },
  { id: "shopeepay", label: "ShopeePay", bg: "border-[#EE4D2D]/40 bg-[#EE4D2D]/12 text-[#ffb29f]", dot: "#EE4D2D", glyph: "shopeepay" },
  { id: "dana", label: "DANA", bg: "border-[#118EEA]/40 bg-[#118EEA]/12 text-[#93d0ff]", dot: "#118EEA", glyph: "dana" },
  { id: "ovo", label: "OVO", bg: "border-[#7c5dfa]/45 bg-[#4C3494]/25 text-[#d8ccff]", dot: "#9f7aea", glyph: "ovo" },
  { id: "linkaja", label: "LinkAja", bg: "border-[#E82529]/40 bg-[#E82529]/12 text-[#fca5a5]", dot: "#E82529", glyph: "linkaja" },
];

const BANKS = [
  { id: "bca", label: "BCA", color: "#38bdf8" },
  { id: "mandiri", label: "Mandiri", color: "#facc15" },
  { id: "bri", label: "BRI", color: "#60a5fa" },
  { id: "bni", label: "BNI", color: "#fb923c" },
] as const;

function WalletGlyph({ kind, color }: { kind: WalletSpec["glyph"]; color: string }) {
  switch (kind) {
    case "gopay":
      return (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" aria-hidden="true">
          <rect x="2" y="3.5" width="12" height="9" rx="2.5" fill={color} />
          <circle cx="10.5" cy="8" r="1.4" fill="#06131f" />
        </svg>
      );
    case "shopeepay":
      return (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" aria-hidden="true">
          <path d="M5.5 5V4.2a2.5 2.5 0 0 1 5 0V5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
          <rect x="2.5" y="5" width="11" height="8.5" rx="2" fill={color} />
          <path d="M9.6 7.5c-.6-.4-2.5-.5-2.6.6-.1 1 2.7.7 2.6 2-.1 1-2.2 1-3 .5" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "dana":
      return (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" aria-hidden="true">
          <rect x="1.5" y="3" width="13" height="10" rx="3" fill={color} />
          <path d="M4 7.5c1.5-1 3-1 4 0s2.5 1 4 0" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "ovo":
      return (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6" fill="#4C3494" stroke={color} strokeWidth="1.4" />
          <circle cx="8" cy="8" r="2.4" stroke="#fff" strokeWidth="1.6" />
        </svg>
      );
    case "linkaja":
      return (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" aria-hidden="true">
          <rect x="2" y="2" width="12" height="12" rx="3" fill={color} />
          <path d="M5.5 5.2v5.4h3.2M10.5 10.6l-1-3-1 3" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

export function PaymentWalletStrip({
  compact = false,
  showBanks = true,
}: {
  compact?: boolean;
  showBanks?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Didukung GoPay, ShopeePay, DANA, OVO, LinkAja, dan bank QRIS">
      {WALLETS.map((w) => (
        <span
          key={w.id}
          className={`inline-flex items-center gap-1.5 rounded-lg border font-semibold ${w.bg} ${
            compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
          }`}
        >
          <WalletGlyph kind={w.glyph} color={w.dot} />
          <span>{w.label}</span>
        </span>
      ))}
      {showBanks
        ? BANKS.map((b) => (
            <span
              key={b.id}
              className={`inline-flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900/80 font-semibold text-slate-200 ${
                compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: b.color }} />
              <span>{b.label}</span>
            </span>
          ))
        : null}
    </div>
  );
}
