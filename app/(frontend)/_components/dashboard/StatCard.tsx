"use client";

import { useEffect, useState } from "react";
import { formatRibuan } from "./data";
import { skin } from "./theme";

export function useCountUp(target: number, duration = 1100, start = true) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);
  return val;
}

export function StatCard({
  label,
  value,
  suffix,
  delta,
  icon,
  delay = 0,
  accent = false,
  dark = false,
}: {
  label: string;
  value: number;
  suffix: string;
  delta: string;
  icon: React.ReactNode;
  delay?: number;
  accent?: boolean;
  dark?: boolean;
}) {
  const n = useCountUp(value);
  const s = skin(dark);
  return (
    <div
      className={`anim-rise card-lift group relative overflow-hidden rounded-2xl border p-4 sm:p-5 ${
        accent ? "border-pine bg-pine text-cream" : `${s.kartu} ${s.judul}`
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {accent ? (
        <>
          <div className="dot-grid absolute inset-0 opacity-70" aria-hidden />
          <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-brand/25 blur-2xl transition-transform duration-500 group-hover:scale-125" aria-hidden />
        </>
      ) : (
        <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-brand/10 blur-2xl transition-transform duration-500 group-hover:scale-125" aria-hidden />
      )}
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className={`text-[11px] font-bold tracking-widest uppercase ${accent ? "text-cream/60" : s.redup}`}>
            {label}
          </p>
          <p className="mt-1.5 text-[26px] font-extrabold tracking-tight tabular-nums sm:text-[30px]">
            {formatRibuan(n)}
            <span className={`ml-1 text-[12px] font-bold ${accent ? "text-brand-soft" : s.badgeHarga}`}>{suffix}</span>
          </p>
          {/* delta netral — bukan hijau, supaya tidak menyesatkan saat angkanya turun */}
          <span
            className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
              accent ? "bg-cream/10 text-cream" : dark ? "bg-cream/10 text-cream/70" : "bg-cream-muted text-pine/70"
            }`}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
            {delta}
          </span>
        </div>
        <span
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[19px] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 ${
            accent ? "bg-brand text-white shadow-lg" : dark ? "border border-cream/10 bg-pine-deep text-cream/70" : "border border-line bg-cream text-pine"
          }`}
        >
          {icon}
        </span>
      </div>
    </div>
  );
}