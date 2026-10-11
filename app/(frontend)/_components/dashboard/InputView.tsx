"use client";

import { useEffect, useMemo, useState } from "react";
import { INPUT_AWAL, type InputRow } from "./data";

function liveLabel(d: Date) {
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function liveClock(d: Date) {
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).replace(/\./g, ":");
}

export default function InputView({ onToast }: { onToast: (msg: string) => void }) {
  const [rows, setRows] = useState<InputRow[]>(INPUT_AWAL);
  const [now, setNow] = useState(() => new Date());
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const allChecked = rows.length > 0 && rows.every((r) => r.done);
  const totalCetak = useMemo(() => rows.reduce((a, b) => a + (Number(b.cetak) || 0), 0), [rows]);
  const totalMasak = useMemo(() => rows.reduce((a, b) => a + (Number(b.masak) || 0), 0), [rows]);

  function setCell(id: number, k: "cetak" | "masak", v: number) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [k]: Math.max(0, Math.min(9999, Math.floor(v) || 0)) } : r)));
    setSent(false);
  }

  function kirim() {
    if (sending) return;
    if (rows.every((r) => !r.cetak && !r.masak)) {
      onToast("Isi dulu minimal satu baris cetak/masak sebelum dikirim.");
      return;
    }
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setSent(true);
      try {
        localStorage.setItem("tmj_input", JSON.stringify({ at: new Date().toISOString(), rows }));
      } catch {}
      onToast(`Terkirim — ${totalCetak} cetak & ${totalMasak} masak masuk rekap hari ini.`);
    }, 1100);
  }

  return (
    <section className="anim-rise overflow-hidden rounded-3xl border border-line bg-white shadow-[0_20px_50px_rgba(20,52,43,0.08)]">
      {/* header tanggal realtime */}
      <div className="relative overflow-hidden bg-pine px-5 py-5 text-cream sm:px-6">
        <div className="dot-grid absolute inset-0" aria-hidden />
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-brand/25 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="steam relative grid h-12 w-12 place-items-center rounded-2xl bg-cream/10 text-2xl" aria-hidden>
              🍲
              <span style={{ left: "35%", animationDelay: "0s" }} />
              <span style={{ left: "55%", animationDelay: "0.9s" }} />
            </span>
            <div>
              <p className="flex items-center gap-2 text-[11px] font-bold tracking-widest text-cream/60 uppercase">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" style={{ animation: "tmj-live-dot 1.8s infinite" }} />
                Tanggal real time
              </p>
              <p className="text-[16px] font-extrabold tracking-tight sm:text-[18px]">{liveLabel(now)}</p>
              <p className="font-mono text-[13px] font-bold text-brand-soft tabular-nums">{liveClock(now)} WIB</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-cream/15 bg-cream/[0.07] px-4 py-2.5 text-right backdrop-blur">
              <p className="text-[10px] font-bold tracking-widest text-cream/55 uppercase">Total sesi</p>
              <p className="text-[15px] font-extrabold tabular-nums">{totalCetak} <span className="text-cream/55 text-[11px]">cetak</span> • {totalMasak} <span className="text-cream/55 text-[11px]">masak</span></p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-[12.5px] font-bold text-white shadow-lg transition hover:bg-brand-deep">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={(e) => {
                  const v = e.target.checked;
                  setRows((rs) => rs.map((r) => ({ ...r, done: v })));
                }}
                className="h-4 w-4 accent-white"
              />
              Pilih Semua
            </label>
          </div>
        </div>
      </div>

      {/* tabel input */}
      <div className="overflow-x-auto p-4 sm:p-5">
        <table className="w-full min-w-[620px] overflow-hidden rounded-2xl border border-line text-[13px]">
          <thead>
            <tr className="bg-cream-muted/70 text-pine">
              <th className="w-[64px] px-4 py-3 text-left text-[11px] font-bold tracking-widest uppercase">No</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold tracking-widest uppercase">Cetak <span className="font-medium normal-case text-pine/50">(papan)</span></th>
              <th className="px-4 py-3 text-left text-[11px] font-bold tracking-widest uppercase">Masak <span className="font-medium normal-case text-pine/50">(papan)</span></th>
              <th className="w-[150px] px-4 py-3 text-center text-[11px] font-bold tracking-widest uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="row-enter border-t border-line transition-colors hover:bg-brand-soft/50" style={{ animationDelay: `${i * 50}ms` }}>
                <td className="px-4 py-2.5 font-mono font-bold text-pine/60">{String(i + 1).padStart(2, "0")}</td>
                <td className="px-4 py-2.5">
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    value={r.cetak}
                    aria-label={`Cetak baris ${i + 1}`}
                    onChange={(e) => setCell(r.id, "cetak", Number(e.target.value))}
                    className="auth-input h-10 w-full rounded-xl border border-line-strong bg-white px-3 font-bold tabular-nums"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    value={r.masak}
                    aria-label={`Masak baris ${i + 1}`}
                    onChange={(e) => setCell(r.id, "masak", Number(e.target.value))}
                    className="auth-input h-10 w-full rounded-xl border border-line-strong bg-white px-3 font-bold tabular-nums"
                  />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <button
                    onClick={() => {
                      setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, done: !x.done } : x)));
                      setSent(false);
                    }}
                    aria-pressed={r.done}
                    aria-label={`Tandai baris ${i + 1} ${r.done ? "belum" : "selesai"}`}
                    className={`btn-press inline-flex h-8 w-14 items-center rounded-full p-1 transition-colors ${r.done ? "bg-pine" : "bg-cream-dark border border-line-strong"}`}
                  >
                    <span
                      className={`grid h-6 w-6 place-items-center rounded-full text-[12px] font-bold shadow transition-all ${r.done ? "translate-x-6 bg-brand text-white" : "translate-x-0 bg-white text-pine/40"}`}
                    >
                      {r.done ? "✓" : "○"}
                    </span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => {
                const id = rows.length ? Math.max(...rows.map((r) => r.id)) + 1 : 1;
                setRows((rs) => [...rs, { id, cetak: 0, masak: 0, done: false }]);
              }}
              className="btn-press h-10 rounded-xl border border-dashed border-pine/25 px-4 text-[12.5px] font-bold text-pine hover:border-brand hover:text-brand-deep"
            >
              + Tambah baris
            </button>
            <button
              onClick={() => setRows((rs) => (rs.length > 1 ? rs.slice(0, -1) : rs))}
              className="btn-press h-10 rounded-xl px-3 text-[12.5px] font-bold text-pine/50 hover:bg-cream hover:text-pine"
            >
              Hapus terakhir
            </button>
          </div>
          <p className="text-[12px] font-medium text-pine/55">
            {rows.filter((r) => r.done).length}/{rows.length} baris ditandai • sisa belum masak: <b className="text-brand-deep">{totalCetak - totalMasak} papan</b>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line bg-cream/60 px-5 py-4 sm:px-6">
        <div className={`flex flex-1 items-center gap-2 text-[12.5px] font-semibold ${sent ? "text-emerald-800" : "text-pine/55"}`}>
          <span className={`grid h-6 w-6 place-items-center rounded-full text-[12px] ${sent ? "bg-emerald-600 text-white" : "bg-pine/10 text-pine/50"}`}>{sent ? "✓" : "•"}</span>
          {sent ? "Data sesi ini sudah dikirim ke rekap." : "Periksa angka sebelum kirim — data masuk rekap harian."}
        </div>
        <button
          onClick={kirim}
          disabled={sending}
          className={`btn-press h-11 min-w-[170px] rounded-xl text-[13.5px] font-bold text-white shadow-[0_10px_24px_rgba(217,119,6,0.32)] ${sending ? "bg-pine/70" : "bg-brand hover:bg-brand-deep"} disabled:cursor-wait`}
        >
          {sending ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Mengirim…
            </span>
          ) : (
            "Kirim ▸"
          )}
        </button>
      </div>

      {sending && (
        <div className="h-1 overflow-hidden bg-cream-dark">
          <div className="h-full w-full origin-left bg-brand" style={{ animation: "tmj-bar-grow 1.1s ease forwards" }} />
        </div>
      )}
    </section>
  );
}
