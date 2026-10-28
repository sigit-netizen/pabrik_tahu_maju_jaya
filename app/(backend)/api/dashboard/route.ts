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
 * Format tahun dan bulan ke label bulan Indonesia (contoh: "Okt 2026")
 */
function formatLabelBulan(year: number, month: number): string {
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
 * Menghasilkan data grafik 7 hari terakhir (per hari)
 */
function get7HariTerakhir(
  anchorDateStr: string,
  dataHarianMap: Map<string, { cetak: number; masak: number; pendapatan: number }>
) {
  const [ay, am, ad] = anchorDateStr.split('-').map(Number);
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
      jumlah_cetak: found.cetak,
      jumlah_masak: found.masak,
      total_harga: found.pendapatan,
      total_harga_rupiah: formatRupiah(found.pendapatan),
    });
  }
  return result;
}

/**
 * Menghasilkan data grafik 7 minggu terakhir (per minggu)
 */
function get7MingguTerakhir(
  anchorDateStr: string,
  dataHarianMap: Map<string, { cetak: number; masak: number; pendapatan: number }>
) {
  const [ay, am, ad] = anchorDateStr.split('-').map(Number);
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
      label: `Minggu ${7 - w}`,
      periode: `${formatLabelHari(startStr)} - ${formatLabelHari(endStr)}`,
      tanggal_awal: startStr,
      tanggal_akhir: endStr,
      jumlah_cetak: cetak,
      jumlah_masak: masak,
      total_harga: pendapatan,
      total_harga_rupiah: formatRupiah(pendapatan),
    });
  }
  return result;
}

/**
 * Menghasilkan data grafik 7 bulan terakhir (per bulan)
 */
function get7BulanTerakhir(
  anchorDateStr: string,
  dataHarianMap: Map<string, { cetak: number; masak: number; pendapatan: number }>
) {
  const [ay, am] = anchorDateStr.split('-').map(Number);
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
      label: formatLabelBulan(targetYear, targetMonth),
      periode: monthPrefix,
      tahun: targetYear,
      bulan: targetMonth,
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
 *     summary: Mendapatkan data statistik lengkap dashboard (Global, Hari Terakhir, Pesanan, dan Grafik)
 *     description: |
 *       Menghitung metrik produksi dari database:
 *       1. Total cetakan, masak, dan pendapatan secara global (sepanjang masa).
 *       2. Data cetakan dan total harga pada hari terakhir produksi dicatat.
 *       3. Rekap pesanan pelanggan secara global, harian, dan mingguan.
 *       4. Grafik analitik dengan 3 mode rentang waktu:
 *          - Harian (7 hari terakhir)
 *          - Mingguan (7 minggu terakhir)
 *          - Bulanan (7 bulan terakhir)
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
 *         description: Berhasil memuat data statistik dashboard
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

    // ── 2. Ambil Seluruh Data Rekap Produksi dari product_harian ────────────────
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

    // ── 3. Ambil Rincian Pesanan Pelanggan dari rincian_product_harian ──────────
    const { data: allRincian, error: rincianError } = await supabase
      .from('rincian_product_harian')
      .select('id, created_at, nama, jumlah_cetak, jumlah_masak, total')
      .order('created_at', { ascending: false });

    if (rincianError) {
      console.warn('[Dashboard] Gagal membaca rincian pesanan:', rincianError.message);
    }

    // ── 4. Ambil Tarif Harga Cetak Aktif Terkini ──────────────────────────────
    const { data: hargaData } = await supabase
      .from('harga_cetak')
      .select('harga')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const hargaAktif = hargaData?.harga ? Number(hargaData.harga) : 5000;

    // ── 5. Petakan Data Harian ke Map (YYYY-MM-DD -> { cetak, masak, pendapatan }) ──
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

    // ── 6. Tentukan Hari Terakhir (Latest Day) ──────────────────────────────────
    const todayWib = getWibTodayDate();
    let hariTerakhirTgl = todayWib;

    if (allProduksi && allProduksi.length > 0) {
      hariTerakhirTgl = formatToWibDate(allProduksi[0].created_at);
    } else if (allRincian && allRincian.length > 0) {
      hariTerakhirTgl = formatToWibDate(allRincian[0].created_at);
    }

    const dataHariTerakhir = dataHarianMap.get(hariTerakhirTgl) || { cetak: 0, masak: 0, pendapatan: 0 };

    // Rincian pesanan pelanggan pada hari terakhir
    const rincianHariTerakhir = (allRincian || [])
      .filter((r) => formatToWibDate(r.created_at) === hariTerakhirTgl)
      .map((r) => ({
        id: r.id,
        nama: r.nama,
        jumlah_cetak: Number(r.jumlah_cetak) || 0,
        jumlah_masak: Number(r.jumlah_masak) || 0,
        total_harga: Number(r.total) || 0,
        total_harga_rupiah: formatRupiah(Number(r.total) || 0),
        waktu_wib: formatToWibDisplay(r.created_at),
      }));

    // ── 7. Hitung Akumulasi Global (Semua Cetakan & Pesanan Sepanjang Masa) ─────
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

    // ── 8. Hitung Pesanan Mingguan (7 Hari Terakhir dari Hari Terakhir) ────────
    const grafik7Hari = get7HariTerakhir(hariTerakhirTgl, dataHarianMap);
    const totalCetakMingguan = grafik7Hari.reduce((acc, h) => acc + h.jumlah_cetak, 0);
    const totalMasakMingguan = grafik7Hari.reduce((acc, h) => acc + h.jumlah_masak, 0);
    const totalPendapatanMingguan = grafik7Hari.reduce((acc, h) => acc + h.total_harga, 0);

    const tujuhHariSet = new Set(grafik7Hari.map((g) => g.tanggal));
    const rincianMingguan = (allRincian || []).filter((r) => tujuhHariSet.has(formatToWibDate(r.created_at)));

    // ── 9. Buat Grafik Analitik (Harian, Mingguan, Bulanan) ───────────────────
    const grafikHarian = grafik7Hari;
    const grafikMingguan = get7MingguTerakhir(hariTerakhirTgl, dataHarianMap);
    const grafikBulanan = get7BulanTerakhir(hariTerakhirTgl, dataHarianMap);

    let dataGrafikAktif: Array<Record<string, unknown>> = grafikHarian;
    if (modeGrafik === 'mingguan') dataGrafikAktif = grafikMingguan;
    if (modeGrafik === 'bulanan') dataGrafikAktif = grafikBulanan;

    // ── 10. Susun Response Terstruktur & Lengkap Sesuai Permintaan ────────────
    return NextResponse.json({
      status: 'success',
      message: 'Data statistik dashboard berhasil dimuat dari database',
      data: {
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

        // B. Cetakan Hari Terakhir & Total Harga Hari Terakhir
        hari_terakhir: {
          tanggal: hariTerakhirTgl,
          tanggal_wib: `${formatNamaHari(hariTerakhirTgl)}, ${formatLabelHari(hariTerakhirTgl)}`,
          jumlah_cetak: dataHariTerakhir.cetak,
          jumlah_masak: dataHariTerakhir.masak,
          total_harga: dataHariTerakhir.pendapatan,
          total_harga_rupiah: formatRupiah(dataHariTerakhir.pendapatan),
        },

        // C. Pesanan (Global, Harian, dan Mingguan)
        pesanan: {
          global: {
            total_transaksi_pelanggan: allRincian?.length || 0,
            total_cetak: totalCetakGlobal,
            total_masak: totalMasakGlobal,
            total_pendapatan: totalPendapatanGlobal,
            total_pendapatan_rupiah: formatRupiah(totalPendapatanGlobal),
          },
          harian: {
            tanggal: hariTerakhirTgl,
            total_pelanggan: rincianHariTerakhir.length,
            total_cetak: dataHariTerakhir.cetak,
            total_masak: dataHariTerakhir.masak,
            total_pendapatan: dataHariTerakhir.pendapatan,
            total_pendapatan_rupiah: formatRupiah(dataHariTerakhir.pendapatan),
            rincian_pelanggan: rincianHariTerakhir,
          },
          mingguan: {
            rentang: `${grafik7Hari[0]?.label || ''} - ${grafik7Hari[6]?.label || ''}`,
            total_transaksi_pelanggan: rincianMingguan.length,
            total_cetak: totalCetakMingguan,
            total_masak: totalMasakMingguan,
            total_pendapatan: totalPendapatanMingguan,
            total_pendapatan_rupiah: formatRupiah(totalPendapatanMingguan),
          },
        },

        // D. Grafik Analitik (Harian: 7 Hari, Mingguan: 7 Minggu, Bulanan: 7 Bulan)
        grafik: {
          mode_terpilih: modeGrafik,
          data: dataGrafikAktif,
          harian: grafikHarian,       // 7 hari terakhir (per hari)
          mingguan: grafikMingguan,   // 7 minggu terakhir (per minggu)
          bulanan: grafikBulanan,     // 7 bulan terakhir (per bulan)
        },

        // E. Kompatibilitas Frontend yang Ada (Tidak merusak tampilan UI dashboard)
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
