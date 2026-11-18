"use client";

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <span
      className="relative grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-pine text-cream shadow-[0_8px_20px_rgba(20,52,43,0.25)]"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span className="dot-grid absolute inset-0" />
      {/* tumpukan tahu */}
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="10" width="13" height="10" rx="2.4" fill="#F6F1E7" />
        <rect x="3" y="10" width="13" height="3.4" rx="1.7" fill="#ECE3D0" />
        <rect x="11.5" y="4" width="9.5" height="9.5" rx="2.2" fill="#D97706" />
        <rect x="13.4" y="5.8" width="4" height="2.2" rx="1.1" fill="#F6F1E7" opacity="0.85" />
        {/* uap */}
        <path d="M7 7.5c0-1 .8-1.2.8-2.2M10.5 7.5c0-1 .8-1.2.8-2.2" stroke="#F6F1E7" strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
      </svg>
      <span className="absolute -right-3 -top-3 h-8 w-8 rounded-full bg-brand/25 blur-md" />
    </span>
  );
}
