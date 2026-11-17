"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { formatRibuan, type Prediksi } from "./data";
import {
  IconAlert,
  IconClose,
  IconCopy,
  IconFactory,
  IconHistory,
  IconLock,
  IconChevronRight,
  IconChevronDown,
} from "./icons";
import { skin } from "./theme";

function IconSparklesGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="m5 3 1.5 4.5L3 9l3.5 1.5L8 15l1.5-4.5L13 9 9.5 7.5Z" />
      <path d="m18 14 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" />
    </svg>
  );
}

const NAMA_BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/* ---------- Bentuk respons server (lihat app/(backend)/api/ai/prediksi/route.ts) ---------- */

type BalasanPrediksi = {
  status?: string;
  message?: string;
  data?: {
    prediksi_aktif?: Prediksi | null;
    riwayat_prediksi?: Prediksi[];
    total_cetak_prediksi?: number;
    periode_mulai?: string;
    periode_selesai?: string;
    detail_harian?: Prediksi["detail_harian"];
    basis_7_hari_input?: Prediksi["basis_7_hari_input"];
    metrik_evaluasi?: { mae?: number; r2_score?: number; catatan?: string };
    mape?: number;
    model_version?: string;
    catatan_model?: string;
    mode?: "simulasi" | "database";
    id?: string | number;
    tanggal_prediksi?: string;
    db_saved?: Prediksi;
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

function hitungRentang7Hari(tgl: number, bln: number, thn: number) {
  const dAkhir = new Date(thn, bln - 1, tgl);
  const dAwal = new Date(thn, bln - 1, tgl - 6);
  const dPredAwal = new Date(thn, bln - 1, tgl + 1);
  const dPredAkhir = new Date(thn, bln - 1, tgl + 7);
  return {
    targetStr: dAkhir.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    inputAwal: dAwal.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    inputAkhir: dAkhir.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    predAwal: dPredAwal.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    predAkhir: dPredAkhir.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    isoString: `${thn}-${String(bln).padStart(2, "0")}-${String(tgl).padStart(2, "0")}`,
  };
}

/* ==========================================================================
   MODAL PILIH TANGGAL ACUAN (DATA ASLI)
   ========================================================================== */

function ModalPilihTanggalAsli({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (tanggalIso: string) => void;
}) {
  const tglSelectId = useId();
  const blnSelectId = useId();
  const thnSelectId = useId();
  // Default ke 16 November 2026 (atau tanggal hari ini)
  const [tgl, setTgl] = useState(16);
  const [bln, setBln] = useState(11);
  const [thn, setThn] = useState(2026);

  if (!isOpen) return null;

  const rentang = hitungRentang7Hari(tgl, bln, thn);
  const jumlahHariBulan = new Date(thn, bln, 0).getDate();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-asli-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/50"
    >
      <div className="anim-pop relative w-full max-w-lg overflow-hidden rounded-3xl border border-line bg-pine p-6 text-cream shadow-2xl">
        <div className="flex items-center justify-between border-b border-cream/15 pb-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/20 text-brand">
              <IconFactory className="h-5 w-5" />
            </span>
            <div>
              <h3 id="modal-asli-title" className="text-[16px] font-black tracking-tight text-cream">
                Pilih Tanggal Acuan Prediksi
              </h3>
              <p className="text-[11.5px] text-cream/70">Uji coba AI menggunakan data riil database</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-cream/70 hover:bg-cream/10 hover:text-cream transition-colors"
            aria-label="Tutup modal"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <p className="text-[12.5px] leading-relaxed text-cream/85">
            Sesuai arsitektur model Random Forest, sistem akan memproses data produksi{" "}
            <strong className="text-brand-soft">7 hari ke belakang (seminggu)</strong> dari tanggal yang Anda
            pilih sebagai fitur inferensi (<code className="rounded bg-black/30 px-1 py-0.5 text-cream">masak_1..7</code> &{" "}
            <code className="rounded bg-black/30 px-1 py-0.5 text-cream">cetak_1..7</code>).
          </p>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor={tglSelectId} className="block text-[11px] font-bold text-cream/80 uppercase tracking-wider mb-1.5">
                Tanggal
              </label>
              <div className="relative">
                <select
                  id={tglSelectId}
                  value={tgl}
                  onChange={(e) => setTgl(Number(e.target.value))}
                  className="w-full appearance-none rounded-xl border border-cream/20 bg-pine-deep px-3 py-2.5 text-[13px] font-bold text-cream focus:border-brand focus:outline-none"
                >
                  {Array.from({ length: jumlahHariBulan }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d} className="bg-pine text-cream">
                      {d}
                    </option>
                  ))}
                </select>
                <IconChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-cream/50" />
              </div>
            </div>

            <div>
              <label htmlFor={blnSelectId} className="block text-[11px] font-bold text-cream/80 uppercase tracking-wider mb-1.5">
                Bulan
              </label>
              <div className="relative">
                <select
                  id={blnSelectId}
                  value={bln}
                  onChange={(e) => setBln(Number(e.target.value))}
                  className="w-full appearance-none rounded-xl border border-cream/20 bg-pine-deep px-3 py-2.5 text-[13px] font-bold text-cream focus:border-brand focus:outline-none"
                >
                  {NAMA_BULAN.map((nama, idx) => (
                    <option key={nama} value={idx + 1} className="bg-pine text-cream">
                      {nama}
                    </option>
                  ))}
                </select>
                <IconChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-cream/50" />
              </div>
            </div>

            <div>
              <label htmlFor={thnSelectId} className="block text-[11px] font-bold text-cream/80 uppercase tracking-wider mb-1.5">
                Tahun
              </label>
              <div className="relative">
                <select
                  id={thnSelectId}
                  value={thn}
                  onChange={(e) => setThn(Number(e.target.value))}
                  className="w-full appearance-none rounded-xl border border-cream/20 bg-pine-deep px-3 py-2.5 text-[13px] font-bold text-cream focus:border-brand focus:outline-none"
                >
                  {[2024, 2025, 2026, 2027, 2028].map((y) => (
                    <option key={y} value={y} className="bg-pine text-cream">
                      {y}
                    </option>
                  ))}
                </select>
                <IconChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-cream/50" />
              </div>
            </div>
          </div>

          {/* Kartu Pratinjau Alur 7 Hari */}
          <div className="rounded-2xl border border-cream/20 bg-pine-deep/80 p-4 text-[12px] space-y-2.5">
            <div className="flex items-start gap-2.5">
              <span className="text-brand font-bold">📌</span>
              <div>
                <p className="font-bold text-cream/70 uppercase text-[10px] tracking-wider">Tanggal Acuan (Hari ke-7)</p>
                <p className="font-extrabold text-cream text-[13px]">{rentang.targetStr}</p>
              </div>
            </div>
            <div className="border-t border-cream/10 pt-2 flex items-start gap-2.5">
              <span className="text-amber-400 font-bold">⏪</span>
              <div>
                <p className="font-bold text-amber-300 uppercase text-[10px] tracking-wider">
                  Data Historis yang Diproses (7 Hari ke Belakang)
                </p>
                <p className="font-semibold text-cream">
                  {rentang.inputAwal} s/d {rentang.inputAkhir}
                </p>
              </div>
            </div>
            <div className="border-t border-cream/10 pt-2 flex items-start gap-2.5">
              <span className="text-emerald-400 font-bold">⏩</span>
              <div>
                <p className="font-bold text-emerald-300 uppercase text-[10px] tracking-wider">
                  Target Estimasi yang Dihasilkan (7 Hari ke Depan)
                </p>
                <p className="font-semibold text-cream">
                  {rentang.predAwal} s/d {rentang.predAkhir}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-cream/15 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-cream/20 px-5 py-2.5 text-[12.5px] font-bold text-cream hover:bg-cream/10 transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => onSubmit(rentang.isoString)}
            className="btn-press inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-2.5 text-[12.5px] font-black text-white shadow-lg shadow-brand/30 hover:bg-brand-deep transition-all"
          >
            <IconSparklesGlyph />
            Jalankan Prediksi Data Asli
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   KOMPONEN UTAMA AI VIEW
   ========================================================================== */

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
  const [logsAktif, setLogsAktif] = useState<string[]>([]);
  const [modeAktif, setModeAktif] = useState<"simulasi" | "database">("simulasi");
  const [bukaModalAsli, setBukaModalAsli] = useState(false);
  const [bukaBasisDetail, setBukaBasisDetail] = useState(true);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hidup = useRef(true);

  // Muat sekali saat mount.
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

  /**
   * Eksekusi Peramalan:
   * Mode "simulasi" -> Uji Coba Data Dummy (Preset dataset pelatihan)
   * Mode "database" -> Uji Coba Data Asli (Membaca 7 hari ke belakang dari targetTanggal)
   */
  async function jalankanPrediksi(mode: "simulasi" | "database", targetTanggal?: string) {
    if (jalan) return;
    setJalan(true);
    setModeAktif(mode);
    setProgres(0);
    setLogIdx(0);

    const logList =
      mode === "simulasi"
        ? [
            "Menghubungkan ke engine AI ONNX…",
            "Memuat 7 hari basis data dummy bawaan (dataset pelatihan)…",
            "Mengekstrak 16 fitur input (masak_1..7, cetak_1..7, minggu_ke, bulan)…",
            "Mengeksekusi model Random Forest (best_rf_model.onnx)…",
            "Menyusun estimasi cetakan 7 hari ke depan…",
          ]
        : [
            "Menghubungkan ke database pabrik…",
            `Membaca data historis 7 hari ke belakang (s/d ${targetTanggal ?? "hari ini"})…`,
            "Mengekstrak 14 fitur masak & cetak + kalender ISO…",
            "Mengeksekusi model Random Forest (best_rf_model.onnx)…",
            "Menghitung estimasi total & detail produksi 7 hari ke depan…",
          ];

    setLogsAktif(logList);

    let p = 0;
    let li = 0;
    timer.current = setInterval(() => {
      p = Math.min(90, p + 5);
      setProgres(p);
      const berikut = Math.min(logList.length - 1, Math.floor((p / 90) * logList.length));
      if (berikut > li) {
        li = berikut;
        setLogIdx(li);
      }
    }, 180);

    try {
      const payload =
        mode === "simulasi"
          ? { mode: "simulasi" }
          : { mode: "database", tanggal: targetTanggal };

      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const json = (await res.json().catch(() => null)) as BalasanPrediksi | null;
      hentikanTimer();
      if (!hidup.current) return;

      if (res.status === 401) {
        setSt(
          keState({
            ok: false,
            belumMasuk: true,
            pesan: json?.message ?? "Anda belum login atau sesi telah berakhir.",
          })
        );
        setJalan(false);
        return;
      }
      if (!res.ok || !json || json.status !== "success") {
        setSt(
          keState({
            ok: false,
            belumMasuk: false,
            pesan: json?.message ?? `Gagal menjalankan estimasi (HTTP ${res.status}).`,
          })
        );
        setJalan(false);
        return;
      }

      setProgres(100);
      setLogIdx(logList.length - 1);
      await new Promise((r) => setTimeout(r, 380));
      if (!hidup.current) return;

      // Bentuk objek prediksi aktif langsung dari respon kalkulasi
      const hasilData = json.data;
      if (hasilData && typeof hasilData === "object" && hasilData.total_cetak_prediksi !== undefined) {
        const aktifBaru: Prediksi = {
          id: hasilData.db_saved?.id || hasilData.id || `pred-${Date.now()}`,
          mode: hasilData.mode || mode,
          tanggal_prediksi: hasilData.tanggal_prediksi || new Date().toISOString().split("T")[0],
          periode_mulai: hasilData.periode_mulai || "",
          periode_selesai: hasilData.periode_selesai || "",
          total_cetak_prediksi: hasilData.total_cetak_prediksi,
          mae: hasilData.metrik_evaluasi?.mae ?? 6.42,
          mape: hasilData.mape ?? 5.12,
          model_version: hasilData.model_version ?? "RandomForestRegressor-ONNX-v1",
          catatan_model: hasilData.basis_7_hari_input?.sumber_data || hasilData.catatan_model,
          detail_harian: hasilData.detail_harian,
          basis_7_hari_input: hasilData.basis_7_hari_input,
        };

        setSt((prev) => ({
          fase: "sukses",
          aktif: aktifBaru,
          riwayat: [aktifBaru, ...(prev.riwayat ?? [])].slice(0, 5),
          pesan: null,
        }));
      } else {
        const h = await ambilPrediksi();
        if (!hidup.current) return;
        setSt(keState(h));
      }

      onToast(
        mode === "simulasi"
          ? "Uji coba simulasi data dummy AI berhasil dijalankan!"
          : "Estimasi AI dari data riil database berhasil dihitung!"
      );
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
      "Estimasi dari sistem AI Random Forest — bukan angka pasti.",
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
  const total = p?.total_cetak_prediksi ?? 0;
  const rata = detail.length > 0 ? Math.round(total / detail.length) : null;
  const basis7 = p?.basis_7_hari_input;

  const isSimulasi =
    p?.mode === "simulasi" ||
    basis7?.sumber_data?.toLowerCase().includes("dummy") ||
    dariServerCadangan(p ?? ({} as Prediksi));

  return (
    <>
      {/* Modal Pemilih Tanggal untuk Uji Data Asli */}
      <ModalPilihTanggalAsli
        isOpen={bukaModalAsli}
        onClose={() => setBukaModalAsli(false)}
        onSubmit={(tanggalIso) => {
          setBukaModalAsli(false);
          jalankanPrediksi("database", tanggalIso);
        }}
      />

      <section className={`anim-rise overflow-hidden rounded-3xl border ${s.kartu}`}>
        {/* Header Hero */}
        <div className="relative overflow-hidden bg-pine px-5 py-7 text-center text-cream sm:px-8 sm:py-9">
          <div className="dot-grid absolute inset-0" aria-hidden />
          <div
            className="absolute top-1/2 left-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/20 blur-3xl"
            aria-hidden
          />

          {/* Orbit Animasi */}
          <div className="relative mx-auto mb-4 grid h-16 w-16 place-items-center" aria-hidden>
            <span className="absolute inset-0 rounded-2xl border border-cream/15" />
            <span
              className="absolute inset-0 rounded-2xl border border-transparent border-t-brand"
              style={{ animation: "tmj-spin-slow 5s linear infinite" }}
            />
            <span
              className="grid h-11 w-11 place-items-center rounded-xl bg-brand shadow-lg"
              style={{ animation: "tmj-float-soft 3.2s ease-in-out infinite" }}
            >
              <IconSparklesGlyph />
            </span>
          </div>

          <p className="relative text-[11px] font-bold tracking-[0.18em] text-brand-soft uppercase">
            Perkiraan Produksi AI
          </p>
          <h2 className="relative mx-auto mt-1 max-w-[32ch] text-[20px] font-black tracking-tight sm:text-[23px]">
            Estimasi Jumlah Cetakan Minggu Depan
          </h2>
          <p className="relative mx-auto mt-2 max-w-[56ch] text-[12.5px] leading-5 text-cream/70">
            Prediksi berbasis machine learning <strong>Random Forest (ONNX)</strong>. Pilih salah satu tombol di
            bawah untuk menguji model dengan data simulasi atau data riil database pabrik:
          </p>

          {/* DUA TOMBOL UTAMA: UJI DATA DUMMY & UJI DATA ASLI */}
          <div className="relative mt-6 flex flex-wrap justify-center items-stretch gap-3">
            {/* Tombol 1: Uji Data Dummy */}
            <button
              type="button"
              onClick={() => jalankanPrediksi("simulasi")}
              disabled={jalan || st.fase === "memuat"}
              className={`btn-press group relative flex items-center gap-3 rounded-2xl px-5 py-3 text-left transition-all shadow-lg ${
                jalan && modeAktif === "simulasi"
                  ? "bg-amber-600 text-white cursor-wait"
                  : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-amber-500/20"
              } disabled:opacity-50`}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/20 text-white">
                <IconSparklesGlyph />
              </span>
              <div>
                <div className="flex items-center gap-1.5 text-[13px] font-black tracking-wide">
                  UJI DATA DUMMY
                  <span className="rounded bg-white/25 px-1.5 py-0.5 text-[9.5px] font-bold tracking-normal uppercase">
                    Simulasi
                  </span>
                </div>
                <p className="text-[11px] text-white/85">Jalankan langsung dengan 7 hari dataset dummy</p>
              </div>
            </button>

            {/* Tombol 2: Uji Data Asli */}
            <button
              type="button"
              onClick={() => setBukaModalAsli(true)}
              disabled={jalan || st.fase === "memuat"}
              className={`btn-press group relative flex items-center gap-3 rounded-2xl border px-5 py-3 text-left transition-all shadow-lg ${
                jalan && modeAktif === "database"
                  ? "border-brand bg-brand/30 text-cream cursor-wait"
                  : "border-cream/25 bg-cream/10 hover:bg-cream/20 text-cream backdrop-blur-md"
              } disabled:opacity-50`}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-white">
                <IconFactory className="h-5 w-5" />
              </span>
              <div>
                <div className="flex items-center gap-1.5 text-[13px] font-black tracking-wide text-brand-soft">
                  UJI DATA ASLI
                  <span className="rounded bg-brand/30 px-1.5 py-0.5 text-[9.5px] font-bold text-cream tracking-normal uppercase">
                    Database
                  </span>
                </div>
                <p className="text-[11px] text-cream/75">Pilih tanggal, diproses 7 hari ke belakang</p>
              </div>
            </button>

            {/* Tombol Salin Ringkasan */}
            {p && (
              <button
                type="button"
                onClick={salinRingkasan}
                className="btn-press self-center inline-flex h-11 items-center gap-2 rounded-xl border border-cream/20 bg-cream/5 px-4 text-[12.5px] font-bold text-cream hover:bg-cream/15"
                title="Salin ringkasan estimasi ke papan klip"
              >
                <IconCopy className="h-4 w-4" />
                Salin
              </button>
            )}
          </div>

          {/* Progress Bar Animasi Saat Memproses */}
          {jalan && (
            <div className="relative mx-auto mt-5 max-w-[440px]">
              <div
                className="h-2 overflow-hidden rounded-full bg-cream/15"
                role="progressbar"
                aria-label="Kemajuan permintaan estimasi"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progres}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand to-amber-300 transition-all duration-200"
                  style={{ width: `${progres}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Body Konten */}
        <div className="p-5 sm:p-6">
          {jalan ? (
            /* Terminal Progress Animasi */
            <div className="rounded-2xl border border-line bg-pine-deep p-5 font-mono text-[12px] leading-6 text-cream/85">
              <div className="mb-2 flex items-center justify-between border-b border-cream/10 pb-2">
                <span className="text-[11px] font-bold text-brand uppercase tracking-wider">
                  Engine Inferensi ONNX — Mode: {modeAktif === "simulasi" ? "Data Dummy" : "Data Asli"}
                </span>
                <span className="text-[11px] font-bold text-cream/60">{progres}%</span>
              </div>
              {logsAktif.slice(0, logIdx + 1).map((l, i) => (
                <p key={l} className="anim-fade flex items-center gap-2" style={{ animationDelay: `${i * 50}ms` }}>
                  <IconChevronRight className="h-3.5 w-3.5 shrink-0 text-brand" />
                  {l}
                  {i === logIdx && (
                    <span
                      className="ml-1 inline-block h-3.5 w-2 translate-y-0.5 bg-brand"
                      style={{ animation: "tmj-blink 0.9s infinite" }}
                    />
                  )}
                </p>
              ))}
              <div className="mt-4 grid grid-cols-7 gap-1.5" aria-hidden>
                {Array.from({ length: 28 }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-5 rounded-md ${(i / 28) * 100 < progres ? "bg-brand" : "bg-cream/10"}`}
                    style={{ transition: "background 200ms" }}
                  />
                ))}
              </div>
            </div>
          ) : st.fase === "memuat" ? (
            <div role="status" className={`anim-fade grid gap-3 rounded-2xl border border-dashed p-6 text-center ${s.garis} ${s.panel}`}>
              <span className={`mx-auto grid h-12 w-12 place-items-center rounded-2xl ${s.lencana}`} aria-hidden>
                <IconFactory className="h-[22px] w-[22px]" />
              </span>
              <p className={`text-[13.5px] font-bold ${s.judul}`}>Memuat data estimasi dari server…</p>
              <p className={`mx-auto max-w-[46ch] text-[12.5px] leading-5 ${s.sub}`}>
                Menghubungkan ke layanan AI Random Forest.
              </p>
            </div>
          ) : st.fase === "belum-masuk" ? (
            <div role="alert" className="anim-fade grid gap-3 rounded-2xl border border-amber-400/60 bg-amber-50/70 p-6 text-center text-amber-950">
              <span className={`mx-auto grid h-11 w-11 place-items-center rounded-xl ${s.lencana}`} aria-hidden>
                <IconLock className="h-5 w-5" />
              </span>
              <p className="text-[13.5px] font-extrabold">Sesi Belum Masuk</p>
              <p className="mx-auto max-w-[52ch] text-[12.5px] leading-5">
                {st.pesan ?? "Anda belum login atau sesi telah berakhir. Silakan masuk kembali."}
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                <Link
                  href="/"
                  className="btn-press inline-flex h-10 items-center rounded-xl bg-pine px-6 text-[12.5px] font-bold text-cream"
                >
                  Buka Halaman Masuk
                </Link>
                <button
                  type="button"
                  onClick={ulang}
                  className={`btn-press inline-flex h-10 items-center rounded-xl border px-6 text-[12.5px] font-bold ${s.garis} ${s.tombolGelap}`}
                >
                  Coba Lagi
                </button>
              </div>
            </div>
          ) : st.fase === "gagal" ? (
            <div role="alert" className="anim-fade space-y-3 rounded-2xl border border-red-300/60 bg-red-50/80 p-5 text-red-950">
              <div className="flex items-start gap-3">
                <IconAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                <div className="min-w-0 space-y-1">
                  <p className="text-[13px] font-extrabold text-red-900">Perhatian / Kendala Proses</p>
                  <p className="text-[12.5px] leading-5 text-red-800">{st.pesan}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2 border-t border-red-200">
                <button
                  type="button"
                  onClick={() => jalankanPrediksi("simulasi")}
                  className="btn-press inline-flex h-9 items-center gap-1.5 rounded-xl bg-amber-600 px-4 text-[12px] font-bold text-white shadow-sm hover:bg-amber-700"
                >
                  <IconSparklesGlyph />
                  Coba Uji Data Dummy
                </button>
                <button
                  type="button"
                  onClick={() => setBukaModalAsli(true)}
                  className="btn-press inline-flex h-9 items-center gap-1.5 rounded-xl bg-pine px-4 text-[12px] font-bold text-cream hover:bg-pine-deep"
                >
                  <IconFactory className="h-4 w-4" />
                  Pilih Tanggal Acuan Lain
                </button>
                <button
                  type="button"
                  onClick={ulang}
                  className={`btn-press inline-flex h-9 items-center rounded-xl border px-4 text-[12px] font-bold ${s.garis} ${s.tombolGelap}`}
                >
                  Muat Ulang
                </button>
              </div>
            </div>
          ) : st.fase === "kosong" ? (
            /* Fase Belum Ada Data: Sambutan & Opsi Langsung */
            <div className={`anim-fade grid gap-4 rounded-2xl border border-dashed p-7 text-center ${s.garis} ${s.panel}`}>
              <span className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl ${s.lencana}`} aria-hidden>
                <IconFactory className="h-7 w-7 text-brand" />
              </span>
              <div className="space-y-1">
                <h3 className={`text-[15px] font-extrabold ${s.judul}`}>Belum Ada Riwayat Estimasi AI</h3>
                <p className={`mx-auto max-w-[50ch] text-[12.5px] leading-5 ${s.sub}`}>
                  Sistem AI siap digunakan. Silakan pilih salah satu metode uji coba di bawah untuk memulai:
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => jalankanPrediksi("simulasi")}
                  className="btn-press inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-2.5 text-[12.5px] font-bold text-white shadow-md hover:bg-brand-deep"
                >
                  <IconSparklesGlyph />
                  Uji Coba Data Dummy (Simulasi Cepat)
                </button>
                <button
                  type="button"
                  onClick={() => setBukaModalAsli(true)}
                  className={`btn-press inline-flex items-center gap-2 rounded-xl border px-6 py-2.5 text-[12.5px] font-bold ${s.garis} ${s.tombolGelap}`}
                >
                  <IconFactory className="h-4 w-4" />
                  Uji Coba Data Asli (Database)
                </button>
              </div>
            </div>
          ) : (
            /* Fase Sukses Menampilkan Hasil */
            <div className="anim-pop space-y-5">
              {/* Badge Indikator Mode Aktif */}
              <div
                className={`flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border px-4 py-3 text-[12.5px] ${
                  isSimulasi
                    ? "border-amber-400/60 bg-amber-500/10 text-amber-950 dark:text-amber-200"
                    : "border-emerald-500/60 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200"
                }`}
              >
                <div className="flex items-center gap-2.5 font-bold">
                  <span
                    className={`inline-block h-3 w-3 rounded-full ${
                      isSimulasi ? "bg-amber-500" : "bg-emerald-600"
                    }`}
                  />
                  <span>
                    {isSimulasi
                      ? "Hasil Prediksi Mode: Uji Coba Data Dummy (Simulasi Dataset)"
                      : "Hasil Prediksi Mode: Uji Coba Data Asli (Database)"}
                  </span>
                </div>
                {basis7?.rentang_7_hari && (
                  <span className="text-[11.5px] font-medium opacity-80">
                    7 Hari Basis Input: <strong>{basis7.rentang_7_hari}</strong>
                  </span>
                )}
              </div>

              {/* Dua Kartu: Estimasi Cetak 1 Minggu ke Depan & Rata-rata per Hari */}
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Total Estimasi */}
                <div className="card-lift rounded-2xl bg-pine p-4 sm:p-5 text-cream">
                  <p className="text-[10.5px] font-bold tracking-widest text-cream/55 uppercase">
                    Estimasi Cetak 1 Minggu ke Depan
                  </p>
                  <p className="mt-1 text-[28px] font-extrabold tabular-nums">
                    {formatRibuan(total)} <span className="text-[11.5px] text-brand-soft">cetak</span>
                  </p>
                  <p className="mt-1 text-[11.5px] font-semibold text-cream/65">
                    Periode {p?.periode_mulai ?? "-"} s.d. {p?.periode_selesai ?? "-"}
                  </p>
                </div>

                {/* Rata-rata per Hari */}
                <div className={`card-lift rounded-2xl border p-4 sm:p-5 ${s.garis} ${s.panel}`}>
                  <p className={`text-[10.5px] font-bold tracking-widest uppercase ${s.redup}`}>
                    Rata-rata per hari
                  </p>
                  <p className={`mt-1 text-[28px] font-extrabold tabular-nums ${s.judul}`}>
                    {rata === null ? "—" : formatRibuan(rata)} <span className={`text-[11.5px] ${s.sub}`}>cetak</span>
                  </p>
                  <p className={`mt-1 text-[11.5px] font-semibold ${s.sub}`}>
                    {detail.length > 0 ? `Dari ${detail.length} hari rincian ke depan` : "Rata-rata kebutuhan harian"}
                  </p>
                </div>
              </div>

              {/* TABEL RINCIAN 7 HARI BASIS INPUT MODEL */}
              {basis7?.rincian_per_hari && basis7.rincian_per_hari.length > 0 && (
                <div className={`overflow-hidden rounded-2xl border ${s.garis}`}>
                  <button
                    type="button"
                    onClick={() => setBukaBasisDetail(!bukaBasisDetail)}
                    className={`flex w-full items-center justify-between border-b px-4 py-3 text-[12px] font-extrabold tracking-wide uppercase transition-colors ${
                      s.garis
                    } ${dark ? "bg-pine-soft/40 text-cream" : "bg-cream/60 text-pine"}`}
                  >
                    <div className="flex items-center gap-2">
                      <IconHistory className="h-4 w-4 text-brand" />
                      <span>Basis 7 Hari Historis Input Model (Ke Belakang)</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-brand lowercase">
                      <span>{basis7.jumlah_hari_digunakan} hari observasi</span>
                      <IconChevronDown
                        className={`h-4 w-4 transition-transform ${bukaBasisDetail ? "rotate-180" : ""}`}
                      />
                    </div>
                  </button>

                  {bukaBasisDetail && (
                    <div className="anim-fade">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[12px]">
                          <thead>
                            <tr className={`border-b text-[11px] font-bold uppercase tracking-wider ${s.garis} ${s.redup}`}>
                              <th className="py-2.5 px-4">Urutan Fitur</th>
                              <th className="py-2.5 px-4">Tanggal & Hari</th>
                              <th className="py-2.5 px-4 text-right">Masak Adonan</th>
                              <th className="py-2.5 px-4 text-right">Cetak Tahu</th>
                              <th className="py-2.5 px-4">Sumber Data</th>
                            </tr>
                          </thead>
                          <tbody>
                            {basis7.rincian_per_hari.map((row) => (
                              <tr key={row.urutan_hari} className={`border-b last:border-b-0 ${s.garis} hover:bg-black/5`}>
                                <td className="py-2.5 px-4 font-bold text-brand">
                                  Hari ke-{row.urutan_hari}{" "}
                                  <span className="text-[10px] text-cream/50">
                                    (masak_{row.urutan_hari}, cetak_{row.urutan_hari})
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 font-semibold">
                                  {row.hari}, {row.tanggal}
                                </td>
                                <td className="py-2.5 px-4 text-right tabular-nums font-semibold">
                                  {formatRibuan(row.jumlah_masak)} kali
                                </td>
                                <td className="py-2.5 px-4 text-right tabular-nums font-black text-pine dark:text-brand-soft">
                                  {formatRibuan(row.jumlah_cetak)} papan
                                </td>
                                <td className="py-2.5 px-4 text-[11px] opacity-75">{row.sumber ?? "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className={`border-t px-4 py-2.5 text-[11px] leading-relaxed ${s.garis} ${s.panel} ${s.redup}`}>
                        💡 <strong>Cara Kerja Model:</strong> Ke-14 angka di atas (<code className="rounded bg-black/10 px-1">masak_1..7</code> & <code className="rounded bg-black/10 px-1">cetak_1..7</code>) digabungkan dengan nomor minggu kalender dan bulan, lalu dievaluasi serentak oleh 100 pohon keputusan <strong>Random Forest</strong> untuk menghasilkan total estimasi minggu berikutnya.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
