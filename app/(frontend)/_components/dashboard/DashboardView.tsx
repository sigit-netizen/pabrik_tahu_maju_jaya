"use client";

import { useMemo, useState } from "react";
import ProdChart from "./ProdChart";
import { REKAP_AWAL, formatRibuan, type RekapRow } from "./data";

type Mode = "harian" | "mingguan" | "bulanan";

const TABS: { key: Mode; label: string }[] = [
  { key: "harian", label: "Harian" },
  { key: "mingguan", label: "Mingguan" },
  { key: "bulanan", label: "Bulanan" },
];

function StatusPill({ s }: { s: RekapRow["status"] }) {
  const cls =
    s === "Selesai"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : s === "Proses"
        ? "bg-amber-50 text-amber-800 border-amber-200"
        : "bg-cream-muted text-pine border-line-strong";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${cls}`}>
      <span
        className="h-1.5 w-1.5 rounded-full bg-current"
        style={s === "Proses" ? { animation: "tmj-blink 1.4s infinite" } : undefined}
      />
      {s}
    </span>
  );
}

export default function DashboardView({ onToast }: { onToast: (msg: string) => void }) {
  const [mode, setMode] = useState<Mode>("mingguan");
  const [q, setQ] = useState("");
  const [showRekap, setShowRekap] = useState(false);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return REKAP_AWAL;
    return REKAP_AWAL.filter(
      (r) =>
        r.tanggal.toLowerCase().includes(t) ||
        r.id.toLowerCase().includes(t) ||
        r.status.toLowerCase().includes(t)
    );
  }, [q]);

  const totalCetak = rows.reduce((a, b) => a + b.cetak, 0);
  const totalMasak = rows.reduce((a, b) => a + b.masak, 0);

  return (
    <div className="space-y-5">
      {/* chart card — dari wireframe: tabs + grafik + tabel + filter/cetak */}
      <section className="anim-rise overflow-hidden rounded-3xl border border-line bg-white shadow-[0_20px_50px_rgba(20,52,43,0.08)]" style={{ animationDelay: "120ms" }}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-cream/60 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-[16px] font-extrabold tracking-tight">Grafik Produksi Tahu</h2>
            <p className="text-[12px] font-medium text-pine/55">Papan tercetak — rendaman → giling → cetak → masak</p>
          </div>
          {/* tabs ala wireframe */}
          <div className="relative grid grid-cols-3 rounded-xl border border-line-strong bg-white p-1 text-[12px] font-bold" role="tablist" aria-label="Rentang grafik">
            {/* thumb geser */}
            <span
              aria-hidden
              className="tab-thumb absolute top-1 bottom-1 rounded-lg bg-pine"
              style={{
                left: 4,
                width: "calc((100% - 8px) / 3)",
                transform: `translateX(${mode === "harian" ? 0 : mode === "mingguan" ? 100 : 200}%)`,
              }}
            />
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={mode === t.key}
                onClick={() => setMode(t.key)}
                className={`tab-pill relative z-10 rounded-lg px-4 py-2 sm:px-6 ${mode === t.key ? "text-cream" : "text-pine/60 hover:text-pine"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 pt-4 sm:px-6">
          <ProdChart mode={mode} />
        </div>

        {/* toolbar filter + cetak */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-6">
          <div className="relative min-w-[210px] flex-1">
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-pine/40" aria-hidden>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter tanggal / id / status…"
              aria-label="Filter rekap"
              className="auth-input h-10 w-full rounded-xl border border-line-strong bg-white pr-3 pl-10 text-[13px] font-medium"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-lg bg-cream-muted px-3 py-2 text-[12px] font-bold text-pine/70 sm:inline">
              {rows.length} baris • {formatRibuan(totalCetak)} cetak
            </span>
            <button
              onClick={() => setShowRekap(true)}
              className="btn-press h-10 rounded-xl border border-line-strong bg-white px-4 text-[12.5px] font-bold text-pine hover:border-pine/30 hover:bg-cream"
            >
              ⧉ List Rekap
            </button>
            <button
              onClick={() => {
                onToast("Membuka pratinjau cetak — gunakan Ctrl+P untuk mencetak.");
                setShowRekap(true);
              }}
              className="btn-press h-10 rounded-xl bg-brand px-5 text-[12.5px] font-bold text-white shadow-[0_8px_20px_rgba(217,119,6,0.3)] hover:bg-brand-deep"
            >
              ⎙ Cetak
            </button>
          </div>
        </div>

        {/* tabel */}
        <div className="overflow-x-auto px-5 pb-5 sm:px-6">
          <table className="w-full min-w-[560px] overflow-hidden rounded-2xl border border-line text-left text-[13px]">
            <thead>
              <tr className="bg-pine text-cream">
                <th className="px-4 py-3 text-[11px] font-bold tracking-widest uppercase">ID</th>
                <th className="px-4 py-3 text-[11px] font-bold tracking-widest uppercase">Tanggal / Shift</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold tracking-widest uppercase">Cetak</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold tracking-widest uppercase">Masak</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold tracking-widest uppercase">Sisa</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold tracking-widest uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.id}
                  className="row-enter border-t border-line bg-white transition-colors hover:bg-brand-soft/60"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <td className="px-4 py-3 font-mono text-[12px] font-bold text-brand-deep">{r.id}</td>
                  <td className="px-4 py-3 font-semibold">{r.tanggal}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">{formatRibuan(r.cetak)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-pine/75">{formatRibuan(r.masak)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={`font-bold ${r.cetak - r.masak > 10 ? "text-brand-deep" : "text-pine/60"}`}>
                      {formatRibuan(r.cetak - r.masak)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right"><StatusPill s={r.status} /></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <p className="text-[14px] font-bold">Tidak ada baris yang cocok</p>
                    <p className="mt-1 text-[12.5px] text-pine/55">Coba kata kunci lain, mis. “pagi”, “selesai”, “R-10”.</p>
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-pine/15 bg-cream/70 font-extrabold">
                <td colSpan={2} className="px-4 py-3 text-[12px] tracking-wide uppercase">Total tampil</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatRibuan(totalCetak)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatRibuan(totalMasak)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-brand-deep">{formatRibuan(totalCetak - totalMasak)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* modal list rekap — panel kanan wireframe */}
      {showRekap && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-pine-deep/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="List rekap" onClick={() => setShowRekap(false)}>
          <div className="anim-modal w-full max-w-[560px] overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between bg-pine px-6 py-4 text-cream">
              <div>
                <p className="text-[11px] font-bold tracking-widest text-cream/60 uppercase">Pratinjau cetak</p>
                <h3 className="text-[16px] font-extrabold">List Rekap Produksi</h3>
              </div>
              <button onClick={() => setShowRekap(false)} aria-label="Tutup" className="btn-press grid h-9 w-9 place-items-center rounded-xl bg-cream/10 text-lg hover:bg-cream/20">×</button>
            </div>
            <div className="max-h-[46vh] overflow-auto p-6">
              <table className="w-full border-collapse text-[12.5px]">
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border border-line">
                      <td className="border border-line bg-cream/50 px-3 py-2.5 font-mono font-bold">{r.id}</td>
                      <td className="border border-line px-3 py-2.5 font-semibold">{r.tanggal}</td>
                      <td className="border border-line px-3 py-2.5 text-right tabular-nums">{r.cetak}/{r.masak}</td>
                      <td className="border border-line px-3 py-2.5 text-center">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-[11.5px] text-pine/55">Dokumen internal Pabrik Tahu Maju Jaya • {rows.length} baris • dicetak {new Date().toLocaleString("id-ID")}</p>
            </div>
            <div className="no-print flex gap-2 border-t border-line bg-cream/60 px-6 py-4">
              <button onClick={() => setShowRekap(false)} className="btn-press h-10 flex-1 rounded-xl border border-line-strong bg-white text-[13px] font-bold hover:bg-cream">Tutup</button>
              <button onClick={() => window.print()} className="btn-press h-10 flex-1 rounded-xl bg-pine text-[13px] font-bold text-cream hover:bg-pine-deep">⎙ Cetak sekarang</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
