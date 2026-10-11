"use client";

import { useEffect, useState } from "react";
import { formatRibuan, getSeries } from "./data";

function points(values: number[], w: number, h: number, pad: number) {
  const max = Math.max(...values) * 1.15;
  const min = Math.min(...values) * 0.55;
  const stepX = (w - pad * 2) / (values.length - 1);
  return values.map((v, i) => {
    const x = pad + i * stepX;
    const y = h - pad - ((v - min) / (max - min)) * (h - pad * 2);
    return { x, y, v };
  });
}

function pathOf(pts: { x: number; y: number }[]) {
  // smooth curve (catmull-rom -> bezier)
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

export default function ProdChart({ mode }: { mode: "harian" | "mingguan" | "bulanan" }) {
  const { labels, values } = getSeries(mode);
  const W = 640;
  const H = 240;
  const PAD = 28;
  const pts = points(values, W, H, PAD);
  const line = pathOf(pts);
  const area = `${line} L ${pts[pts.length - 1].x},${H - PAD} L ${pts[0].x},${H - PAD} Z`;
  const [hover, setHover] = useState<number | null>(null);
  const [animatedKey, setAnimatedKey] = useState(0);

  useEffect(() => {
    setAnimatedKey((k) => k + 1);
  }, [mode]);

  return (
    <div className="relative">
      <svg
        key={animatedKey}
        viewBox={`0 0 ${W} ${H}`}
        className="h-[210px] w-full sm:h-[240px]"
        role="img"
        aria-label={`Grafik produksi ${mode}`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="tmj-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D97706" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#D97706" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="tmj-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#14342B" />
            <stop offset="60%" stopColor="#1B4A3A" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>
        </defs>

        {/* grid */}
        {[0.2, 0.45, 0.7, 0.95].map((t, i) => (
          <line
            key={i}
            x1={PAD}
            x2={W - PAD}
            y1={H * t}
            y2={H * t}
            stroke="#14342B"
            strokeOpacity="0.08"
            strokeDasharray="4 5"
          />
        ))}

        <path d={area} fill="url(#tmj-area)" className="chart-area" />
        <path
          d={line}
          fill="none"
          stroke="url(#tmj-line)"
          strokeWidth="3"
          strokeLinecap="round"
          className="chart-line"
        />

        {pts.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={hover === i ? 7 : 4.5}
              fill={hover === i ? "#D97706" : "#F6F1E7"}
              stroke={hover === i ? "#14342B" : "#D97706"}
              strokeWidth="2.5"
              className="chart-dot cursor-pointer"
              style={{ animationDelay: `${0.9 + i * 0.08}s` }}
              onMouseEnter={() => setHover(i)}
            />
            {/* hit area */}
            <rect
              x={p.x - 22}
              y={0}
              width={44}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          </g>
        ))}

        {/* baseline */}
        <line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} stroke="#14342B" strokeOpacity="0.25" strokeWidth="1.5" />
      </svg>

      {/* label sumbu */}
      <div className="mt-1 flex justify-between px-1 text-[10.5px] font-bold tracking-wide text-pine/45">
        {labels.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>

      {/* tooltip */}
      {hover !== null && (
        <div
          className="anim-pop pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl border border-pine/10 bg-pine px-3 py-2 text-center shadow-xl"
          style={{
            left: `${(pts[hover].x / W) * 100}%`,
            top: 8,
          }}
        >
          <p className="text-[10px] font-bold tracking-widest text-cream/60 uppercase">{labels[hover]}</p>
          <p className="text-[15px] font-extrabold text-cream">
            {formatRibuan(values[hover])} <span className="text-[11px] font-bold text-brand-soft">papan</span>
          </p>
        </div>
      )}
    </div>
  );
}
