"use client";

import { useEffect, useMemo, useState } from "react";
import { formatRibuan, type InputRow } from "./data";
import { skin } from "./theme";

const KUNCI_DRAFT = "tmj_input";

/* Kolom angka identik (cetak & masak) — dirender dari satu daftar agar tidak dobel. */
const KOLOM_ANGKA = [
  { kunci: "cetak", label: "Cetak", satuan: "(papan)" },
  { kunci: "masak", label: "Masak", satuan: "(papan)" },
] as const;

const SEL = "px-4 py-2.5";
const KEPALA_KOLOM = "px-4 py-3 text-left text-[11px] font-bold tracking-widest uppercase";
const INPUT = "auth-input h-10 w-full rounded-xl border px-3";
const INPUT_TEKS = `${INPUT} font-semibold`;
const INPUT_ANGKA = `${INPUT} font-bold tabular-nums`;

function barisKosong(id: number): InputRow {
  return { id, nama: "", cetak: 0, masak: 0, done: false };
}

function jadiAngka(nilai: unknown): number {
  return Math.max(0, Math.min(9999, Math.floor(Number(nilai)) || 0));
}

function tanggalPanjang(d: Date) {
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function jamTampil(d: Date) {
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).replace(/\./g, ":");
}

/** Draft lokal bisa rusak atau versi lama — bersihkan total sebelum dipakai lagi. */
function draftBersih(mentah: string | null): InputRow[] | null {
  try {
    if (!mentah) return null;
    const j = JSON.parse(mentah) as { rows?: unknown } | null;
    if (!Array.isArray(j?.rows) || j.rows.length === 0) return null;
    const hasil: InputRow[] = [];
    for (const mentah of j.rows as Partial<InputRow>[]) {
      const id = Number(mentah?.id);
      if (!Number.isFinite(id) || hasil.some((x) => x.id === id)) continue;
      hasil.push({
        id,
        nama: typeof mentah?.nama === "string" ? mentah.nama.slice(0, 60) : "",
        cetak: jadiAngka(mentah?.cetak),
        masak: jadiAngka(mentah?.masak),
        done: Boolean(mentah?.done),
      });
    }
    return hasil.length > 0 ? hasil : null;
  } catch {
    return null;
  }
}

export default function InputView({ onToast, dark }: { onToast: (m: string) => void; dark: boolean }) {
  const [rows, setRows] = useState<InputRow[]>(() => [1, 2, 3].map(barisKosong));
  const [now, setNow] = useState(() => new Date());
  const [siap, setSiap] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sukses, setSukses] = useState<string | null>(null);

  const s = skin(dark);

  /* Jam + tanggal realtime: pembaruan terjadi di dalam callback setInterval,
     bukan di body effect — jadi tidak memicu cascading render. */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* Pulihkan draft tersimpan. Pembacaan lewat rantai promise + guard `batal`
     supaya setState tidak sinkron di body effect dan render selesai tetap aman. */
  useEffect(() => {
    let batal = false;
    void (async () => {
      const draft = draftBersih(window.localStorage.getItem(KUNCI_DRAFT));
      if (batal || !draft) return;
      setRows(draft);
    })().then(() => {
      if (!batal) setSiap(true);
    });
    return () => {
      batal = true;
    };
  }, []);

  /* Simpan draft tiap baris berubah; form kosong tidak perlu disimpan. */
  useEffect(() => {
    try {
      const adaIsi = rows.some((r) => r.nama.trim() !== "" || r.cetak > 0 || r.masak > 0);
      if (adaIsi) window.localStorage.setItem(KUNCI_DRAFT, JSON.stringify({ at: new Date().toISOString(), rows }));
      else window.localStorage.removeItem(KUNCI_DRAFT);
    } catch {
      /* penyimpanan browser penuh/ditolak — form tetap jalan tanpa draft */
    }
  }, [rows]);

  const terkirim = useMemo(() => rows.filter((r) => r.cetak > 0 || r.masak > 0), [rows]);
  const totalCetak = useMemo(() => rows.reduce((a, r) => a + r.cetak, 0), [rows]);
  const totalMasak = useMemo(() => rows.reduce((a, r) => a + r.masak, 0), [rows]);
  const semuaTandai = rows.length > 0 && rows.every((r) => r.done);
  const bolehKirim = siap && !sending && terkirim.length > 0;

  function ubahSel(id: number, ubah: Partial<InputRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...ubah } : r)));
    setSukses(null);
  }

  async function kirim() {
    if (!bolehKirim) return;

    /* Backend menolak SELURUH batch kalau satu nama kosong — tangkap di sini
       supaya user tahu baris mana, bukan cuma pesan 400 dari server. */
    const tanpaNama = terkirim.filter((r) => !r.nama.trim()).map((r) => rows.findIndex((x) => x.id === r.id) + 1);
    if (tanpaNama.length > 0) {
      const pesan = `Nama pelanggan wajib diisi pada baris ${tanpaNama.join(", ")} sebelum dikirim.`;
      setError(pesan);
      setSukses(null);
      onToast(pesan);
      return;
    }

    setSending(true);
    setError(null);
    setSukses(null);
    try {
      const res = await fetch("/api/produksi/input", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rincian: terkirim.map((r) => ({
            nama: r.nama.trim(),
            jumlah_cetak: r.cetak,
            jumlah_masak: r.masak,
          })),
        }),
      });
      const json = (await res.json().catch(() => null)) as { status?: string; message?: string } | null;
      const dariServer = typeof json?.message === "string" ? json.message.trim() : "";

      /* 207 = rincianpelanggan tersimpan tapi rekap harian gagal. Form sengaja
         TIDAK dikosongkan: rincian sudah masuk database, mengulang kirim risks duplikasi. */
      if (res.status === 207 || json?.status === "partial_success") {
        const pesan = dariServer || "Sebagian data tersimpan, sebagian gagal. Form tidak dikosongkan — periksa rekap hari ini.";
        setError(pesan);
        onToast(pesan);
        return;
      }

      if (!res.ok || json?.status !== "success") {
        const pesan = dariServer || `Gagal menyimpan data produksi (HTTP ${res.status}).`;
        setError(pesan);
        onToast(pesan);
        return;
      }

      const pesan = dariServer || "Data produksi tersimpan di rekap hari ini.";
      setSukses(pesan);
      setRows((rs) => rs.map((r) => ({ ...r, cetak: 0, masak: 0, done: false })));
      onToast(pesan);
    } catch {
      const pesan = "Tidak dapat menghubungi server. Data belum tersimpan — periksa koneksi lalu coba lagi.";
      setError(pesan);
      onToast(pesan);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className={`anim-rise overflow-hidden rounded-3xl border ${s.kartu}`}>
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
              <p className="text-[16px] font-extrabold tracking-tight sm:text-[18px]">{tanggalPanjang(now)}</p>
              <p className="font-mono text-[13px] font-bold text-brand-soft tabular-nums">{jamTampil(now)} WIB</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-cream/15 bg-cream/[0.07] px-4 py-2.5 text-right backdrop-blur">
              <p className="text-[10px] font-bold tracking-widest text-cream/55 uppercase">Total sesi</p>
              <p className="text-[15px] font-extrabold tabular-nums">
                {formatRibuan(totalCetak)} <span className="text-cream/55 text-[11px]">cetak</span> • {formatRibuan(totalMasak)}{" "}
                <span className="text-cream/55 text-[11px]">masak</span>
              </p>
            </div>
            {rows.length > 0 && (
              <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-[12.5px] font-bold text-white shadow-lg transition hover:bg-brand-deep">
                <input
                  type="checkbox"
                  checked={semuaTandai}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setRows((rs) => rs.map((r) => ({ ...r, done: v })));
                    setSukses(null);
                  }}
                  className="h-4 w-4 accent-white"
                />
                Pilih Semua
              </label>
            )}
          </div>
        </div>
      </div>

      {/* tabel input */}
      <div className="overflow-x-auto p-4 sm:p-5">
        {!siap ? (
          <div role="status" className={`rounded-2xl border px-4 py-10 text-center ${s.panel}`}>
            <p className={`text-[13px] font-semibold ${s.sub}`}>Memuat draft tersimpan…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className={`rounded-2xl border px-4 py-10 text-center ${s.panel}`}>
            <p className={`text-[13.5px] font-extrabold ${s.judul}`}>Belum ada baris</p>
            <p className={`mt-1 text-[12px] font-medium ${s.sub}`}>Tekan “+ Tambah baris” untuk mulai mencatat produksi hari ini.</p>
          </div>
        ) : (
          <table className={`w-full min-w-[720px] overflow-hidden rounded-2xl border text-[13px] ${s.garis}`}>
            <thead>
              <tr className={s.kepalaTabel}>
                <th className={`w-[60px] ${KEPALA_KOLOM}`}>No</th>
                <th className={KEPALA_KOLOM}>Nama pelanggan</th>
                {KOLOM_ANGKA.map((k) => (
                  <th key={k.kunci} className={KEPALA_KOLOM}>
                    {k.label} <span className="font-medium normal-case opacity-60">{k.satuan}</span>
                  </th>
                ))}
                <th className={`w-[150px] text-center ${KEPALA_KOLOM}`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.id}
                  className={`row-enter border-t transition-colors ${s.garis} ${s.baris} ${i % 2 === 1 ? s.barisZebra : ""}`}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <td className={`${SEL} font-mono font-bold tabular-nums opacity-60`}>{String(i + 1).padStart(2, "0")}</td>
                  <td className={SEL}>
                    <input
                      type="text"
                      value={r.nama}
                      maxLength={60}
                      placeholder="Contoh: Bu Sari"
                      aria-label={`Nama pelanggan baris ${i + 1}`}
                      onChange={(e) => ubahSel(r.id, { nama: e.target.value.slice(0, 60) })}
                      className={`${INPUT_TEKS} ${s.input}`}
                    />
                  </td>
                  {KOLOM_ANGKA.map((k) => (
                    <td key={k.kunci} className={SEL}>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={9999}
                        value={r[k.kunci]}
                        aria-label={`${k.label} baris ${i + 1}`}
                        onChange={(e) => ubahSel(r.id, { [k.kunci]: jadiAngka(e.target.value) })}
                        className={`${INPUT_ANGKA} ${s.input}`}
                      />
                    </td>
                  ))}
                  <td className={`${SEL} text-center`}>
                    <button
                      type="button"
                      onClick={() => ubahSel(r.id, { done: !r.done })}
                      aria-pressed={r.done}
                      aria-label={`Tandai baris ${i + 1} sebagai ${r.done ? "belum selesai" : "selesai"}`}
                      className={`btn-press inline-flex h-8 w-14 items-center rounded-full p-1 transition-colors ${r.done ? "bg-brand" : s.track}`}
                    >
                      <span
                        className={`grid h-6 w-6 place-items-center rounded-full bg-white text-[12px] font-bold shadow transition-all ${r.done ? "translate-x-6 text-brand" : `translate-x-0 ${s.ikon}`}`}
                      >
                        {r.done ? "✓" : "○"}
                      </span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {error && (
          <div
            role="alert"
            className={`mt-3 flex items-start gap-2.5 rounded-2xl border px-4 py-3 ${dark ? "border-red-400/40 bg-red-500/12" : "border-red-300/60 bg-red-50/70"}`}
          >
            <span className={`mt-px shrink-0 ${dark ? "text-red-300" : "text-red-600"}`} aria-hidden>
              ⚠
            </span>
            <p className={`text-[12.5px] leading-5 font-semibold ${dark ? "text-red-200" : "text-red-800"}`}>{error}</p>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRows((rs) => [...rs, barisKosong(rs.length ? Math.max(...rs.map((r) => r.id)) + 1 : 1)])}
              className={`btn-press h-10 rounded-xl border border-dashed px-4 text-[12.5px] font-bold transition hover:border-brand hover:text-brand-deep ${s.garis} ${s.judul}`}
            >
              + Tambah baris
            </button>
            <button
              type="button"
              onClick={() => setRows((rs) => rs.slice(0, -1))}
              disabled={rows.length === 0 || sending}
              className={`btn-press h-10 rounded-xl px-3 text-[12.5px] font-bold transition disabled:opacity-40 ${s.hantu}`}
            >
              Hapus terakhir
            </button>
          </div>
          <p className={`text-[12px] font-medium ${s.sub}`}>
            {rows.filter((r) => r.done).length}/{rows.length} baris ditandai • sisa belum masak:{" "}
            <b className={dark ? "text-brand" : "text-brand-deep"}>{Math.max(0, totalCetak - totalMasak)} papan</b>
          </p>
        </div>
      </div>

      <div className={`flex flex-wrap items-center gap-3 border-t px-5 py-4 sm:px-6 ${s.garis} ${s.panel}`}>
        <div
          className={`flex flex-1 items-center gap-2 text-[12.5px] font-semibold ${sukses ? (dark ? "text-emerald-300" : "text-emerald-800") : s.sub}`}
        >
          <span
            className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] ${sukses ? "bg-emerald-600 text-white" : "bg-pine/10 text-pine/50"}`}
            aria-hidden
          >
            {sukses ? "✓" : "•"}
          </span>
          {sukses ?? "Isi nama pelanggan dan jumlah cetak/masak, lalu kirim ke rekap harian."}
        </div>
        <button
          type="button"
          onClick={kirim}
          disabled={!bolehKirim}
          className={`btn-press h-11 min-w-[170px] rounded-xl text-[13.5px] font-bold transition disabled:cursor-not-allowed disabled:opacity-55 ${s.tombolGelap}`}
        >
          {sending ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/40 border-t-current" />
              Mengirim…
            </span>
          ) : (
            "Kirim ▸"
          )}
        </button>
      </div>

      {sending && (
        <div className={`h-1 overflow-hidden ${s.track}`}>
          <div className="h-full w-full origin-left bg-brand" style={{ animation: "tmj-bar-grow 1.1s ease forwards" }} />
        </div>
      )}
    </section>
  );
}