"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "run" | "done";

const LOGS = [
  "Menghubungkan ke riwayat 30 hari terakhir…",
  "Membersihkan anomali (libur & hujan deras)…",
  "Menimbang tren Senin–Jumat vs akhir pekan…",
  "Menghitung kebutuhan kedelai & Garam…",
  "Menyusun rekomendasi cetak per hari…",
];

const HASIL = [
  { hari: "Senin", papan: 132, pct: 72 },
  { hari: "Selasa", papan: 148, pct: 81 },
  { hari: "Rabu", papan: 141, pct: 77 },
  { hari: "Kamis", papan: 165, pct: 90 },
  { hari: "Jumat", papan: 182, pct: 100 },
  { hari: "Sabtu", papan: 158, pct: 87 },
  { hari: "Minggu", papan: 96, pct: 53 },
];

export default function AiView({ onToast }: { onToast: (m: string) => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [logIdx, setLogIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  function mulai() {
    if (phase === "run") return;
    setPhase("run");
    setLogIdx(0);
    setProgress(0);
    let p = 0;
    let li = 0;
    timer.current = setInterval(() => {
      p += 4 + Math.random() * 7;
      if (p >= 100) {
        p = 100;
        if (timer.current) clearInterval(timer.current);
        setTimeout(() => {
          setPhase("done");
          onToast("Prediksi minggu depan selesai — simulasi lokal dari data rekap.");
        }, 450);
      }
      setProgress(Math.min(100, Math.floor(p)));
      if (p > (li + 1) * 20 && li < LOGS.length - 1) {
        li += 1;
        setLogIdx(li);
      }
    }, 180);
  }

  function ulang() {
    if (timer.current) clearInterval(timer.current);
    setPhase("idle");
    setProgress(0);
    setLogIdx(0);
  }

  const total = HASIL.reduce((a, b) => a + b.papan, 0);
  const kedelai = Math.round(total * 0.42);

  return (
    <section className="anim-rise overflow-hidden rounded-3xl border border-line bg-white shadow-[0_20px_50px_rgba(20,52,43,0.08)]">
      {/* header */}
      <div className="relative overflow-hidden bg-pine px-5 py-6 text-center text-cream sm:px-8 sm:py-8">
        <div className="dot-grid absolute inset-0" aria-hidden />
        <div className="absolute top-1/2 left-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/20 blur-3xl" aria-hidden />
        {/* orbit animasi */}
        <div className="relative mx-auto mb-4 grid h-16 w-16 place-items-center" aria-hidden>
          <span className="absolute inset-0 rounded-2xl border border-cream/15" />
          <span className="absolute inset-0 rounded-2xl border border-transparent border-t-brand" style={{ animation: "tmj-spin-slow 5s linear infinite" }} />
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand text-[22px] shadow-lg" style={{ animation: "tmj-float-soft 3.2s ease-in-out infinite" }}>✦</span>
        </div>
        <p className="relative text-[11px] font-bold tracking-[0.18em] text-brand-soft uppercase">Kecerdasan produksi</p>
        <h2 className="relative mx-auto mt-1 max-w-[28ch] text-[19px] font-extrabold tracking-tight sm:text-[22px]">
          AI Prediksi Jumlah Cetakan Minggu Depan
        </h2>
        <p className="relative mx-auto mt-2 max-w-[52ch] text-[12.5px] leading-5 text-cream/65">
          Simulasi lokal dari pola rekap — tanpa mengirim data ke mana pun. Tekan tombol untuk menjalankan analisis.
        </p>
        <div className="relative mt-5 flex justify-center gap-2">
          {phase !== "done" ? (
            <button
              onClick={mulai}
              disabled={phase === "run"}
              className={`btn-press h-11 rounded-xl px-8 text-[13.5px] font-bold text-white shadow-[0_10px_26px_rgba(217,119,6,0.4)] ${phase === "run" ? "cursor-wait bg-pine-soft" : "bg-brand hover:bg-brand-deep shimmer-wrap"}`}
            >
              {phase === "run" ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Menganalisis… {progress}%
                </span>
              ) : (
                "▶ Mulai Prediksi"
              )}
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={ulang} className="btn-press h-11 rounded-xl border border-cream/20 bg-cream/10 px-6 text-[13px] font-bold text-cream hover:bg-cream/15">↺ Ulangi</button>
              <button onClick={() => onToast("Ringkasan prediksi disalin — tempel ke grup WA produksi.")} className="btn-press h-11 rounded-xl bg-brand px-6 text-[13px] font-bold text-white hover:bg-brand-deep">Salin ringkasan</button>
            </div>
          )}
        </div>
        {phase === "run" && (
          <div className="relative mx-auto mt-4 max-w-[420px]">
            <div className="h-2 overflow-hidden rounded-full bg-cream/15">
              <div className="h-full rounded-full bg-gradient-to-r from-brand to-amber-300 transition-all duration-200" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* body */}
      <div className="p-5 sm:p-6">
        {phase === "idle" && (
          <div className="anim-fade grid gap-3 rounded-2xl border border-dashed border-pine/20 bg-cream/60 p-6 text-center">
            <p className="text-[26px]" aria-hidden>🏭</p>
            <p className="text-[13.5px] font-bold">Belum ada prediksi berjalan</p>
            <p className="mx-auto max-w-[46ch] text-[12.5px] leading-5 text-pine/60">
              Hasil akan menampilkan estimasi papan per hari, kebutuhan kedelai, dan saran shift — lengkap dengan animasi bar.
            </p>
            <div className="mx-auto flex flex-wrap justify-center gap-2 pt-1 text-[11px] font-bold text-pine/55">
              {["±30 hari data", "7 hari ke depan", "100% lokal"].map((t) => (
                <span key={t} className="rounded-full border border-line-strong bg-white px-3 py-1.5">{t}</span>
              ))}
            </div>
          </div>
        )}

        {phase === "run" && (
          <div className="rounded-2xl border border-line bg-pine-deep p-5 font-mono text-[12px] leading-6 text-cream/85">
            {LOGS.slice(0, logIdx + 1).map((l, i) => (
              <p key={l} className="anim-fade" style={{ animationDelay: `${i * 60}ms` }}>
                <span className="text-brand">▸</span> {l}
                {i === logIdx && <span className="ml-1 inline-block h-3.5 w-2 translate-y-0.5 bg-brand" style={{ animation: "tmj-blink 0.9s infinite" }} />}
              </p>
            ))}
            <div className="mt-3 grid grid-cols-7 gap-1.5" aria-hidden>
              {Array.from({ length: 28 }).map((_, i) => (
                <span
                  key={i}
                  className={`h-6 rounded-md ${i / 28 * 100 < progress ? "bg-brand" : "bg-cream/10"}`}
                  style={{ transition: "background 200ms" }}
                />
              ))}
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="anim-pop space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="card-lift rounded-2xl bg-pine p-4 text-cream">
                <p className="text-[10.5px] font-bold tracking-widest text-cream/55 uppercase">Total minggu depan</p>
                <p className="mt-1 text-[26px] font-extrabold tabular-nums">{total.toLocaleString("id-ID")} <span className="text-[11px] text-brand-soft">papan</span></p>
                <p className="mt-1 text-[11.5px] font-semibold text-emerald-300">▲ +8,4% vs minggu ini</p>
              </div>
              <div className="card-lift rounded-2xl border border-line bg-cream p-4">
                <p className="text-[10.5px] font-bold tracking-widest text-pine/50 uppercase">Kedelai disarankan</p>
                <p className="mt-1 text-[26px] font-extrabold tabular-nums">{kedelai.toLocaleString("id-ID")} <span className="text-[11px] text-brand-deep">kg</span></p>
                <p className="mt-1 text-[11.5px] font-semibold text-pine/60">Stok aman 3 hari • pesan Kamis</p>
              </div>
              <div className="card-lift rounded-2xl border border-brand/30 bg-brand-soft p-4">
                <p className="text-[10.5px] font-bold tracking-widest text-brand-deep uppercase">Keyakinan model</p>
                <p className="mt-1 text-[26px] font-extrabold tabular-nums">87<span className="text-[13px]">%</span></p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand/15">
                  <div className="h-full rounded-full bg-brand" style={{ animation: "tmj-bar-grow 1s ease 0.2s both", transformOrigin: "left" }} />
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-line">
              <div className="border-b border-line bg-cream/60 px-4 py-3 text-[12px] font-extrabold tracking-wide uppercase">Rincian per hari</div>
              <ul className="divide-y divide-[rgba(20,52,43,0.07)]">
                {HASIL.map((h, i) => (
                  <li key={h.hari} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-16 text-[12.5px] font-bold">{h.hari}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-cream-dark">
                      <div
                        className={`h-full rounded-full ${h.hari === "Jumat" ? "bg-brand" : "bg-pine"}`}
                        style={{ width: `${h.pct}%`, animation: "tmj-bar-grow 0.9s cubic-bezier(0.22,1,0.36,1) both", animationDelay: `${i * 90}ms`, transformOrigin: "left" }}
                      />
                    </div>
                    <span className="w-20 text-right text-[12.5px] font-extrabold tabular-nums">{h.papan} <span className="font-semibold text-pine/50">papan</span></span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-[12.5px] leading-5 text-emerald-950">
              <p className="font-extrabold">💡 Saran shift — Jumat puncak</p>
              <p className="mt-1 text-emerald-900/80">Tambah 1 cetakan cadangan Jumat pagi, rendam kedelai Kamis malam 2 batch. Minggu potong 30% — fokus cuci cetakan & stok.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
