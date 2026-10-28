import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyDualAuth } from '@/lib/auth-check';
import { formatToWibDate, formatToWibDisplay, getWibTodayDate } from '@/lib/date-helper';

/**
 * Format angka ke format mata uang Rupiah (contoh: "Rp 50.000")
 */
function formatRupiah(val: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(val || 0);
}

/**
 * Format tanggal YYYY-MM-DD ke label ringkas (contoh: "28 Okt")
 */
function formatLabelHari(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(date);
  } catch {
    return dateStr;
  }
}

/**
 * Format tanggal YYYY-MM-DD ke nama hari Indonesia (contoh: "Rabu")
 */
function formatNamaHari(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      timeZone: 'UTC',
    }).format(date);
  } catch {
    return '-';
  }
}

/**
 * Format tanggal YYYY-MM-DD ke format lengkap (contoh: "Rabu, 28 Oktober 2026")
 */
function formatTanggalLengkap(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  } catch {
    return dateStr;
  }
}

/**
 * Format tahun dan bulan ke nama bulan lengkap Indonesia (contoh: "Oktober 2026")
 */
function formatLabelBulan(year: number, month: number): string {
  try {
    const date = new Date(Date.UTC(year, month - 1, 1));
    return new Intl.DateTimeFormat('id-ID', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  } catch {
    return `${year}-${month}`;
  }
}

/**
 * Format tahun dan bulan ke label bulan singkat Indonesia (contoh: "Okt 2026")
 */
function formatLabelBulanSingkat(year: number, month: number): string {
  try {
    const date = new Date(Date.UTC(year, month - 1, 1));
    return new Intl.DateTimeFormat('id-ID', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  } catch {
    return `${year}-${month}`;
  }
}

/**
 * Menghasilkan data grafik 7 hari terakhir kalender (per hari, dihitung mundur dari HARI INI)
 */
function get7HariTerakhirKalender(
  todayWib: string,
  dataHarianMap: Map<string, { cetak: number; masak: number; pendapatan: number }>
) {
  const [ay, am, ad] = todayWib.split('-').map(Number);
  const result = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.UTC(ay, am - 1, ad));
    d.setUTCDate(d.getUTCDate() - i);
    const yStr = d.getUTCFullYear();
    const mStr = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dStr = String(d.getUTCDate()).padStart(2, '0');
    const dateKey = `${yStr}-${mStr}-${dStr}`;

    const found = dataHarianMap.get(dateKey) || { cetak: 0, masak: 0, pendapatan: 0 };
    result.push({
      tanggal: dateKey,
      label: formatLabelHari(dateKey),
      hari: formatNamaHari(dateKey),
      is_hari_ini: dateKey === todayWib,
      jumlah_cetak: found.cetak,
      jumlah_masak: found.masak,
      total_harga: found.pendapatan,
      total_harga_rupiah: formatRupiah(found.pendapatan),
    });
  }
  return result;
}

/**
 * Menghasilkan data grafik 7 minggu terakhir kalender (per minggu, dihitung mundur dari HARI INI / MINGGU INI)
 */
function get7MingguTerakhirKalender(
  todayWib: string,
  dataHarianMap: Map<string, { cetak: number; masak: number; pendapatan: number }>
) {
  const [ay, am, ad] = todayWib.split('-').map(Number);
  const anchor = new Date(Date.UTC(ay, am - 1, ad));
  const result = [];

  for (let w = 6; w >= 0; w--) {
    const end = new Date(anchor);
    end.setUTCDate(anchor.getUTCDate() - w * 7);
    const start = new Date(end);
    start.setUTCDate(end.getUTCDate() - 6);

    let cetak = 0;
    let masak = 0;
    let pendapatan = 0;

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const cur = new Date(start);
      cur.setUTCDate(start.getUTCDate() + dayOffset);
      const yStr = cur.getUTCFullYear();
      const mStr = String(cur.getUTCMonth() + 1).padStart(2, '0');
      const dStr = String(cur.getUTCDate()).padStart(2, '0');
      const key = `${yStr}-${mStr}-${dStr}`;
      const item = dataHarianMap.get(key);
      if (item) {
        cetak += item.cetak;
        masak += item.masak;
        pendapatan += item.pendapatan;
      }
    }

    const startStr = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}-${String(start.getUTCDate()).padStart(2, '0')}`;
    const endStr = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, '0')}-${String(end.getUTCDate()).padStart(2, '0')}`;

    result.push({
      minggu_ke: 7 - w,
      label: w === 0 ? 'Minggu Ini' : `Minggu ${7 - w}`,
      periode: `${formatLabelHari(startStr)} - ${formatLabelHari(endStr)}`,
      tanggal_awal: startStr,
      tanggal_akhir: endStr,
      is_minggu_ini: w === 0,
      jumlah_cetak: cetak,
      jumlah_masak: masak,
      total_harga: pendapatan,
      total_harga_rupiah: formatRupiah(pendapatan),
    });
  }
  return result;
}

/**
 * Menghasilkan data grafik 7 bulan terakhir kalender (per bulan, dihitung mundur dari BULAN INI)
 */
function get7BulanTerakhirKalender(
  todayWib: string,
  dataHarianMap: Map<string, { cetak: number; masak: number; pendapatan: number }>
) {
  const [ay, am] = todayWib.split('-').map(Number);
  const result = [];

  for (let m = 6; m >= 0; m--) {
    let targetMonth = am - m;
    let targetYear = ay;
    while (targetMonth <= 0) {
      targetMonth += 12;
      targetYear -= 1;
    }

    const monthPrefix = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;

    let cetak = 0;
    let masak = 0;
    let pendapatan = 0;

    for (const [key, val] of dataHarianMap.entries()) {
      if (key.startsWith(monthPrefix)) {
        cetak += val.cetak;
        masak += val.masak;
        pendapatan += val.pendapatan;
      }
    }

    result.push({
      bulan_ke: 7 - m,
      label: formatLabelBulanSingkat(targetYear, targetMonth),
      nama_bulan: formatLabelBulan(targetYear, targetMonth),
      periode: monthPrefix,
      tahun: targetYear,
      bulan: targetMonth,
      is_bulan_ini: m === 0,
      jumlah_cetak: cetak,
      jumlah_masak: masak,
      total_harga: pendapatan,
      total_harga_rupiah: formatRupiah(pendapatan),
    });
  }
  return result;
}

/**
 * @swagger
 * /api/dashboard:
 *   get:
 *     summary: Mendapatkan data statistik lengkap dashboard berdasarkan tanggal kalender real-time
 *     description: |
 *       Perhitungan harian, mingguan, dan bulanan berbasis TANGGAL KALENDER AKTIF (bukan data terakhir masuk):
 *       1. Cetakan Global: Akumulasi seluruh cetakan, masak, dan pendapatan sepanjang masa.
 *       2. Harian: Data riil pada tanggal hari ini (WIB).
 *       3. Mingguan: Data riil 7 hari kalender terakhir sampai hari ini.
 *       4. Bulanan: Data riil bulan kalender berjalan saat ini.
 *       5. Grafik Analitik:
 *          - Harian: 7 hari terakhir (per hari mundur dari hari ini)
 *          - Mingguan: 7 minggu terakhir (per minggu mundur dari minggu ini)
 *          - Bulanan: 7 bulan terakhir (per bulan mundur dari bulan ini)
 *     tags:
 *       - Dashboard
 *     parameters:
 *       - in: query
 *         name: mode
 *         required: false
 *         schema:
 *           type: string
 *           enum: [harian, mingguan, bulanan]
 *           default: harian
 *         description: Mode tampilan grafik (harian = 7 hari terakhir, mingguan = 7 minggu terakhir, bulanan = 7 bulan terakhir)
 *     responses:
 *       200:
 *         description: Berhasil memuat data statistik dashboard lengkap
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Data statistik dashboard berhasil dimuat dari database berdasarkan tanggal kalender
 *                 data:
 *                   type: object
 *                   properties:
 *                     tanggal_hari_ini_sistem:
 *                       type: string
 *                       example: "2026-10-28"
 *                     cetakan_global:
 *                       type: object
 *                       properties:
 *                         total_cetak:
 *                           type: integer
 *                           example: 125
 *                         total_masak:
 *                           type: integer
 *                           example: 45
 *                         total_pendapatan:
 *                           type: integer
 *                           example: 625000
 *                         total_pendapatan_rupiah:
 *                           type: string
 *                           example: "Rp 625.000"
 *                         rata_rata_cetak_harian:
 *                           type: integer
 *                           example: 63
 *                         harga_cetak_aktif:
 *                           type: integer
 *                           example: 5000
 *                         total_hari_produksi:
 *                           type: integer
 *                           example: 2
 *                     harian:
 *                       type: object
 *                       properties:
 *                         tanggal:
 *                           type: string
 *                           example: "2026-10-28"
 *                         tanggal_wib:
 *                           type: string
 *                           example: "Rabu, 28 Oktober 2026"
 *                         jumlah_cetak:
 *                           type: integer
 *                           example: 21
 *                         jumlah_masak:
 *                           type: integer
 *                           example: 8
 *                         total_harga:
 *                           type: integer
 *                           example: 105000
 *                         total_harga_rupiah:
 *                           type: string
 *                           example: "Rp 105.000"
 *                         total_pelanggan:
 *                           type: integer
 *                           example: 2
 *                         pesanan_pelanggan:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                                 example: 17
 *                               nama:
 *                                 type: string
 *                                 example: "sarri"
 *                               jumlah_cetak:
 *                                 type: integer
 *                                 example: 7
 *                               jumlah_masak:
 *                                 type: integer
 *                                 example: 3
 *                               total_harga:
 *                                 type: integer
 *                                 example: 35000
 *                               total_harga_rupiah:
 *                                 type: string
 *                                 example: "Rp 35.000"
 *                               waktu_wib:
 *                                 type: string
 *                                 example: "28 Okt 2026, 15:08 WIB"
 *                     mingguan:
 *                       type: object
 *                       properties:
 *                         periode:
 *                           type: string
 *                           example: "22 Okt - 28 Okt"
 *                         tanggal_awal:
 *                           type: string
 *                           example: "2026-10-22"
 *                         tanggal_akhir:
 *                           type: string
 *                           example: "2026-10-28"
 *                         total_cetak:
 *                           type: integer
 *                           example: 45
 *                         total_masak:
 *                           type: integer
 *                           example: 15
 *                         total_pendapatan:
 *                           type: integer
 *                           example: 225000
 *                         total_pendapatan_rupiah:
 *                           type: string
 *                           example: "Rp 225.000"
 *                         total_transaksi_pelanggan:
 *                           type: integer
 *                           example: 6
 *                     bulanan:
 *                       type: object
 *                       properties:
 *                         periode:
 *                           type: string
 *                           example: "2026-10"
 *                         nama_bulan:
 *                           type: string
 *                           example: "Oktober 2026"
 *                         total_cetak:
 *                           type: integer
 *                           example: 125
 *                         total_masak:
 *                           type: integer
 *                           example: 45
 *                         total_pendapatan:
 *                           type: integer
 *                           example: 625000
 *                         total_pendapatan_rupiah:
 *                           type: string
 *                           example: "Rp 625.000"
 *                         total_transaksi_pelanggan:
 *                           type: integer
 *                           example: 18
 *                     data_terakhir_masuk:
 *                       type: object
 *                       properties:
 *                         tanggal:
 *                           type: string
 *                           example: "2026-10-28"
 *                         tanggal_wib:
 *                           type: string
 *                           example: "Rabu, 28 Oktober 2026"
 *                         jumlah_cetak:
 *                           type: integer
 *                           example: 21
 *                         jumlah_masak:
 *                           type: integer
 *                           example: 8
 *                         total_harga:
 *                           type: integer
 *                           example: 105000
 *                         total_harga_rupiah:
 *                           type: string
 *                           example: "Rp 105.000"
 *                     pesanan:
 *                       type: object
 *                       properties:
 *                         global:
 *                           type: object
 *                         harian:
 *                           type: object
 *                         mingguan:
 *                           type: object
 *                     grafik:
 *                       type: object
 *                       properties:
 *                         mode_terpilih:
 *                           type: string
 *                           example: "harian"
 *                         harian:
 *                           type: array
 *                           description: 7 hari kalender terakhir (per hari mundur dari hari ini)
 *                         mingguan:
 *                           type: array
 *                           description: 7 minggu kalender terakhir (per minggu mundur dari minggu ini)
 *                         bulanan:
 *                           type: array
 *                           description: 7 bulan kalender terakhir (per bulan mundur dari bulan ini)
 *       401:
 *         description: Belum login atau API Key tidak valid
 *       500:
 *         description: Terjadi kesalahan server
 */
export async function GET(request: Request) {
  // ── 1. Verifikasi Keamanan Sesi Login / Kunci API ────────────────────────────
  const { error: authError } = verifyDualAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const modeQuery = (searchParams.get('mode') || 'harian').toLowerCase();
    const modeGrafik = ['harian', 'mingguan', 'bulanan'].includes(modeQuery) ? modeQuery : 'harian';

    // ── 2. Tentukan Tanggal Kalender Hari Ini (WIB - Real Time Date) ────────────
    const todayWib = getWibTodayDate(); // Contoh: "2026-10-28"
    const [ay, am] = todayWib.split('-').map(Number);
    const currentMonthPrefix = `${ay}-${String(am).padStart(2, '0')}`; // Contoh: "2026-10"

    // ── 3. Ambil Seluruh Data Rekap Produksi dari product_harian ────────────────
    const { data: allProduksi, error: prodError } = await supabase
      .from('product_harian')
      .select('id, created_at, jumlah_cetak, jumlah_masak, jumlah_pendapatan')
      .order('created_at', { ascending: false });

    if (prodError) {
      return NextResponse.json(
        { status: 'error', message: 'Gagal membaca data produksi harian', details: prodError.message },
        { status: 500 }
      );
    }

    // ── 4. Ambil Rincian Pesanan Pelanggan dari rincian_product_harian ──────────
    const { data: allRincian, error: rincianError } = await supabase
      .from('rincian_product_harian')
      .select('id, created_at, nama, jumlah_cetak, jumlah_masak, total')
      .order('created_at', { ascending: false });

    if (rincianError) {
      console.warn('[Dashboard] Gagal membaca rincian pesanan:', rincianError.message);
    }

    // ── 5. Ambil Tarif Harga Cetak Aktif Terkini ──────────────────────────────
    const { data: hargaData } = await supabase
      .from('harga_cetak')
      .select('harga')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const hargaAktif = hargaData?.harga ? Number(hargaData.harga) : 5000;

    // ── 6. Petakan Data Harian Berdasarkan Tanggal Kalender (YYYY-MM-DD WIB) ───
    const dataHarianMap = new Map<string, { cetak: number; masak: number; pendapatan: number }>();
    const tanggalUnikSet = new Set<string>();

    (allProduksi || []).forEach((row) => {
      const tgl = formatToWibDate(row.created_at);
      tanggalUnikSet.add(tgl);
      const cetak = Number(row.jumlah_cetak) || 0;
      const masak = Number(row.jumlah_masak) || 0;
      const pendapatan = Number(row.jumlah_pendapatan) || 0;

      const existing = dataHarianMap.get(tgl);
      if (existing) {
        existing.cetak += cetak;
        existing.masak += masak;
        existing.pendapatan += pendapatan;
      } else {
        dataHarianMap.set(tgl, { cetak, masak, pendapatan });
      }
    });

    // ── 7. Perhitungan HARIAN Murni Berdasarkan Tanggal Kalender Hari Ini ──────
    // Mencari data tepat pada tanggal hari ini (todayWib). Jika belum ada input hari ini -> bernilai 0
    const dataHariIni = dataHarianMap.get(todayWib) || { cetak: 0, masak: 0, pendapatan: 0 };

    const rincianHariIni = (allRincian || [])
      .filter((r) => formatToWibDate(r.created_at) === todayWib)
      .map((r) => ({
        id: r.id,
        nama: r.nama,
        jumlah_cetak: Number(r.jumlah_cetak) || 0,
        jumlah_masak: Number(r.jumlah_masak) || 0,
        total_harga: Number(r.total) || 0,
        total_harga_rupiah: formatRupiah(Number(r.total) || 0),
        waktu_wib: formatToWibDisplay(r.created_at),
      }));

    // Data catatan terakhir yang pernah masuk di database (sebagai referensi tanggal)
    let tanggalTerakhirAdaData = todayWib;
    if (allProduksi && allProduksi.length > 0) {
      tanggalTerakhirAdaData = formatToWibDate(allProduksi[0].created_at);
    } else if (allRincian && allRincian.length > 0) {
      tanggalTerakhirAdaData = formatToWibDate(allRincian[0].created_at);
    }
    const dataTerakhirAdaData = dataHarianMap.get(tanggalTerakhirAdaData) || { cetak: 0, masak: 0, pendapatan: 0 };

    // ── 8. Perhitungan MINGGUAN Berdasarkan 7 Hari Kalender Terakhir sampai Hari Ini ──
    const grafik7Hari = get7HariTerakhirKalender(todayWib, dataHarianMap);
    const totalCetakMingguan = grafik7Hari.reduce((acc, h) => acc + h.jumlah_cetak, 0);
    const totalMasakMingguan = grafik7Hari.reduce((acc, h) => acc + h.jumlah_masak, 0);
    const totalPendapatanMingguan = grafik7Hari.reduce((acc, h) => acc + h.total_harga, 0);

    const tujuhHariSet = new Set(grafik7Hari.map((g) => g.tanggal));
    const rincianMingguan = (allRincian || []).filter((r) => tujuhHariSet.has(formatToWibDate(r.created_at)));

    // ── 9. Perhitungan BULANAN Berdasarkan Bulan Kalender Berjalan Saat Ini ────
    let totalCetakBulanIni = 0;
    let totalMasakBulanIni = 0;
    let totalPendapatanBulanIni = 0;

    for (const [tglKey, val] of dataHarianMap.entries()) {
      if (tglKey.startsWith(currentMonthPrefix)) {
        totalCetakBulanIni += val.cetak;
        totalMasakBulanIni += val.masak;
        totalPendapatanBulanIni += val.pendapatan;
      }
    }

    const rincianBulanIni = (allRincian || []).filter((r) =>
      formatToWibDate(r.created_at).startsWith(currentMonthPrefix)
    );

    // ── 10. Perhitungan GLOBAL (Akumulasi Sepanjang Masa) ─────────────────────
    const totalCetakGlobal = (allProduksi || []).reduce(
      (acc, curr) => acc + (Number(curr.jumlah_cetak) || 0),
      0
    );
    const totalMasakGlobal = (allProduksi || []).reduce(
      (acc, curr) => acc + (Number(curr.jumlah_masak) || 0),
      0
    );
    const totalPendapatanGlobal = (allProduksi || []).reduce(
      (acc, curr) => acc + (Number(curr.jumlah_pendapatan) || 0),
      0
    );
    const totalHariProduksi = tanggalUnikSet.size || (allProduksi && allProduksi.length > 0 ? 1 : 0);
    const rataRataCetakHarian = totalHariProduksi > 0 ? Math.round(totalCetakGlobal / totalHariProduksi) : 0;

    // ── 11. Grafik Kalender (7 Hari, 7 Minggu, 7 Bulan Mundur dari Tanggal Hari Ini) ──
    const grafikHarian = grafik7Hari;
    const grafikMingguan = get7MingguTerakhirKalender(todayWib, dataHarianMap);
    const grafikBulanan = get7BulanTerakhirKalender(todayWib, dataHarianMap);

    let dataGrafikAktif: Array<Record<string, unknown>> = grafikHarian;
    if (modeGrafik === 'mingguan') dataGrafikAktif = grafikMingguan;
    if (modeGrafik === 'bulanan') dataGrafikAktif = grafikBulanan;

    // ── 12. Kirim Response Lengkap Berdasarkan Tanggal Kalender Real-Time ─────
    return NextResponse.json({
      status: 'success',
      message: 'Data statistik dashboard berhasil dimuat dari database berdasarkan tanggal kalender',
      data: {
        tanggal_hari_ini_sistem: todayWib,

        // A. Cetakan Global (Semua Akumulasi Data Sepanjang Masa)
        cetakan_global: {
          total_cetak: totalCetakGlobal,
          total_masak: totalMasakGlobal,
          total_pendapatan: totalPendapatanGlobal,
          total_pendapatan_rupiah: formatRupiah(totalPendapatanGlobal),
          rata_rata_cetak_harian: rataRataCetakHarian,
          harga_cetak_aktif: hargaAktif,
          total_hari_produksi: totalHariProduksi,
        },

        // B. Harian Murni Berdasarkan Tanggal Kalender Hari Ini (Bukan data terakhir masuk)
        harian: {
          tanggal: todayWib,
          tanggal_wib: formatTanggalLengkap(todayWib),
          jumlah_cetak: dataHariIni.cetak,
          jumlah_masak: dataHariIni.masak,
          total_harga: dataHariIni.pendapatan,
          total_harga_rupiah: formatRupiah(dataHariIni.pendapatan),
          total_pelanggan: rincianHariIni.length,
          pesanan_pelanggan: rincianHariIni,
        },

        // C. Mingguan Murni Berdasarkan 7 Hari Kalender Terakhir sampai Hari Ini
        mingguan: {
          periode: `${grafik7Hari[0]?.label || ''} - ${grafik7Hari[6]?.label || ''}`,
          tanggal_awal: grafik7Hari[0]?.tanggal,
          tanggal_akhir: grafik7Hari[6]?.tanggal,
          total_cetak: totalCetakMingguan,
          total_masak: totalMasakMingguan,
          total_pendapatan: totalPendapatanMingguan,
          total_pendapatan_rupiah: formatRupiah(totalPendapatanMingguan),
          total_transaksi_pelanggan: rincianMingguan.length,
        },

        // D. Bulanan Murni Berdasarkan Bulan Kalender Berjalan Saat Ini
        bulanan: {
          periode: currentMonthPrefix,
          nama_bulan: formatLabelBulan(ay, am),
          total_cetak: totalCetakBulanIni,
          total_masak: totalMasakBulanIni,
          total_pendapatan: totalPendapatanBulanIni,
          total_pendapatan_rupiah: formatRupiah(totalPendapatanBulanIni),
          total_transaksi_pelanggan: rincianBulanIni.length,
        },

        // E. Data Hari Terakhir Masuk (Sebagai referensi kapan terakhir ada input)
        data_terakhir_masuk: {
          tanggal: tanggalTerakhirAdaData,
          tanggal_wib: formatTanggalLengkap(tanggalTerakhirAdaData),
          jumlah_cetak: dataTerakhirAdaData.cetak,
          jumlah_masak: dataTerakhirAdaData.masak,
          total_harga: dataTerakhirAdaData.pendapatan,
          total_harga_rupiah: formatRupiah(dataTerakhirAdaData.pendapatan),
        },

        // F. Pesanan Lengkap (Global, Harian Hari Ini, dan Mingguan)
        pesanan: {
          global: {
            total_transaksi_pelanggan: allRincian?.length || 0,
            total_cetak: totalCetakGlobal,
            total_masak: totalMasakGlobal,
            total_pendapatan: totalPendapatanGlobal,
            total_pendapatan_rupiah: formatRupiah(totalPendapatanGlobal),
          },
          harian: {
            tanggal: todayWib,
            total_pelanggan: rincianHariIni.length,
            total_cetak: dataHariIni.cetak,
            total_masak: dataHariIni.masak,
            total_pendapatan: dataHariIni.pendapatan,
            total_pendapatan_rupiah: formatRupiah(dataHariIni.pendapatan),
            rincian_pelanggan: rincianHariIni,
          },
          mingguan: {
            periode: `${grafik7Hari[0]?.label || ''} - ${grafik7Hari[6]?.label || ''}`,
            total_transaksi_pelanggan: rincianMingguan.length,
            total_cetak: totalCetakMingguan,
            total_masak: totalMasakMingguan,
            total_pendapatan: totalPendapatanMingguan,
            total_pendapatan_rupiah: formatRupiah(totalPendapatanMingguan),
          },
        },

        // G. Grafik Analitik Berdasarkan Tanggal Kalender
        grafik: {
          mode_terpilih: modeGrafik,
          data: dataGrafikAktif,
          harian: grafikHarian,       // 7 hari kalender terakhir (per hari mundur dari hari ini)
          mingguan: grafikMingguan,   // 7 minggu kalender terakhir (per minggu mundur dari minggu ini)
          bulanan: grafikBulanan,     // 7 bulan kalender terakhir (per bulan mundur dari bulan ini)
        },

        // H. Kompatibilitas Frontend yang Ada
        ringkasan: {
          total_cetak: totalCetakGlobal,
          total_masak: totalMasakGlobal,
          total_pendapatan: totalPendapatanGlobal,
          total_pendapatan_rupiah: formatRupiah(totalPendapatanGlobal),
          rata_rata_cetak_harian: rataRataCetakHarian,
          harga_cetak_aktif: hargaAktif,
          status_pabrik: 'Operasional Optimal',
        },
        grafik_tren_produksi: grafikHarian.map((g) => ({
          tanggal: g.tanggal,
          jumlah_masak: g.jumlah_masak,
          jumlah_cetak: g.jumlah_cetak,
          jumlah_pendapatan: g.total_harga,
          jumlah_pendapatan_rupiah: g.total_harga_rupiah,
        })),
        is_mock_data: totalCetakGlobal === 0,
      },
    });
  } catch (error) {
    console.error('[API Dashboard Error]:', error);
    return NextResponse.json(
      { status: 'error', message: 'Gagal memuat data dashboard', details: String(error) },
      { status: 500 }
    );
  }
}
