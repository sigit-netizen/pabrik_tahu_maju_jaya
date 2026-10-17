"use client";

import { useState } from "react";
import { formatRibuan } from "./data";

/**
 * Grafik tren cetakan tahu (SVG murni, tanpa pustaka).
 *
 * Data masuk lewat props (hasil API / agregasi range) — bukan mock lokal.
 * Warna diambil dari custom property CSS yang dipasang induknya lewat
 * `skin(dark)`, jadi komponen ini tidak perlu tahu mode gelap:
 *   --tj-ink     garis grid, garis dasar, judul tabel data
 *   --tj-dot     isi titik (harus sama dengan latar kartu)
 *   --tj-lin-a   awal gradien garis
 *   --tj-lin-b   tengah gradien garis
 *   --tj-tip     latar tooltip
 *   --tj-garis   garis pemisah / garis tabel data
 *
 * Animasi: elemen SVG diberi `key={mode}` sehingga React me-remount saat
 * rentang berubah dan animasi CSS `chart-line` / `chart-area` / `chart-dot`
 * (globals.css) diputar ulang — tanpa state + effect.
 */

type Titik = { x: number; y: number };

const LEBAR = 640;
const TINGGI = 240;
const PAD = 28;

function hitungTitik(values: number[]): Titik[] {
  const maks = Math.max(...values);
  const min = Math.min(...values);
  const atas = maks * 1.15 || 1;
  const bawah = min * 0.55;
  const rentang = atas - bawah || 1;
  const banyak = values.length;
  const langkah = banyak > 1 ? (LEBAR - PAD * 2) / (banyak - 1) : 0;
  return values.map((v, i) => ({
    x: banyak > 1 ? PAD + i * langkah : LEBAR / 2,
    y: TINGGI - PAD - (((v || 0) - bawah) / rentang) * (TINGGI - PAD * 2),
  }));
}

function jalur(pts: Titik[]) {
  if (pts.length === 0) return "";
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

export default function ProdChart({ labels, values, mode }: { labels: string[]; values: number[]; mode: string }) {
  const [aktif, setAktif] = useState<number | null>(null);
  const banyak = values.length;

  if (banyak === 0) {
    return (
      <div
        className="grid h-[190px] place-items-center rounded-2xl border border-dashed px-4 text-center"
        style={{ borderColor: "var(--tj-garis, rgba(20,52,43,0.14))", color: "var(--tj-ink, #14342B)" }}
      >
        <p className="text-[13px] font-semibold opacity-70">Belum ada titik data untuk grafik {mode}.</p>
      </div>
    );
  }

  const titik = hitungTitik(values);
  const garis = jalur(titik);
  const area = `${garis} L ${titik[titik.length - 1].x},${TINGGI - PAD} L ${titik[0].x},${TINGGI - PAD} Z`;
  const nama = (i: number) => labels[i] ?? `Titik ${i + 1}`;
  const deskripsi =
    `Grafik tren cetakan tahu, tampilan ${mode}. ${banyak} titik data. ` +
    `Nilai terendah ${formatRibuan(Math.min(...values))} papan dan tertinggi ` +
    `${formatRibuan(Math.max(...values))} papan, dari ${nama(0)} sampai ${nama(banyak - 1)}.`;

  return (
    <div className="relative">
      <svg
        key={mode}
        viewBox={`0 0 ${LEBAR} ${TINGGI}`}
        className="h-[210px] w-full sm:h-[240px]"
        role="img"
        aria-label={deskripsi}
        onPointerLeave={() => {
          // Jangan hilangkan tooltip yang sedang dipakai fokus keyboard.
          const fokus = document.activeElement as Element | null;
          if (!fokus?.closest("svg")) setAktif(null);
        }}
      >
        <desc>{deskripsi}</desc>
        <defs>
          <linearGradient id="tmj-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D97706" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#D97706" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="tmj-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" style={{ stopColor: "var(--tj-lin-a, #14342B)" }} />
            <stop offset="60%" style={{ stopColor: "var(--tj-lin-b, #1B4A3A)" }} />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>
        </defs>

        {/* garis bantu horizontal */}
        {[0.2, 0.45, 0.7, 0.95].map((t, i) => (
          <line
            key={i}
            x1={PAD}
            x2={LEBAR - PAD}
            y1={TINGGI * t}
            y2={TINGGI * t}
            style={{ stroke: "var(--tj-ink, #14342B)" }}
            strokeOpacity="0.08"
            strokeDasharray="4 5"
          />
        ))}

        <path d={area} fill="url(#tmj-area)" className="chart-area" />
        <path
          d={garis}
          fill="none"
          stroke="url(#tmj-line)"
          strokeWidth="3"
          strokeLinecap="round"
          className="chart-line"
        />

        {titik.map((p, i) => (
          <g key={i}>
            {/* cincin penanda saat titik disorot / difokuskan */}
            {aktif === i && (
              <circle
                cx={p.x}
                cy={p.y}
                r={11}
                fill="none"
                stroke="#D97706"
                strokeOpacity="0.35"
                strokeWidth="2"
                aria-hidden
              />
            )}
            {/* titik data: bisa difokuskan (Tab) dan dibaca screen reader */}
            <circle
              cx={p.x}
              cy={p.y}
              r={aktif === i ? 7 : 4.5}
              strokeWidth="2.5"
              className="chart-dot cursor-pointer focus:outline-none"
              tabIndex={0}
              role="img"
              aria-label={`${nama(i)}: ${formatRibuan(values[i])} papan cetak`}
              style={{
                fill: aktif === i ? "#D97706" : "var(--tj-dot, #F6F1E7)",
                stroke: aktif === i ? "var(--tj-ink, #14342B)" : "#D97706",
                animationDelay: `${0.9 + i * 0.08}s`,
              }}
              onFocus={() => setAktif(i)}
              onBlur={() => setAktif(null)}
              onPointerDown={() => setAktif(i)}
            />
            {/* area sentuh / arahkan kursor */}
            <rect
              x={p.x - 22}
              y={0}
              width={44}
              height={TINGGI}
              fill="transparent"
              aria-hidden
              onPointerEnter={() => setAktif(i)}
              onPointerDown={() => setAktif(i)}
            />
          </g>
        ))}

        <line
          x1={PAD}
          x2={LEBAR - PAD}
          y1={TINGGI - PAD}
          y2={TINGGI - PAD}
          style={{ stroke: "var(--tj-ink, #14342B)" }}
          strokeOpacity="0.25"
          strokeWidth="1.5"
        />
      </svg>

      {/* label sumbu */}
      <div
        className="mt-1 flex justify-between gap-2 px-1 text-[10.5px] font-bold tracking-wide"
        style={{ color: "var(--tj-ink, #14342B)", opacity: 0.55 }}
        aria-hidden
      >
        {labels.map((l, i) => (
          <span key={`${l}-${i}`}>{l}</span>
        ))}
      </div>

      {/* tooltip — muncul lewat kursor, sentuhan, dan fokus keyboard */}
      {aktif !== null && (
        <div
          className="anim-pop pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl border border-cream/15 px-3 py-2 text-center shadow-xl"
          style={{ left: `${(titik[aktif].x / LEBAR) * 100}%`, top: 8, background: "var(--tj-tip, #14342B)" }}
          aria-hidden
        >
          <p className="text-[10px] font-bold tracking-widest text-cream/60 uppercase">{nama(aktif)}</p>
          <p className="text-[15px] font-extrabold text-cream">
            {formatRibuan(values[aktif])} <span className="text-[11px] font-bold text-brand-soft">papan</span>
          </p>
        </div>
      )}

      {/* alternatif teks: tabel data yang bisa dibaca tanpa melihat grafik */}
      <details
        className="mt-4 rounded-2xl border px-3.5 py-2.5"
        style={{ borderColor: "var(--tj-garis, rgba(20,52,43,0.12))", color: "var(--tj-ink, #14342B)" }}
      >
        <summary className="cursor-pointer text-[11.5px] font-bold tracking-wide uppercase opacity-80">
          Lihat data {mode} sebagai tabel
        </summary>
        <table className="mt-2.5 w-full text-left text-[12px]">
          <caption className="sr-only">Jumlah cetakan tahu per {mode}</caption>
          <thead>
            <tr className="opacity-70">
              <th scope="col" className="py-1.5 pr-3 font-bold">
                Periode
              </th>
              <th scope="col" className="py-1.5 text-right font-bold">
                Cetak (papan)
              </th>
            </tr>
          </thead>
          <tbody>
            {values.map((v, i) => (
              <tr key={`${nama(i)}-${i}`} className="border-t" style={{ borderColor: "var(--tj-garis, rgba(20,52,43,0.1))" }}>
                <th scope="row" className="py-1.5 pr-3 text-left font-semibold">
                  {nama(i)}
                </th>
                <td className="py-1.5 text-right font-bold tabular-nums">{formatRibuan(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}