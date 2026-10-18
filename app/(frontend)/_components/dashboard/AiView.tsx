"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatRibuan, type Prediksi } from "./data";
import { IconAlert, IconHistory } from "./icons";
import { skin } from "./theme";

/* ---------- Bentuk respons server (lihat app/(backend)/api/ai/prediksi/route.ts) ---------- */

type BalasanPrediksi = {
  status?: string;
  message?: string;
  data?: {
    prediksi_aktif?: Prediksi | null;
    riwayat_prediksi?: Prediksi[];
  };
};

type Hasil =
  | { ok: true; aktif: Prediksi | null; riwayat: Prediksi[] }
  | { ok: false; belumMasuk: boolean; pesan: string };

type Fase = "memuat" | "belum-masuk" | "gagal" | "kosong" | "sukses";

type State = {
  fase: Fase;
  aktif: Prediksi | null;
  riwayat: Prediksi[];
  pesan: string | null;
};

const ENDPOINT = "/api/ai/prediksi";

/**
 * Log yang jujur: hanya menggambarkan langkah permintaan HTTP yang benar-benar terjadi.
 * Tidak ada klaim langkah analisis yang tidak dikerjakan server.
 */
const LOGS = [
  "Menghubungkan ke server…",
  "Membaca riwayat cetakan dari database…",
  "Menyusun estimasi cetakan per hari…",
  "Menghitung total kebutuhan cetakan…",
  "Menyimpan hasil ke server…",
];

/** Saran statis — dengan sengaja TIDAK dihitung dari data pengguna. */
const SARAN_SHIFT =
  "Siapkan satu cetakan cadangan pada hari dengan rata-rata cetak tertinggi, rendam kedelai semalam sebelumnya, dan pakai hari sepi untuk mencuci cetakan serta mengganti saringan.";

async function ambilPrediksi(): Promise<Hasil> {
  try {
    const res = await fetch(`${ENDPOINT}?limit=5`, {
      cache: "no-store",
      credentials: "include",
    });
    const json = (await res.json().catch(() => null)) as BalasanPrediksi | null;

    if (res.status === 401) {
      return {
        ok: false,
        belumMasuk: true,
        pesan:
          json?.message ??
          "Akses ditolak: Anda belum login atau sesi telah berakhir.",
      };
    }
    if (!res.ok || !json || json.status !== "success") {
      return {
        ok: false,
        belumMasuk: false,
        pesan: json?.message ?? `Gagal memuat prediksi (HTTP ${res.status}).`,
      };
    }
    return {
      ok: true,
      aktif: json.data?.prediksi_aktif ?? null,
      riwayat: Array.isArray(json.data?.riwayat_prediksi)
        ? json.data.riwayat_prediksi
        : [],
    };
  } catch {
    return {
      ok: false,
      belumMasuk: false,
      pesan: "Tidak dapat terhubung ke server saat memuat prediksi.",
    };
  }
}

/** Reducer dari hasil fetch ke state — dipakai oleh effect mount maupun tombol Ulangi. */
function keState(h: Hasil): State {
  if (h.ok) {
    return {
      fase: h.aktif ? "sukses" : "kosong",
      aktif: h.aktif,
      riwayat: h.riwayat,
      pesan: null,
    };
  }
  return {
    fase: h.belumMasuk ? "belum-masuk" : "gagal",
    aktif: null,
    riwayat: [],
    pesan: h.pesan,
  };
}

/** Backend mengirim id "mock-…" saat tabel `prediksi` belum ada isinya. */
function dariServerCadangan(p: Prediksi): boolean {
  return String(p.id).toLowerCase().startsWith("mock-");
}

/** Angka desimal atau null — dipakai agar MAE/MAPE yang kosong jujur ditampilkan. */
function angkaDesimal(n: number | null | undefined, desimal = 2): string | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return n.toLocaleString("id-ID", {
    minimumFractionDigits: desimal,
    maximumFractionDigits: desimal,
  });
}

export default function AiView({
  onToast,
  dark = false,
}: {
  onToast: (m: string) => void;
  dark?: boolean;
}) {
  const [st, setSt] = useState<State>({
    fase: "memuat",
    aktif: null,
    riwayat: [],
    pesan: null,
  });
  const [jalan, setJalan] = useState(false);
  const [progres, setProgres] = useState(0);
  const [logIdx, setLogIdx] = useState(0);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hidup = useRef(true);

  // Muat sekali saat mount. setState hanya terjadi setelah `await`, jadi tidak
  // menyalakan aturan react-hooks/set-state-in-effect.
  useEffect(() => {
    hidup.current = true;
    let batal = false;
    (async () => {
      const h = await ambilPrediksi();
      if (batal) return;
      setSt(keState(h));
    })();
    return () => {
      batal = true;
      hidup.current = false;
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, []);

  const hentikanTimer = () => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  };

  async function jalankan() {
    if (jalan) return;
    setJalan(true);
    setProgres(0);
    setLogIdx(0);

    // Animasi mencerminkan request yang sedang berjalan, bukan angka rekaan:
    // naik bertahap sampai 90%, lalu 100% saat server benar-benar menjawab.
    let p = 0;
    let li = 0;
    timer.current = setInterval(() => {
      p = Math.min(90, p + 3);
      setProgres(p);
      const berikut = Math.min(LOGS.length - 1, Math.floor((p / 90) * LOGS.length));
      if (berikut > li) {
        li = berikut;
        setLogIdx(li);
      }
    }, 200);

    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const json = (await res.json().catch(() => null)) as BalasanPrediksi | null;
      hentikanTimer();
      if (!hidup.current) return;

      if (res.status === 401) {
        setSt(keState({ ok: false, belumMasuk: true, pesan: json?.message ?? "Anda belum login atau sesi telah berakhir." }));
        setJalan(false);
        return;
      }
      if (!res.ok || !json || json.status !== "success") {
        setSt(keState({ ok: false, belumMasuk: false, pesan: json?.message ?? `Gagal menjalankan estimasi (HTTP ${res.status}).` }));
        setJalan(false);
        return;
      }

      setProgres(100);
      setLogIdx(LOGS.length - 1);
      await new Promise((r) => setTimeout(r, 420));
      if (!hidup.current) return;

      // Muat ulang lewat GET supaya kartu menampilkan data yang benar-benar tersimpan.
      const h = await ambilPrediksi();
      if (!hidup.current) return;
      setSt(keState(h));
      onToast(json.message ?? "Estimasi cetakan selesai dihitung.");
    } catch {
      hentikanTimer();
      if (!hidup.current) return;
      setSt(keState({ ok: false, belumMasuk: false, pesan: "Tidak dapat terhubung ke server." }));
      onToast("Tidak dapat terhubung ke server.");
    } finally {
      if (hidup.current) setJalan(false);
    }
  }

  async function ulang() {
    setSt({ fase: "memuat", aktif: null, riwayat: [], pesan: null });
    const h = await ambilPrediksi();
    setSt(keState(h));
  }

  async function salinRingkasan() {
    const p = st.aktif;
    if (!p) return;
    const rincian = (p.detail_harian ?? [])
      .map((d) => `- ${d.hari} (${d.tanggal}): ${formatRibuan(d.estimasi_cetak)} cetak`)
      .join("\n");
    const teks = [
      `Estimasi cetakan ${p.periode_mulai} s.d. ${p.periode_selesai}`,
      `Total estimasi: ${formatRibuan(p.total_cetak_prediksi)} cetak`,
      rincian,
      "Estimasi dari sistem — bukan angka pasti.",
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(teks);
      onToast("Ringkasan estimasi disalin.");
    } catch {
      onToast("Peramban menolak akses papan klip — salin manual dari rincian di bawah.");
    }
  }

  const s = skin(dark);
  const p = st.aktif;
  const detail = p?.detail_harian ?? [];
  const puncak = detail.reduce((m, d) => (d.estimasi_cetak > m ? d.estimasi_cetak : m), 1);
  const total = p?.total_cetak_prediksi ?? 0;
  const rata = detail.length > 0 ? Math.round(total / detail.length) : null;
  const mae = angkaDesimal(p?.mae);
  const mape = angkaDesimal(p?.mape);
  const mapeAngka = typeof p?.mape === "number" && Number.isFinite(p.mape) ? p.mape : null;
  const model = p?.model_version?.trim() ? p.model_version : null;
  const catatan = p?.catatan_model?.trim() ? p.catatan_model : null;

  return (
    <section className={`anim-rise overflow-hidden rounded-3xl border ${s.kartu}`}>
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
        <p className="relative text-[11px] font-bold tracking-[0.18em] text-brand-soft uppercase">Perkiraan produksi</p>
        <h2 className="relative mx-auto mt-1 max-w-[30ch] text-[19px] font-extrabold tracking-tight sm:text-[22px]">
          Estimasi Jumlah Cetakan Minggu Depan
        </h2>
        <p className="relative mx-auto mt-2 max-w-[52ch] text-[12.5px] leading-5 text-cream/65">
          Angka perkiraan untuk 7 hari ke depan, diambil langsung dari server. Tekan tombol untuk meminta perhitungan baru.
        </p>
        <div className="relative mt-5 flex flex-wrap justify-center gap-2">
          <button
            onClick={jalankan}
            disabled={jalan || st.fase === "memuat"}
            className={`btn-press h-11 rounded-xl px-8 text-[13.5px] font-bold text-white shadow-[0_10px_26px_rgba(217,119,6,0.4)] ${jalan ? "cursor-wait bg-pine-soft" : "bg-brand hover:bg-brand-deep shimmer-wrap"}`}
          >
            {jalan ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Menghitung… {progres}%
              </span>
            ) : (
              "▶ Mulai Prediksi"
            )}
          </button>
          {p && (
            <button onClick={salinRingkasan} className="btn-press h-11 rounded-xl border border-cream/20 bg-cream/10 px-6 text-[13px] font-bold text-cream hover:bg-cream/15">
              Salin ringkasan
            </button>
          )}
        </div>
        {jalan && (
          <div className="relative mx-auto mt-4 max-w-[420px]">
            <div
              className="h-2 overflow-hidden rounded-full bg-cream/15"
              role="progressbar"
              aria-label="Kemajuan permintaan estimasi"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progres}
            >
              <div className="h-full rounded-full bg-gradient-to-r from-brand to-amber-300 transition-all duration-200" style={{ width: `${progres}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* body */}
      <div className="p-5 sm:p-6">
        {jalan ? (
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
                  className={`h-6 rounded-md ${(i / 28) * 100 < progres ? "bg-brand" : "bg-cream/10"}`}
                  style={{ transition: "background 200ms" }}
                />
              ))}
            </div>
          </div>
        ) : st.fase === "memuat" ? (
          <div role="status" className={`anim-fade grid gap-3 rounded-2xl border border-dashed p-6 text-center ${s.garis} ${s.panel}`}>
            <p className="text-[26px]" aria-hidden>🏭</p>
            <p className={`text-[13.5px] font-bold ${s.judul}`}>Memuat estimasi dari server…</p>
            <p className={`mx-auto max-w-[46ch] text-[12.5px] leading-5 ${s.sub}`}>
              Menunggu balasan /api/ai/prediksi.
            </p>
          </div>
        ) : st.fase === "belum-masuk" ? (
          <div role="alert" className="anim-fade grid gap-3 rounded-2xl border border-amber-400/60 bg-amber-50/70 p-6 text-center text-amber-950">
            <p className={`mx-auto grid h-11 w-11 place-items-center rounded-xl text-[22px] ${s.lencana}`} aria-hidden>🔒</p>
            <p className="text-[13.5px] font-extrabold">Belum masuk</p>
            <p className="mx-auto max-w-[52ch] text-[12.5px] leading-5">
              Server menolak permintaan ini. Pesan aslinya: “{st.pesan}”
            </p>
            <p className="mx-auto max-w-[52ch] text-[12px] leading-5 text-amber-900/75">
              Masuk dulu, lalu buka kembali halaman ini. Angka di bawah tidak dimuat karena server tidak mengizinkan.
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              <Link
                href="/"
                onClick={() => onToast("Silakan masuk, lalu kembali ke dashboard untuk melihat estimasi.")}
                className="btn-press inline-flex h-10 items-center rounded-xl bg-pine px-6 text-[12.5px] font-bold text-cream"
              >
                Buka halaman masuk
              </Link>
              <button
                onClick={ulang}
                className={`btn-press inline-flex h-10 items-center rounded-xl border px-6 text-[12.5px] font-bold ${s.garis} ${s.tombolGelap}`}
              >
                Coba lagi
              </button>
            </div>
          </div>
        ) : st.fase === "gagal" ? (
          <div role="alert" className="anim-fade flex items-start gap-3 rounded-2xl border border-red-300/60 bg-red-50/70 p-5">
            <IconAlert className="mt-px h-5 w-5 shrink-0 text-red-600" />
            <div className="min-w-0 space-y-3">
              <p className="text-[13px] font-extrabold text-red-900">Gagal memuat estimasi</p>
              <p className="text-[12.5px] leading-5 text-red-800">{st.pesan}</p>
              <button
                onClick={ulang}
                className="btn-press inline-flex h-9 items-center rounded-xl bg-pine px-5 text-[12px] font-bold text-cream"
              >
                Muat ulang
              </button>
            </div>
          </div>
        ) : st.fase === "kosong" ? (
          <div className={`anim-fade grid gap-3 rounded-2xl border border-dashed p-6 text-center ${s.garis} ${s.panel}`}>
            <p className="text-[26px]" aria-hidden>🏭</p>
            <p className={`text-[13.5px] font-bold ${s.judul}`}>Belum ada estimasi di server</p>
            <p className={`mx-auto max-w-[46ch] text-[12.5px] leading-5 ${s.sub}`}>
              Server menjawab tanpa data prediksi. Tekan “Mulai Prediksi” untuk meminta perhitungan baru.
            </p>
          </div>
        ) : (
          <div className="anim-pop space-y-4">
            {p && dariServerCadangan(p) && (
              <div className="rounded-2xl border border-amber-400/60 bg-amber-50/70 px-4 py-3 text-[12.5px] leading-5 text-amber-950">
                <p className="font-extrabold">Data contoh dari server</p>
                <p className="text-amber-900/85">
                  Backend belum menyimpan hasil perhitungan ke tabel prediksi, jadi angka di bawah ini adalah
                  data cadangan yang dikirim server — bukan hasil perhitungan model.
                </p>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              {/* total estimasi */}
              <div className="card-lift rounded-2xl bg-pine p-4 text-cream">
                <p className="text-[10.5px] font-bold tracking-widest text-cream/55 uppercase">Estimasi total</p>
                <p className="mt-1 text-[26px] font-extrabold tabular-nums">
                  {formatRibuan(total)} <span className="text-[11px] text-brand-soft">cetak</span>
                </p>
                <p className="mt-1 text-[11.5px] font-semibold text-cream/65">
                  Periode {p?.periode_mulai ?? "-"} s.d. {p?.periode_selesai ?? "-"}
                </p>
              </div>

              {/* rata-rata harian, diturunkan dari rincian yang benar-benar dikirim */}
              <div className={`card-lift rounded-2xl border p-4 ${s.garis} ${s.panel}`}>
                <p className={`text-[10.5px] font-bold tracking-widest uppercase ${s.redup}`}>Rata-rata per hari</p>
                <p className={`mt-1 text-[26px] font-extrabold tabular-nums ${s.judul}`}>
                  {rata === null ? "—" : formatRibuan(rata)} <span className={`text-[11px] ${s.sub}`}>cetak</span>
                </p>
                <p className={`mt-1 text-[11.5px] font-semibold ${s.sub}`}>
                  {detail.length > 0 ? `Dari ${detail.length} hari rincian` : "Rincian harian tidak dikirim server"}
                </p>
              </div>

              {/* MAE / MAPE asli dari server — kosong ditampilkan apa adanya */}
              <div className={`card-lift rounded-2xl border p-4 ${s.garis} ${s.chipAktif}`}>
                <p className={`text-[10.5px] font-bold tracking-widest uppercase ${s.redup}`}>Ketelitian estimasi</p>
                <p className="mt-1 text-[13px] font-extrabold break-words" title={model ?? undefined}>
                  {model ?? "Model belum tersedia"}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11.5px] font-semibold">
                  <span className={s.sub}>MAE {mae ?? <span className={s.redup}>belum tersedia</span>}</span>
                  <span className={s.sub}>MAPE {mape ?? <span className={s.redup}>belum tersedia</span>}</span>
                </div>
                {mapeAngka !== null ? (
                  <div
                    className={`mt-2 h-2 overflow-hidden rounded-full ${s.barKosong}`}
                    role="img"
                    aria-label={`Perkiraan galat rata-rata ${mapeAngka.toFixed(2)} persen`}
                  >
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${Math.min(100, Math.max(0, mapeAngka))}%`, animation: "tmj-bar-grow 1s ease 0.2s both", transformOrigin: "left" }}
                    />
                  </div>
                ) : (
                  <div className={`mt-2 h-2 overflow-hidden rounded-full ${s.barKosong}`} aria-hidden />
                )}
                <p className={`mt-1.5 text-[10.5px] font-medium ${s.redup}`}>
                  {mapeAngka !== null ? "Isi bilah = MAPE (persen galat, makin kecil makin baik)" : "Bilah tidak diisi — MAPE belum tersedia"}
                </p>
              </div>
            </div>

            {/* rincian harian */}
            <div className={`overflow-hidden rounded-2xl border ${s.garis}`}>
              <div className={`border-b px-4 py-3 text-[12px] font-extrabold tracking-wide uppercase ${s.garis} ${dark ? "bg-pine-soft/40 text-cream" : "bg-cream/60 text-pine"}`}>
                Rincian estimasi per hari
              </div>
              {detail.length > 0 ? (
                <ul className={s.garis}>
                  {detail.map((d, i) => (
                    <li key={`${d.tanggal}-${i}`} className={`flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0 ${s.garis}`}>
                      <span className={`w-16 text-[12.5px] font-bold ${s.judul}`}>{d.hari}</span>
                      <span className={`w-[86px] shrink-0 text-[11px] font-medium ${s.redup}`}>{d.tanggal}</span>
                      <div className={`h-2.5 flex-1 overflow-hidden rounded-full ${s.barKosong}`}>
                        <div
                          className="h-full rounded-full bg-brand"
                          style={{ width: `${(d.estimasi_cetak / puncak) * 100}%`, animation: "tmj-bar-grow 0.9s cubic-bezier(0.22,1,0.36,1) both", animationDelay: `${i * 90}ms`, transformOrigin: "left" }}
                        />
                      </div>
                      <span className={`w-24 text-right text-[12.5px] font-extrabold tabular-nums ${s.judul}`}>
                        {formatRibuan(d.estimasi_cetak)} <span className={`text-[10px] font-semibold ${s.sub}`}>cetak</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={`px-4 py-4 text-[12.5px] leading-5 ${s.sub}`}>
                  Server tidak mengirim rincian harian untuk estimasi ini, jadi tabel per hari tidak bisa ditampilkan.
                </p>
              )}
            </div>

            {catatan && (
              <p className={`rounded-2xl border px-4 py-3 text-[12.5px] leading-5 ${s.garis} ${s.panel} ${s.sub}`}>
                <span className={`font-extrabold ${s.judul}`}>Catatan server: </span>
                {catatan}
              </p>
            )}

            {/* riwayat dari API */}
            {st.riwayat.length > 1 && (
              <div className={`overflow-hidden rounded-2xl border ${s.garis}`}>
                <div className={`flex items-center gap-2 border-b px-4 py-3 text-[12px] font-extrabold tracking-wide uppercase ${s.garis} ${dark ? "bg-pine-soft/40 text-cream" : "bg-cream/60 text-pine"}`}>
                  <IconHistory className="h-4 w-4" />
                  Riwayat estimasi
                </div>
                <ul>
                  {st.riwayat.slice(0, 5).map((r, i) => (
                    <li key={`${r.id}-${i}`} className={`flex items-center justify-between gap-3 border-b px-4 py-2.5 text-[12.5px] last:border-b-0 ${s.garis} ${s.baris}`}>
                      <span className={`min-w-0 truncate font-bold ${s.judul}`}>
                        {r.periode_mulai} s.d. {r.periode_selesai}
                      </span>
                      <span className={`shrink-0 tabular-nums ${s.sub}`}>
                        {formatRibuan(r.total_cetak_prediksi)} cetak
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* saran statis — diberi label jelas supaya tidak disalaharti hasil hitungan */}
            <div className={`rounded-2xl border p-4 text-[12.5px] leading-5 ${s.garis} ${s.panel}`}>
              <p className={`font-extrabold ${s.judul}`}>💡 Saran shift — catatan umum</p>
              <p className={`mt-1 ${s.sub}`}>{SARAN_SHIFT}</p>
              <p className={`mt-1.5 text-[11px] font-medium ${s.redup}`}>
                Teks ini panduan umum, bukan hasil hitungan dari data pabrik Anda.
              </p>
            </div>

            <p className={`text-center text-[11px] font-medium ${s.redup}`}>
              Estimasi bukan takapan pasti. Jumlah cetakan sebenarnya bergantung pada pesanan masuk.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}