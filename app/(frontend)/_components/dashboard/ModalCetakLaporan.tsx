"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconPrint } from "./icons";
import { skin } from "./theme";
import { formatRibuan, rupiah, type BarisProduksi } from "./data";

export type ModeCetak = "harian" | "mingguan" | "bulanan";

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

const DAFTAR_TAHUN = [2024, 2025, 2026, 2027, 2028];

export interface BarisAgregatLaporan {
  no: number;
  periodeLabel: string;
  subLabel?: string;
  jumlahCetak: number;
  jumlahMasak: number;
  totalHarga: number;
}

export function ModalCetakLaporan({
  dark,
  hargaCetakAktif,
  onTutup,
}: {
  dark: boolean;
  hargaCetakAktif: number;
  onTutup: () => void;
}) {
  const s = skin(dark);
  const panelRef = useRef<HTMLDivElement>(null);

  // Waktu saat ini sebagai nilai default
  const sekarang = new Date();
  const bulanSekarang = sekarang.getMonth() + 1;
  const tahunSekarang = sekarang.getFullYear();

  // Mode cetak: harian / mingguan / bulanan
  const [mode, setMode] = useState<ModeCetak>("harian");

  // State untuk Mode Harian (1 bulan penuh -> 28-31 baris)
  const [harianBulan, setHarianBulan] = useState(bulanSekarang);
  const [harianTahun, setHarianTahun] = useState(tahunSekarang);

  // State untuk Mode Mingguan (rentang bulan di 1 tahun -> agregat per minggu)
  const [mingguanTahun, setMingguanTahun] = useState(tahunSekarang);
  const [mingguanBulanDari, setMingguanBulanDari] = useState(Math.max(1, bulanSekarang - 1));
  const [mingguanBulanSampai, setMingguanBulanSampai] = useState(bulanSekarang);

  // State untuk Mode Bulanan (rentang tahun -> agregat per bulan)
  const [bulananTahunDari, setBulananTahunDari] = useState(tahunSekarang);
  const [bulananTahunSampai, setBulananTahunSampai] = useState(tahunSekarang);

  // State muat data
  const [sedangMuat, setSedangMuat] = useState(false);
  const [rawRows, setRawRows] = useState<BarisProduksi[]>([]);
  const [pesanError, setPesanError] = useState<string | null>(null);

  // Tangani keyboard Escape & Focus Trap
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onTutup();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onTutup]);

  // Hitung rentang tanggal (start_date & end_date) sesuai konfigurasi aktif
  const rentangTanggal = useMemo(() => {
    if (mode === "harian") {
      const jumlahHari = new Date(harianTahun, harianBulan, 0).getDate();
      const mStr = String(harianBulan).padStart(2, "0");
      return {
        startDate: `${harianTahun}-${mStr}-01`,
        endDate: `${harianTahun}-${mStr}-${String(jumlahHari).padStart(2, "0")}`,
        labelJudul: `Bulan ${NAMA_BULAN[harianBulan - 1]} ${harianTahun}`,
        tipeLaporan: "Laporan Produksi Harian",
      };
    }

    if (mode === "mingguan") {
      const bDari = Math.min(mingguanBulanDari, mingguanBulanSampai);
      const bSampai = Math.max(mingguanBulanDari, mingguanBulanSampai);
      const maxHariSampai = new Date(mingguanTahun, bSampai, 0).getDate();

      return {
        startDate: `${mingguanTahun}-${String(bDari).padStart(2, "0")}-01`,
        endDate: `${mingguanTahun}-${String(bSampai).padStart(2, "0")}-${String(maxHariSampai).padStart(2, "0")}`,
        labelJudul: `Periode ${NAMA_BULAN[bDari - 1]} – ${NAMA_BULAN[bSampai - 1]} ${mingguanTahun}`,
        tipeLaporan: "Laporan Produksi Mingguan",
      };
    }

    // mode bulanan
    const tDari = Math.min(bulananTahunDari, bulananTahunSampai);
    const tSampai = Math.max(bulananTahunDari, bulananTahunSampai);
    return {
      startDate: `${tDari}-01-01`,
      endDate: `${tSampai}-12-31`,
      labelJudul: tDari === tSampai ? `Tahun ${tDari}` : `Tahun ${tDari} – ${tSampai}`,
      tipeLaporan: "Laporan Produksi Bulanan",
    };
  }, [
    mode,
    harianBulan,
    harianTahun,
    mingguanTahun,
    mingguanBulanDari,
    mingguanBulanSampai,
    bulananTahunDari,
    bulananTahunSampai,
  ]);

  // Ambil data dari /api/produksi untuk rentang tanggal tersebut
  useEffect(() => {
    let batal = false;
    (async () => {
      setSedangMuat(true);
      setPesanError(null);
      try {
        const url = `/api/produksi?start_date=${rentangTanggal.startDate}&end_date=${rentangTanggal.endDate}&limit=1000`;
        const res = await fetch(url, { credentials: "include", cache: "no-store" });
        const json = await res.json().catch(() => null);

        if (batal) return;
        if (!res.ok || !json || json.status !== "success") {
          setPesanError(json?.message || `Gagal memuat data (HTTP ${res.status})`);
          setRawRows([]);
          return;
        }

        setRawRows((json.data as BarisProduksi[]) || []);
      } catch {
        if (!batal) {
          setPesanError("Tidak dapat terhubung ke server untuk memuat data laporan.");
          setRawRows([]);
        }
      } finally {
        if (!batal) setSedangMuat(false);
      }
    })();

    return () => {
      batal = true;
    };
  }, [rentangTanggal.startDate, rentangTanggal.endDate]);

  // Agregasikan data sesuai mode: Harian / Mingguan / Bulanan
  const barisAgregat: BarisAgregatLaporan[] = useMemo(() => {
    // 1. Peta agregat per tanggal dari raw data
    const perTanggal = new Map<string, { cetak: number; masak: number; pendapatan: number }>();
    for (const r of rawRows) {
      const tgl = r.tanggal;
      const cur = perTanggal.get(tgl) || { cetak: 0, masak: 0, pendapatan: 0 };
      const cetak = Number(r.jumlah_cetak) || 0;
      const masak = Number(r.jumlah_masak) || 0;
      const pendapatan = Number(r.jumlah_pendapatan) || cetak * (hargaCetakAktif || 0);

      perTanggal.set(tgl, {
        cetak: cur.cetak + cetak,
        masak: cur.masak + masak,
        pendapatan: cur.pendapatan + pendapatan,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // A. MODE HARIAN: Tepat 28-31 baris (1 baris per tanggal bulan itu)
    // ─────────────────────────────────────────────────────────────
    if (mode === "harian") {
      const jumlahHari = new Date(harianTahun, harianBulan, 0).getDate();
      const hasil: BarisAgregatLaporan[] = [];

      for (let d = 1; d <= jumlahHari; d++) {
        const dStr = String(d).padStart(2, "0");
        const mStr = String(harianBulan).padStart(2, "0");
        const tglKey = `${harianTahun}-${mStr}-${dStr}`;
        const dataHari = perTanggal.get(tglKey) || { cetak: 0, masak: 0, pendapatan: 0 };

        const dateObj = new Date(harianTahun, harianBulan - 1, d);
        const namaHari = dateObj.toLocaleDateString("id-ID", { weekday: "long" });

        hasil.push({
          no: d,
          periodeLabel: `${dStr} ${NAMA_BULAN[harianBulan - 1]} ${harianTahun}`,
          subLabel: namaHari,
          jumlahCetak: dataHari.cetak,
          jumlahMasak: dataHari.masak,
          totalHarga: dataHari.pendapatan,
        });
      }
      return hasil;
    }

    // ─────────────────────────────────────────────────────────────
    // B. MODE MINGGUAN: Agregat per minggu untuk rentang bulan terpilih
    // ─────────────────────────────────────────────────────────────
    if (mode === "mingguan") {
      const bDari = Math.min(mingguanBulanDari, mingguanBulanSampai);
      const bSampai = Math.max(mingguanBulanDari, mingguanBulanSampai);
      const hasil: BarisAgregatLaporan[] = [];
      let nomor = 1;

      for (let b = bDari; b <= bSampai; b++) {
        const totalHariBulan = new Date(mingguanTahun, b, 0).getDate();
        const namaB = NAMA_BULAN[b - 1];
        const mStr = String(b).padStart(2, "0");

        // Pembagian per minggu dalam bulan
        const rentangMinggu = [
          { minggu: 1, mulai: 1, selesai: 7 },
          { minggu: 2, mulai: 8, selesai: 14 },
          { minggu: 3, mulai: 15, selesai: 21 },
          { minggu: 4, mulai: 22, selesai: 28 },
        ];
        if (totalHariBulan > 28) {
          rentangMinggu.push({ minggu: 5, mulai: 29, selesai: totalHariBulan });
        }

        for (const rm of rentangMinggu) {
          let sumCetak = 0;
          let sumMasak = 0;
          let sumPendapatan = 0;

          for (let d = rm.mulai; d <= rm.selesai; d++) {
            const dStr = String(d).padStart(2, "0");
            const tglKey = `${mingguanTahun}-${mStr}-${dStr}`;
            const dt = perTanggal.get(tglKey);
            if (dt) {
              sumCetak += dt.cetak;
              sumMasak += dt.masak;
              sumPendapatan += dt.pendapatan;
            }
          }

          hasil.push({
            no: nomor++,
            periodeLabel: `Minggu ${rm.minggu} ${namaB} ${mingguanTahun}`,
            subLabel: `Tgl ${String(rm.mulai).padStart(2, "0")} – ${String(rm.selesai).padStart(2, "0")} ${namaB}`,
            jumlahCetak: sumCetak,
            jumlahMasak: sumMasak,
            totalHarga: sumPendapatan,
          });
        }
      }
      return hasil;
    }

    // ─────────────────────────────────────────────────────────────
    // C. MODE BULANAN: Agregat per bulan untuk rentang tahun terpilih
    // ─────────────────────────────────────────────────────────────
    const tDari = Math.min(bulananTahunDari, bulananTahunSampai);
    const tSampai = Math.max(bulananTahunDari, bulananTahunSampai);
    const hasil: BarisAgregatLaporan[] = [];
    let nomor = 1;

    for (let t = tDari; t <= tSampai; t++) {
      for (let b = 1; b <= 12; b++) {
        const mStr = String(b).padStart(2, "0");
        const prefix = `${t}-${mStr}-`;
        const totalHariBulan = new Date(t, b, 0).getDate();

        let sumCetak = 0;
        let sumMasak = 0;
        let sumPendapatan = 0;

        for (let d = 1; d <= totalHariBulan; d++) {
          const dStr = String(d).padStart(2, "0");
          const tglKey = `${prefix}${dStr}`;
          const dt = perTanggal.get(tglKey);
          if (dt) {
            sumCetak += dt.cetak;
            sumMasak += dt.masak;
            sumPendapatan += dt.pendapatan;
          }
        }

        hasil.push({
          no: nomor++,
          periodeLabel: `${NAMA_BULAN[b - 1]} ${t}`,
          subLabel: `Bulan ke-${b}`,
          jumlahCetak: sumCetak,
          jumlahMasak: sumMasak,
          totalHarga: sumPendapatan,
        });
      }
    }

    return hasil;
  }, [
    mode,
    rawRows,
    hargaCetakAktif,
    harianBulan,
    harianTahun,
    mingguanTahun,
    mingguanBulanDari,
    mingguanBulanSampai,
    bulananTahunDari,
    bulananTahunSampai,
  ]);

  // Total keseluruhan
  const totalCetakSemua = useMemo(() => barisAgregat.reduce((a, b) => a + b.jumlahCetak, 0), [barisAgregat]);
  const totalMasakSemua = useMemo(() => barisAgregat.reduce((a, b) => a + b.jumlahMasak, 0), [barisAgregat]);
  const totalHargaSemua = useMemo(() => barisAgregat.reduce((a, b) => a + b.totalHarga, 0), [barisAgregat]);

  // Eksekusi Cetak Laporan (Print Layout Resmi)
  function handleCetak() {
    const win = window.open("", "_blank");
    if (!win) return;

    const waktuCetak = new Date().toLocaleString("id-ID", {
      dateStyle: "full",
      timeStyle: "short",
    });

    const html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${rentangTanggal.tipeLaporan} — ${rentangTanggal.labelJudul}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 9pt;
      color: #14342b;
      margin: 0;
      padding: 0;
      line-height: 1.35;
    }

    /* KOP SURAT */
    .kop {
      border-bottom: 2.5px solid #14342b;
      padding-bottom: 8px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .kop-brand h1 {
      margin: 0;
      font-size: 16pt;
      font-weight: 900;
      letter-spacing: -0.02em;
      color: #14342b;
      text-transform: uppercase;
    }
    .kop-brand p {
      margin: 2px 0 0 0;
      font-size: 8pt;
      color: #55665e;
    }
    .kop-meta {
      text-align: right;
      font-size: 7.5pt;
      color: #55665e;
    }
    .kop-meta strong {
      color: #14342b;
    }

    /* JUDUL LAPORAN */
    .judul-laporan {
      text-align: center;
      margin: 14px 0 12px 0;
    }
    .judul-laporan h2 {
      margin: 0;
      font-size: 13pt;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #14342b;
    }
    .judul-laporan .sub-judul {
      margin: 3px 0 0 0;
      font-size: 9pt;
      font-weight: 600;
      color: #b45309;
    }

    /* KARTU KPI RINGKASAN */
    .kpi-row {
      display: flex;
      gap: 10px;
      margin-bottom: 14px;
    }
    .kpi-card {
      flex: 1;
      border: 1px solid #d4ded9;
      border-radius: 8px;
      padding: 8px 10px;
      background: #fbf9f4;
    }
    .kpi-card .lbl {
      font-size: 6.5pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #72847c;
      margin-bottom: 2px;
    }
    .kpi-card .val {
      font-size: 11pt;
      font-weight: 800;
      color: #14342b;
    }

    /* TABEL DATA */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 8.5pt;
    }
    th {
      background: #14342b;
      color: #f6f1e7;
      font-weight: 800;
      padding: 6px 8px;
      text-align: left;
      font-size: 7.5pt;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      border: 1px solid #14342b;
    }
    th.text-right {
      text-align: right;
    }
    th.text-center {
      text-align: center;
    }
    td {
      padding: 5px 8px;
      border: 1px solid #d9e2de;
      vertical-align: middle;
    }
    td.text-right {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    td.text-center {
      text-align: center;
    }
    tr:nth-child(even) td {
      background: #fbf9f5;
    }
    .tfoot-row td {
      background: #14342b !important;
      color: #f6f1e7 !important;
      font-weight: 800;
      border: 1px solid #14342b;
      padding: 6px 8px;
    }

    /* TANDA TANGAN */
    .ttd-box {
      margin-top: 24px;
      display: flex;
      justify-content: flex-end;
      page-break-inside: avoid;
    }
    .ttd-kanan {
      text-align: center;
      width: 200px;
    }
    .ttd-kanan .tempat-tgl {
      font-size: 8pt;
      margin-bottom: 4px;
    }
    .ttd-kanan .jabatan {
      font-size: 8pt;
      font-weight: 700;
      margin-bottom: 50px;
    }
    .ttd-kanan .nama {
      font-size: 8.5pt;
      font-weight: 800;
      text-decoration: underline;
    }

    .footer-doc {
      margin-top: 16px;
      border-top: 1px dashed #c0cecb;
      padding-top: 6px;
      font-size: 7pt;
      color: #7b8e86;
      display: flex;
      justify-content: space-between;
    }

    @media print {
      body { margin: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <!-- KOP SURAT -->
  <div class="kop">
    <div class="kop-brand">
      <h1>Pabrik Tahu Maju Jaya</h1>
      <p>Pencatatan &amp; Pengelolaan Hasil Produksi Tahu • Kediri, Jawa Timur</p>
    </div>
    <div class="kop-meta">
      <div>Tanggal Cetak: <strong>${waktuCetak}</strong></div>
      <div>Klasifikasi: <strong>Laporan Resmi</strong></div>
    </div>
  </div>

  <!-- JUDUL -->
  <div class="judul-laporan">
    <h2>${rentangTanggal.tipeLaporan}</h2>
    <div class="sub-judul">${rentangTanggal.labelJudul}</div>
  </div>

  <!-- RINGKASAN KPI -->
  <div class="kpi-row">
    <div class="kpi-card">
      <div class="lbl">Total Periode</div>
      <div class="val">${barisAgregat.length} Baris</div>
    </div>
    <div class="kpi-card">
      <div class="lbl">Total Produksi Cetak</div>
      <div class="val">${formatRibuan(totalCetakSemua)} Papan</div>
    </div>
    <div class="kpi-card">
      <div class="lbl">Total Masak Adonan</div>
      <div class="val">${formatRibuan(totalMasakSemua)} Kali</div>
    </div>
    <div class="kpi-card">
      <div class="lbl">Total Pendapatan</div>
      <div class="val">${rupiah(totalHargaSemua)}</div>
    </div>
  </div>

  <!-- TABEL LAPORAN AGREGAT -->
  <table>
    <thead>
      <tr>
        <th style="width: 6%" class="text-center">No</th>
        <th style="width: 44%">Periode / Waktu</th>
        <th style="width: 16%" class="text-right">Jumlah Cetak</th>
        <th style="width: 14%" class="text-right">Jumlah Masak</th>
        <th style="width: 20%" class="text-right">Total Pendapatan</th>
      </tr>
    </thead>
    <tbody>
      ${barisAgregat
        .map(
          (b) => `
      <tr>
        <td class="text-center">${b.no}</td>
        <td>
          <strong>${b.periodeLabel}</strong>
          ${b.subLabel ? `<br/><span style="font-size:7pt;color:#6b7c8e">${b.subLabel}</span>` : ""}
        </td>
        <td class="text-right">${formatRibuan(b.jumlahCetak)} papan</td>
        <td class="text-right">${b.jumlahMasak} kali</td>
        <td class="text-right"><strong>${rupiah(b.totalHarga)}</strong></td>
      </tr>
      `
        )
        .join("")}
      <tr class="tfoot-row">
        <td colspan="2">TOTAL KESELURUHAN (${barisAgregat.length} BARIS)</td>
        <td class="text-right">${formatRibuan(totalCetakSemua)} papan</td>
        <td class="text-right">${formatRibuan(totalMasakSemua)} kali</td>
        <td class="text-right">${rupiah(totalHargaSemua)}</td>
      </tr>
    </tbody>
  </table>

  <!-- TANDA TANGAN -->
  <div class="ttd-box">
    <div class="ttd-kanan">
      <div class="tempat-tgl">Kediri, ${new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}</div>
      <div class="jabatan">Penanggung Jawab Produksi</div>
      <div class="nama">Pabrik Tahu Maju Jaya</div>
    </div>
  </div>

  <!-- FOOTER DOKUMEN -->
  <div class="footer-doc">
    <div>Dokumen internal Pabrik Tahu Maju Jaya • ${rentangTanggal.tipeLaporan} (${rentangTanggal.labelJudul})</div>
    <div>Halaman 1 dari 1</div>
  </div>

  <script>
    window.print();
    setTimeout(() => window.close(), 600);
  </script>
</body>
</html>
    `;

    win.document.write(html);
    win.document.close();
  }

  return (
    <div
      className={`fixed inset-0 z-50 grid place-items-center p-3 sm:p-4 backdrop-blur-sm ${
        dark ? "bg-black/40" : "bg-black/25"
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="judul-cetak-laporan"
      onClick={onTutup}
    >
      <div
        ref={panelRef}
        className={`anim-modal w-full max-w-[680px] flex flex-col overflow-hidden rounded-3xl shadow-2xl transition-all ${
          dark
            ? "border border-cream/20 bg-pine-deep/90 backdrop-blur-2xl text-cream"
            : "border border-line-strong/60 bg-cream/95 backdrop-blur-2xl text-pine"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER MODAL */}
        <div
          className={`flex items-center justify-between border-b px-6 py-4.5 shrink-0 ${
            dark ? "border-cream/15 bg-pine-deep/80" : "border-line-strong/30 bg-cream/80"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand/20 text-brand">
                <IconPrint className="h-4 w-4" />
              </span>
              <h3 id="judul-cetak-laporan" className="text-[17px] font-extrabold tracking-tight">
                Cetak Laporan Produksi
              </h3>
            </div>
            <p className={`mt-0.5 text-[12px] font-medium ${s.sub}`}>
              Pilih format rekapitulasi: Harian, Mingguan, atau Bulanan.
            </p>
          </div>
          <button
            type="button"
            onClick={onTutup}
            aria-label="Tutup modal"
            className={`grid h-8 w-8 place-items-center rounded-xl border text-sm font-bold transition-colors cursor-pointer ${s.garisKuat} ${s.hantu}`}
          >
            ✕
          </button>
        </div>

        {/* KONTEN UTAMA */}
        <div className="flex flex-col gap-4 overflow-y-auto p-6 max-h-[80vh]">
          {/* TAB PILIHAN MODE */}
          <div className="flex rounded-2xl border p-1 gap-1 text-[13px] font-bold">
            <button
              type="button"
              onClick={() => setMode("harian")}
              className={`flex-1 rounded-xl py-2 transition-all cursor-pointer ${
                mode === "harian"
                  ? dark
                    ? "bg-brand text-pine-deep shadow-sm"
                    : "bg-pine text-cream shadow-sm"
                  : dark
                  ? "text-cream/70 hover:bg-cream/5"
                  : "text-pine/70 hover:bg-black/5"
              }`}
            >
              📅 Harian (1 Bulan)
            </button>
            <button
              type="button"
              onClick={() => setMode("mingguan")}
              className={`flex-1 rounded-xl py-2 transition-all cursor-pointer ${
                mode === "mingguan"
                  ? dark
                    ? "bg-brand text-pine-deep shadow-sm"
                    : "bg-pine text-cream shadow-sm"
                  : dark
                  ? "text-cream/70 hover:bg-cream/5"
                  : "text-pine/70 hover:bg-black/5"
              }`}
            >
              📊 Mingguan
            </button>
            <button
              type="button"
              onClick={() => setMode("bulanan")}
              className={`flex-1 rounded-xl py-2 transition-all cursor-pointer ${
                mode === "bulanan"
                  ? dark
                    ? "bg-brand text-pine-deep shadow-sm"
                    : "bg-pine text-cream shadow-sm"
                  : dark
                  ? "text-cream/70 hover:bg-cream/5"
                  : "text-pine/70 hover:bg-black/5"
              }`}
            >
              🏢 Bulanan
            </button>
          </div>

          {/* FORM FILTER SESUAI MODE */}
          <div
            className={`rounded-2xl border p-4 transition-colors ${
              dark ? "border-cream/10 bg-pine/60" : "border-line bg-white/70"
            }`}
          >
            {mode === "harian" && (
              <div className="space-y-3">
                <p className={`text-[12px] font-semibold ${s.sub}`}>
                  Cetak rekapitulasi harian per tanggal selama 1 bulan penuh (misal: 30 baris untuk November).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${s.label}`}>
                      Bulan
                    </label>
                    <select
                      value={harianBulan}
                      onChange={(e) => setHarianBulan(Number(e.target.value))}
                      className={`h-9 w-full rounded-xl border px-3 text-[12.5px] font-semibold focus:border-brand focus:outline-none ${s.input}`}
                    >
                      {NAMA_BULAN.map((nama, idx) => (
                        <option key={nama} value={idx + 1}>
                          {nama}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${s.label}`}>
                      Tahun
                    </label>
                    <select
                      value={harianTahun}
                      onChange={(e) => setHarianTahun(Number(e.target.value))}
                      className={`h-9 w-full rounded-xl border px-3 text-[12.5px] font-semibold focus:border-brand focus:outline-none ${s.input}`}
                    >
                      {DAFTAR_TAHUN.map((th) => (
                        <option key={th} value={th}>
                          {th}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {mode === "mingguan" && (
              <div className="space-y-3">
                <p className={`text-[12px] font-semibold ${s.sub}`}>
                  Cetak rekapitulasi per minggu (bukan per user) untuk rentang bulan yang dipilih.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${s.label}`}>
                      Tahun
                    </label>
                    <select
                      value={mingguanTahun}
                      onChange={(e) => setMingguanTahun(Number(e.target.value))}
                      className={`h-9 w-full rounded-xl border px-3 text-[12.5px] font-semibold focus:border-brand focus:outline-none ${s.input}`}
                    >
                      {DAFTAR_TAHUN.map((th) => (
                        <option key={th} value={th}>
                          {th}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${s.label}`}>
                      Dari Bulan
                    </label>
                    <select
                      value={mingguanBulanDari}
                      onChange={(e) => setMingguanBulanDari(Number(e.target.value))}
                      className={`h-9 w-full rounded-xl border px-3 text-[12.5px] font-semibold focus:border-brand focus:outline-none ${s.input}`}
                    >
                      {NAMA_BULAN.map((nama, idx) => (
                        <option key={nama} value={idx + 1}>
                          {nama}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${s.label}`}>
                      Sampai Bulan
                    </label>
                    <select
                      value={mingguanBulanSampai}
                      onChange={(e) => setMingguanBulanSampai(Number(e.target.value))}
                      className={`h-9 w-full rounded-xl border px-3 text-[12.5px] font-semibold focus:border-brand focus:outline-none ${s.input}`}
                    >
                      {NAMA_BULAN.map((nama, idx) => (
                        <option key={nama} value={idx + 1}>
                          {nama}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {mode === "bulanan" && (
              <div className="space-y-3">
                <p className={`text-[12px] font-semibold ${s.sub}`}>
                  Cetak rekapitulasi per bulan untuk rentang tahun yang dipilih (12 baris per tahun).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${s.label}`}>
                      Dari Tahun
                    </label>
                    <select
                      value={bulananTahunDari}
                      onChange={(e) => setBulananTahunDari(Number(e.target.value))}
                      className={`h-9 w-full rounded-xl border px-3 text-[12.5px] font-semibold focus:border-brand focus:outline-none ${s.input}`}
                    >
                      {DAFTAR_TAHUN.map((th) => (
                        <option key={th} value={th}>
                          {th}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${s.label}`}>
                      Sampai Tahun
                    </label>
                    <select
                      value={bulananTahunSampai}
                      onChange={(e) => setBulananTahunSampai(Number(e.target.value))}
                      className={`h-9 w-full rounded-xl border px-3 text-[12.5px] font-semibold focus:border-brand focus:outline-none ${s.input}`}
                    >
                      {DAFTAR_TAHUN.map((th) => (
                        <option key={th} value={th}>
                          {th}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RINGKASAN DATA PRATINJAU */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div
              className={`rounded-xl border p-2.5 text-center ${
                dark ? "border-cream/10 bg-pine-deep/40" : "border-line bg-white/50"
              }`}
            >
              <span className={`block text-[10px] font-bold uppercase tracking-wider ${s.redup}`}>Total Baris</span>
              <span className="text-[14px] font-extrabold tabular-nums">
                {sedangMuat ? "…" : `${barisAgregat.length} Baris`}
              </span>
            </div>
            <div
              className={`rounded-xl border p-2.5 text-center ${
                dark ? "border-cream/10 bg-pine-deep/40" : "border-line bg-white/50"
              }`}
            >
              <span className={`block text-[10px] font-bold uppercase tracking-wider ${s.redup}`}>Total Cetak</span>
              <span className="text-[14px] font-extrabold tabular-nums text-brand">
                {sedangMuat ? "…" : `${formatRibuan(totalCetakSemua)}`}
              </span>
            </div>
            <div
              className={`rounded-xl border p-2.5 text-center ${
                dark ? "border-cream/10 bg-pine-deep/40" : "border-line bg-white/50"
              }`}
            >
              <span className={`block text-[10px] font-bold uppercase tracking-wider ${s.redup}`}>Total Masak</span>
              <span className="text-[14px] font-extrabold tabular-nums">
                {sedangMuat ? "…" : `${formatRibuan(totalMasakSemua)}`}
              </span>
            </div>
            <div
              className={`rounded-xl border p-2.5 text-center ${
                dark ? "border-cream/10 bg-pine-deep/40" : "border-line bg-white/50"
              }`}
            >
              <span className={`block text-[10px] font-bold uppercase tracking-wider ${s.redup}`}>Pendapatan</span>
              <span className="text-[13px] font-extrabold tabular-nums text-emerald-500">
                {sedangMuat ? "…" : rupiah(totalHargaSemua)}
              </span>
            </div>
          </div>

          {/* TABEL PRATINJAU RINGKAS */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className={`text-[11.5px] font-bold ${s.label}`}>
                Pratinjau Baris Dokumen:
              </span>
              <span className={`text-[11px] font-semibold ${s.redup}`}>
                Target: {rentangTanggal.labelJudul}
              </span>
            </div>

            <div
              className={`overflow-y-auto max-h-48 rounded-xl border text-[12px] ${
                dark ? "border-cream/10 bg-pine-deep/60" : "border-line bg-white"
              }`}
            >
              {sedangMuat ? (
                <div className="p-6 text-center text-xs font-semibold animate-pulse">
                  Sedang merekapitulasi data laporan…
                </div>
              ) : pesanError ? (
                <div className="p-4 text-center text-xs font-semibold text-rose-500">
                  {pesanError}
                </div>
              ) : barisAgregat.length === 0 ? (
                <div className="p-6 text-center text-xs font-semibold text-pine/50">
                  Tidak ada data dalam periode ini.
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className={`sticky top-0 text-[10px] uppercase font-bold tracking-wider ${dark ? "bg-pine text-cream" : "bg-pine text-cream"}`}>
                    <tr>
                      <th className="px-3 py-2 text-center w-10">No</th>
                      <th className="px-3 py-2">Periode</th>
                      <th className="px-3 py-2 text-right">Cetak</th>
                      <th className="px-3 py-2 text-right">Masak</th>
                      <th className="px-3 py-2 text-right">Total Harga</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5">
                    {barisAgregat.map((b) => (
                      <tr key={b.no} className="hover:bg-brand/5">
                        <td className="px-3 py-1.5 text-center font-mono text-[11px]">{b.no}</td>
                        <td className="px-3 py-1.5 font-semibold">
                          {b.periodeLabel}
                          {b.subLabel && <span className={`ml-1 text-[10px] font-normal ${s.redup}`}>({b.subLabel})</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums font-bold">{formatRibuan(b.jumlahCetak)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{b.jumlahMasak}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{rupiah(b.totalHarga)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* FOOTER TOMBOL */}
        <div
          className={`flex items-center justify-between gap-3 border-t px-6 py-4 shrink-0 ${
            dark ? "border-cream/15 bg-pine-deep/80" : "border-line-strong/30 bg-cream/80"
          }`}
        >
          <button
            type="button"
            onClick={onTutup}
            className={`btn-press h-10 px-5 rounded-xl border text-[13px] font-bold cursor-pointer ${s.garisKuat} ${s.chip} ${s.hantu}`}
          >
            Tutup
          </button>

          <button
            type="button"
            onClick={handleCetak}
            disabled={sedangMuat || barisAgregat.length === 0}
            className="btn-press flex h-10 items-center gap-2 rounded-xl bg-brand px-6 text-[13px] font-bold text-white shadow-md hover:bg-brand-deep cursor-pointer disabled:opacity-50"
          >
            <IconPrint className="h-4 w-4" />
            Cetak Sekarang (Print / PDF)
          </button>
        </div>
      </div>
    </div>
  );
}
