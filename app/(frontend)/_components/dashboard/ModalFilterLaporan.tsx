"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { IconCalendar, IconClose, IconCheck } from "./icons";
import { skin } from "./theme";
import type { Mode } from "./data";

export type FilterKustom = {
  mode: Mode;
  startDate: string; // Format: YYYY-MM-DD
  endDate: string;   // Format: YYYY-MM-DD
  label: string;     // Contoh: "17 November 2026", "Minggu 2 (08–14 Nov 2026)", "November 2026"
};

export const DAFTAR_BULAN = [
  { value: 1, label: "Januari" },
  { value: 2, label: "Februari" },
  { value: 3, label: "Maret" },
  { value: 4, label: "April" },
  { value: 5, label: "Mei" },
  { value: 6, label: "Juni" },
  { value: 7, label: "Juli" },
  { value: 8, label: "Agustus" },
  { value: 9, label: "September" },
  { value: 10, label: "Oktober" },
  { value: 11, label: "November" },
  { value: 12, label: "Desember" },
];

export function jumlahHariDalamBulan(tahun: number, bulan: number): number {
  return new Date(tahun, bulan, 0).getDate();
}

function hitungMingguKe(tgl: number): number {
  if (tgl <= 7) return 1;
  if (tgl <= 14) return 2;
  if (tgl <= 21) return 3;
  if (tgl <= 28) return 4;
  return 5;
}

function namaHariIndonesia(tglString: string): string {
  try {
    const d = new Date(`${tglString}T00:00:00`);
    const nama = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    return nama[d.getDay()] || "";
  } catch {
    return "";
  }
}

export function ModalFilterLaporan({
  modeAwal,
  dark,
  filterSaatIni,
  onTutup,
  onTerapkan,
  onReset,
}: {
  modeAwal: Mode;
  dark: boolean;
  filterSaatIni: FilterKustom | null;
  onTutup: () => void;
  onTerapkan: (filter: FilterKustom) => void;
  onReset?: () => void;
}) {
  const s = skin(dark);
  const panelRef = useRef<HTMLDivElement>(null);
  const judulId = useId();

  const [tabAktif, setTabAktif] = useState<Mode>(modeAwal);

  // Inisialisasi tanggal awal (dari filter saat ini atau hari ini)
  const today = useMemo(() => new Date(), []);
  const initialYear = today.getFullYear();
  const initialMonth = today.getMonth() + 1;
  const initialDay = today.getDate();

  // State Harian
  const [tahunHarian, setTahunHarian] = useState<number>(() => {
    if (filterSaatIni?.mode === "harian" && filterSaatIni.startDate) {
      const y = parseInt(filterSaatIni.startDate.slice(0, 4), 10);
      if (!isNaN(y)) return y;
    }
    return initialYear;
  });
  const [bulanHarian, setBulanHarian] = useState<number>(() => {
    if (filterSaatIni?.mode === "harian" && filterSaatIni.startDate) {
      const m = parseInt(filterSaatIni.startDate.slice(5, 7), 10);
      if (!isNaN(m)) return m;
    }
    return initialMonth;
  });
  const [hariHarian, setHariHarian] = useState<number>(() => {
    if (filterSaatIni?.mode === "harian" && filterSaatIni.startDate) {
      const d = parseInt(filterSaatIni.startDate.slice(8, 10), 10);
      if (!isNaN(d)) return d;
    }
    return initialDay;
  });

  // State Mingguan
  const [tahunMingguan, setTahunMingguan] = useState<number>(() => {
    if (filterSaatIni?.mode === "mingguan" && filterSaatIni.startDate) {
      const y = parseInt(filterSaatIni.startDate.slice(0, 4), 10);
      if (!isNaN(y)) return y;
    }
    return initialYear;
  });
  const [bulanMingguan, setBulanMingguan] = useState<number>(() => {
    if (filterSaatIni?.mode === "mingguan" && filterSaatIni.startDate) {
      const m = parseInt(filterSaatIni.startDate.slice(5, 7), 10);
      if (!isNaN(m)) return m;
    }
    return initialMonth;
  });
  const [mingguKe, setMingguKe] = useState<number>(() => {
    if (filterSaatIni?.mode === "mingguan" && filterSaatIni.startDate) {
      const d = parseInt(filterSaatIni.startDate.slice(8, 10), 10);
      if (!isNaN(d)) return hitungMingguKe(d);
    }
    return hitungMingguKe(initialDay);
  });

  // State Bulanan
  const [tahunBulanan, setTahunBulanan] = useState<number>(() => {
    if (filterSaatIni?.mode === "bulanan" && filterSaatIni.startDate) {
      const y = parseInt(filterSaatIni.startDate.slice(0, 4), 10);
      if (!isNaN(y)) return y;
    }
    return initialYear;
  });
  const [bulanBulanan, setBulanBulanan] = useState<number>(() => {
    if (filterSaatIni?.mode === "bulanan" && filterSaatIni.startDate) {
      const m = parseInt(filterSaatIni.startDate.slice(5, 7), 10);
      if (!isNaN(m)) return m;
    }
    return initialMonth;
  });

  // Hitung max hari dan pastikan hari/minggu tidak melampaui batas bulan
  const maxHariHarian = jumlahHariDalamBulan(tahunHarian, bulanHarian);
  const hariHarianEfektif = Math.min(hariHarian, maxHariHarian);

  const maxHariMingguan = jumlahHariDalamBulan(tahunMingguan, bulanMingguan);
  const mingguKeEfektif = maxHariMingguan <= 28 && mingguKe > 4 ? 4 : mingguKe;

  // Max hari untuk bulanan
  const maxHariBulanan = jumlahHariDalamBulan(tahunBulanan, bulanBulanan);

  // Daftar tahun untuk opsi dropdown
  const daftarTahun = useMemo(() => {
    const list: number[] = [];
    for (let y = initialYear - 2; y <= initialYear + 2; y++) {
      list.push(y);
    }
    return list;
  }, [initialYear]);

  // Tangkap keyboard ESC
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onTutup();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onTutup]);

  // Sinkronisasi input date native
  const harianIsoStr = `${tahunHarian}-${String(bulanHarian).padStart(2, "0")}-${String(hariHarianEfektif).padStart(2, "0")}`;
  const namaHariHarian = namaHariIndonesia(harianIsoStr);

  // Kalkulasi rentang mingguan
  const rentangMingguan = useMemo(() => {
    let tglAwal = 1;
    let tglAkhir = 7;
    if (mingguKeEfektif === 1) {
      tglAwal = 1;
      tglAkhir = Math.min(7, maxHariMingguan);
    } else if (mingguKeEfektif === 2) {
      tglAwal = 8;
      tglAkhir = Math.min(14, maxHariMingguan);
    } else if (mingguKeEfektif === 3) {
      tglAwal = 15;
      tglAkhir = Math.min(21, maxHariMingguan);
    } else if (mingguKeEfektif === 4) {
      tglAwal = 22;
      tglAkhir = Math.min(28, maxHariMingguan);
    } else {
      tglAwal = 29;
      tglAkhir = maxHariMingguan;
    }
    const strAwal = `${tahunMingguan}-${String(bulanMingguan).padStart(2, "0")}-${String(tglAwal).padStart(2, "0")}`;
    const strAkhir = `${tahunMingguan}-${String(bulanMingguan).padStart(2, "0")}-${String(tglAkhir).padStart(2, "0")}`;
    const namaBln = DAFTAR_BULAN[bulanMingguan - 1]?.label ?? "";
    return {
      tglAwal,
      tglAkhir,
      strAwal,
      strAkhir,
      namaBln,
      label: `Minggu ${mingguKeEfektif} (${tglAwal}–${tglAkhir} ${namaBln} ${tahunMingguan})`,
    };
  }, [mingguKeEfektif, bulanMingguan, tahunMingguan, maxHariMingguan]);

  // Label bulanan
  const namaBulanBulanan = DAFTAR_BULAN[bulanBulanan - 1]?.label ?? "";
  const rentangBulanan = useMemo(() => {
    const strAwal = `${tahunBulanan}-${String(bulanBulanan).padStart(2, "0")}-01`;
    const strAkhir = `${tahunBulanan}-${String(bulanBulanan).padStart(2, "0")}-${String(maxHariBulanan).padStart(2, "0")}`;
    return {
      strAwal,
      strAkhir,
      label: `Bulan ${namaBulanBulanan} ${tahunBulanan}`,
    };
  }, [tahunBulanan, bulanBulanan, maxHariBulanan, namaBulanBulanan]);

  function handleTerapkan() {
    if (tabAktif === "harian") {
      const namaBln = DAFTAR_BULAN[bulanHarian - 1]?.label ?? "";
      const label = `${namaHariHarian ? `${namaHariHarian}, ` : ""}${hariHarianEfektif} ${namaBln} ${tahunHarian}`;
      onTerapkan({
        mode: "harian",
        startDate: harianIsoStr,
        endDate: harianIsoStr,
        label,
      });
    } else if (tabAktif === "mingguan") {
      onTerapkan({
        mode: "mingguan",
        startDate: rentangMingguan.strAwal,
        endDate: rentangMingguan.strAkhir,
        label: rentangMingguan.label,
      });
    } else if (tabAktif === "bulanan") {
      onTerapkan({
        mode: "bulanan",
        startDate: rentangBulanan.strAwal,
        endDate: rentangBulanan.strAkhir,
        label: rentangBulanan.label,
      });
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 grid place-items-center p-4 backdrop-blur-sm ${
        dark ? "bg-black/35" : "bg-black/20"
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={judulId}
      onClick={onTutup}
    >
      <div
        ref={panelRef}
        className={`anim-modal w-full max-w-[540px] flex flex-col overflow-hidden rounded-3xl shadow-2xl ${
          dark
            ? "border border-cream/20 bg-pine-deep/85 backdrop-blur-2xl text-cream"
            : "border border-line-strong/60 bg-cream/90 backdrop-blur-2xl text-pine"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div
          className={`flex items-center justify-between px-6 py-4.5 text-cream shrink-0 ${
            dark ? "bg-pine-deep/80 backdrop-blur-md" : "bg-pine/90 backdrop-blur-md"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-cream/10 text-brand">
              <IconCalendar className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] font-bold tracking-widest text-cream/70 uppercase">Filter Periode Laporan</p>
              <h3 id={judulId} className="text-[17px] font-extrabold tracking-tight">
                {tabAktif === "harian"
                  ? "Pilih Tanggal Laporan"
                  : tabAktif === "mingguan"
                  ? "Pilih Minggu Laporan"
                  : "Pilih Bulan Laporan"}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onTutup}
            aria-label="Tutup modal"
            className="btn-press grid h-9 w-9 place-items-center rounded-xl bg-cream/10 text-lg hover:bg-cream/20 transition cursor-pointer"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        {/* Tab switcher untuk berganti mode di dalam modal */}
        <div className={`border-b px-6 pt-4 pb-3 ${s.garis} ${dark ? "bg-pine-deep/40 backdrop-blur-md" : "bg-cream-dark/30 backdrop-blur-md"}`}>
          <div className="grid grid-cols-3 gap-1 rounded-xl p-1 bg-black/10 dark:bg-white/5">
            <button
              type="button"
              onClick={() => setTabAktif("harian")}
              className={`rounded-lg py-2 text-[12px] font-bold transition cursor-pointer ${
                tabAktif === "harian"
                  ? dark
                    ? "bg-brand text-pine-deep shadow"
                    : "bg-pine text-cream shadow"
                  : dark
                  ? "text-cream/60 hover:text-cream"
                  : "text-pine/70 hover:text-pine"
              }`}
            >
              📅 Harian
            </button>
            <button
              type="button"
              onClick={() => setTabAktif("mingguan")}
              className={`rounded-lg py-2 text-[12px] font-bold transition cursor-pointer ${
                tabAktif === "mingguan"
                  ? dark
                    ? "bg-brand text-pine-deep shadow"
                    : "bg-pine text-cream shadow"
                  : dark
                  ? "text-cream/60 hover:text-cream"
                  : "text-pine/70 hover:text-pine"
              }`}
            >
              📊 Mingguan
            </button>
            <button
              type="button"
              onClick={() => setTabAktif("bulanan")}
              className={`rounded-lg py-2 text-[12px] font-bold transition cursor-pointer ${
                tabAktif === "bulanan"
                  ? dark
                    ? "bg-brand text-pine-deep shadow"
                    : "bg-pine text-cream shadow"
                  : dark
                  ? "text-cream/60 hover:text-cream"
                  : "text-pine/70 hover:text-pine"
              }`}
            >
              🗓️ Bulanan
            </button>
          </div>
        </div>

        {/* Body Form Filter */}
        <div className="p-6 space-y-5">
          {tabAktif === "harian" && (
            <div className="space-y-4">
              <p className={`text-[12.5px] font-medium leading-relaxed ${s.sub}`}>
                Pilih tanggal, bulan, dan tahun tertentu untuk melihat laporan produksi harian:
              </p>

              <div className="grid grid-cols-3 gap-3">
                {/* Tanggal */}
                <div>
                  <label className={`block mb-1.5 text-[11px] font-bold tracking-wide uppercase ${s.label}`}>
                    Tanggal
                  </label>
                  <select
                    value={hariHarianEfektif}
                    onChange={(e) => setHariHarian(Number(e.target.value))}
                    className={`h-11 w-full rounded-xl border px-3 text-[13px] font-semibold transition focus:border-brand focus:outline-none ${s.input}`}
                  >
                    {Array.from({ length: maxHariHarian }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d} className={dark ? "bg-pine-deep text-cream" : "bg-white text-pine"}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Bulan */}
                <div>
                  <label className={`block mb-1.5 text-[11px] font-bold tracking-wide uppercase ${s.label}`}>
                    Bulan
                  </label>
                  <select
                    value={bulanHarian}
                    onChange={(e) => setBulanHarian(Number(e.target.value))}
                    className={`h-11 w-full rounded-xl border px-3 text-[13px] font-semibold transition focus:border-brand focus:outline-none ${s.input}`}
                  >
                    {DAFTAR_BULAN.map((b) => (
                      <option key={b.value} value={b.value} className={dark ? "bg-pine-deep text-cream" : "bg-white text-pine"}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tahun */}
                <div>
                  <label className={`block mb-1.5 text-[11px] font-bold tracking-wide uppercase ${s.label}`}>
                    Tahun
                  </label>
                  <select
                    value={tahunHarian}
                    onChange={(e) => setTahunHarian(Number(e.target.value))}
                    className={`h-11 w-full rounded-xl border px-3 text-[13px] font-semibold transition focus:border-brand focus:outline-none ${s.input}`}
                  >
                    {daftarTahun.map((y) => (
                      <option key={y} value={y} className={dark ? "bg-pine-deep text-cream" : "bg-white text-pine"}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Input Kalender Singkat */}
              <div>
                <label className={`block mb-1 text-[11px] font-medium ${s.redup}`}>
                  Atau gunakan pemilih tanggal kalender:
                </label>
                <input
                  type="date"
                  value={harianIsoStr}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val && val.length === 10) {
                      const [y, m, d] = val.split("-").map(Number);
                      if (y && m && d) {
                        setTahunHarian(y);
                        setBulanHarian(m);
                        setHariHarian(d);
                      }
                    }
                  }}
                  className={`h-10 w-full rounded-xl border px-3 text-[13px] font-medium transition focus:border-brand focus:outline-none ${s.input}`}
                />
              </div>

              {/* Kotak Pratinjau */}
              <div className={`rounded-2xl border p-3.5 ${dark ? "border-brand/30 bg-brand/10" : "border-amber-200 bg-amber-50/80"}`}>
                <p className={`text-[12px] font-bold ${dark ? "text-brand" : "text-amber-900"}`}>
                  📌 Target Laporan:
                </p>
                <p className={`mt-0.5 text-[13.5px] font-extrabold ${dark ? "text-cream" : "text-pine"}`}>
                  {namaHariHarian ? `${namaHariHarian}, ` : ""}{hariHarianEfektif} {DAFTAR_BULAN[bulanHarian - 1]?.label} {tahunHarian}
                </p>
              </div>
            </div>
          )}

          {tabAktif === "mingguan" && (
            <div className="space-y-4">
              <p className={`text-[12.5px] font-medium leading-relaxed ${s.sub}`}>
                Pilih minggu ke-1 s/d 4 (atau 5), bulan, dan tahun untuk memfilter laporan mingguan:
              </p>

              <div className="space-y-3">
                {/* Minggu Ke */}
                <div>
                  <label className={`block mb-1.5 text-[11px] font-bold tracking-wide uppercase ${s.label}`}>
                    Pilih Minggu Ke-
                  </label>
                  <select
                    value={mingguKeEfektif}
                    onChange={(e) => setMingguKe(Number(e.target.value))}
                    className={`h-11 w-full rounded-xl border px-3 text-[13px] font-semibold transition focus:border-brand focus:outline-none ${s.input}`}
                  >
                    <option value={1} className={dark ? "bg-pine-deep text-cream" : "bg-white text-pine"}>
                      Minggu 1 (Tanggal 01 – 07)
                    </option>
                    <option value={2} className={dark ? "bg-pine-deep text-cream" : "bg-white text-pine"}>
                      Minggu 2 (Tanggal 08 – 14)
                    </option>
                    <option value={3} className={dark ? "bg-pine-deep text-cream" : "bg-white text-pine"}>
                      Minggu 3 (Tanggal 15 – 21)
                    </option>
                    <option value={4} className={dark ? "bg-pine-deep text-cream" : "bg-white text-pine"}>
                      Minggu 4 (Tanggal 22 – 28)
                    </option>
                    {maxHariMingguan > 28 && (
                      <option value={5} className={dark ? "bg-pine-deep text-cream" : "bg-white text-pine"}>
                        Minggu 5 (Tanggal 29 – {maxHariMingguan})
                      </option>
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Bulan */}
                  <div>
                    <label className={`block mb-1.5 text-[11px] font-bold tracking-wide uppercase ${s.label}`}>
                      Bulan
                    </label>
                    <select
                      value={bulanMingguan}
                      onChange={(e) => setBulanMingguan(Number(e.target.value))}
                      className={`h-11 w-full rounded-xl border px-3 text-[13px] font-semibold transition focus:border-brand focus:outline-none ${s.input}`}
                    >
                      {DAFTAR_BULAN.map((b) => (
                        <option key={b.value} value={b.value} className={dark ? "bg-pine-deep text-cream" : "bg-white text-pine"}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tahun */}
                  <div>
                    <label className={`block mb-1.5 text-[11px] font-bold tracking-wide uppercase ${s.label}`}>
                      Tahun
                    </label>
                    <select
                      value={tahunMingguan}
                      onChange={(e) => setTahunMingguan(Number(e.target.value))}
                      className={`h-11 w-full rounded-xl border px-3 text-[13px] font-semibold transition focus:border-brand focus:outline-none ${s.input}`}
                    >
                      {daftarTahun.map((y) => (
                        <option key={y} value={y} className={dark ? "bg-pine-deep text-cream" : "bg-white text-pine"}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Kotak Pratinjau */}
              <div className={`rounded-2xl border p-3.5 ${dark ? "border-brand/30 bg-brand/10" : "border-amber-200 bg-amber-50/80"}`}>
                <p className={`text-[12px] font-bold ${dark ? "text-brand" : "text-amber-900"}`}>
                  📌 Target Rentang Mingguan:
                </p>
                <p className={`mt-0.5 text-[13.5px] font-extrabold ${dark ? "text-cream" : "text-pine"}`}>
                  {rentangMingguan.label}
                </p>
                <p className={`text-[11.5px] font-medium mt-0.5 ${s.sub}`}>
                  Rentang tanggal: {rentangMingguan.strAwal} s/d {rentangMingguan.strAkhir}
                </p>
              </div>
            </div>
          )}

          {tabAktif === "bulanan" && (
            <div className="space-y-4">
              <p className={`text-[12.5px] font-medium leading-relaxed ${s.sub}`}>
                Pilih bulan dan tahun untuk melihat seluruh laporan produksi pada bulan tersebut:
              </p>

              <div className="grid grid-cols-2 gap-3">
                {/* Bulan */}
                <div>
                  <label className={`block mb-1.5 text-[11px] font-bold tracking-wide uppercase ${s.label}`}>
                    Bulan
                  </label>
                  <select
                    value={bulanBulanan}
                    onChange={(e) => setBulanBulanan(Number(e.target.value))}
                    className={`h-11 w-full rounded-xl border px-3 text-[13px] font-semibold transition focus:border-brand focus:outline-none ${s.input}`}
                  >
                    {DAFTAR_BULAN.map((b) => (
                      <option key={b.value} value={b.value} className={dark ? "bg-pine-deep text-cream" : "bg-white text-pine"}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tahun */}
                <div>
                  <label className={`block mb-1.5 text-[11px] font-bold tracking-wide uppercase ${s.label}`}>
                    Tahun
                  </label>
                  <select
                    value={tahunBulanan}
                    onChange={(e) => setTahunBulanan(Number(e.target.value))}
                    className={`h-11 w-full rounded-xl border px-3 text-[13px] font-semibold transition focus:border-brand focus:outline-none ${s.input}`}
                  >
                    {daftarTahun.map((y) => (
                      <option key={y} value={y} className={dark ? "bg-pine-deep text-cream" : "bg-white text-pine"}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Kotak Pratinjau */}
              <div className={`rounded-2xl border p-3.5 ${dark ? "border-brand/30 bg-brand/10" : "border-amber-200 bg-amber-50/80"}`}>
                <p className={`text-[12px] font-bold ${dark ? "text-brand" : "text-amber-900"}`}>
                  📌 Target Rentang Bulanan:
                </p>
                <p className={`mt-0.5 text-[13.5px] font-extrabold ${dark ? "text-cream" : "text-pine"}`}>
                  Bulan {namaBulanBulanan} {tahunBulanan}
                </p>
                <p className={`text-[11.5px] font-medium mt-0.5 ${s.sub}`}>
                  01 {namaBulanBulanan} – {maxHariBulanan} {namaBulanBulanan} {tahunBulanan} ({maxHariBulanan} hari)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Modal Aksi */}
        <div className={`flex flex-wrap items-center justify-between gap-2 border-t px-6 py-4 ${s.garis} ${dark ? "bg-pine-deep/60 backdrop-blur-md" : "bg-cream/50 backdrop-blur-md"}`}>
          {onReset ? (
            <button
              type="button"
              onClick={() => {
                onReset();
                onTutup();
              }}
              className={`btn-press h-10 rounded-xl border px-4 text-[12.5px] font-bold ${s.garisKuat} ${s.chip} ${s.hantu} cursor-pointer`}
            >
              Reset / Tampilkan Semua
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onTutup}
              className={`btn-press h-10 rounded-xl border px-4 text-[12.5px] font-bold ${s.garisKuat} ${s.chip} ${s.hantu} cursor-pointer`}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleTerapkan}
              className={`btn-press inline-flex items-center gap-2 h-10 rounded-xl px-5 text-[12.5px] font-bold text-white shadow-lg cursor-pointer ${
                dark ? "bg-brand hover:bg-brand-deep text-pine-deep" : "bg-pine hover:bg-pine-deep text-cream"
              }`}
            >
              <IconCheck className="h-4 w-4" />
              Terapkan Filter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
