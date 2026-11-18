import { NextResponse } from 'next/server';
import { verifyDualAuth } from '@/lib/auth-check';
import { getDashboardMetrics } from '@/lib/dashboard-service';

/**
 * @swagger
 * /api/dashboard:
 *   get:
 *     summary: Mendapatkan data statistik lengkap dashboard berdasarkan tanggal kalender real-time
 *     description: |
 *       Endpoint gabungan (all-in-one) untuk seluruh data metrik dashboard:
 *       1. Cetakan Global: Akumulasi seluruh cetakan, masak, dan pendapatan sepanjang masa.
 *       2. Harian: Data riil pada tanggal hari ini (WIB).
 *       3. Mingguan: Data riil 7 hari kalender terakhir sampai hari ini.
 *       4. Bulanan: Data riil bulan kalender berjalan saat ini.
 *       5. Data Terakhir Masuk: Referensi data transaksi terakhir di sistem.
 *       6. Pesanan: Rincian transaksi global, harian, dan mingguan.
 *       7. Grafik Analitik:
 *          - Harian: 7 hari terakhir (per hari mundur dari hari ini)
 *          - Mingguan: 7 minggu terakhir (per minggu mundur dari minggu ini)
 *          - Bulanan: 7 bulan terakhir (per bulan mundur dari bulan ini)
 *       8. Ringkasan & Grafik Tren: Kompatibilitas dengan antarmuka frontend yang ada.
 *       
 *       Catatan: Tersedia juga endpoint modular terpisah:
 *       - `/api/dashboard/global`
 *       - `/api/dashboard/harian`
 *       - `/api/dashboard/mingguan`
 *       - `/api/dashboard/bulanan`
 *       - `/api/dashboard/grafik?mode=harian|mingguan|bulanan`
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
 *                           example: 42
 *                         harga_cetak_aktif:
 *                           type: integer
 *                           example: 5000
 *                         total_hari_produksi:
 *                           type: integer
 *                           example: 3
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
 *                           example: 0
 *                         jumlah_masak:
 *                           type: integer
 *                           example: 0
 *                         total_harga:
 *                           type: integer
 *                           example: 0
 *                         total_harga_rupiah:
 *                           type: string
 *                           example: "Rp 0"
 *                         total_pelanggan:
 *                           type: integer
 *                           example: 0
 *                         pesanan_pelanggan:
 *                           type: array
 *                           items:
 *                             type: object
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
 *                           example: 12
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
 *                           example: 12
 *                     data_terakhir_masuk:
 *                       type: object
 *                       properties:
 *                         tanggal:
 *                           type: string
 *                           example: "2026-10-27"
 *                         tanggal_wib:
 *                           type: string
 *                           example: "Selasa, 27 Oktober 2026"
 *                         jumlah_cetak:
 *                           type: integer
 *                           example: 50
 *                         jumlah_masak:
 *                           type: integer
 *                           example: 20
 *                         total_harga:
 *                           type: integer
 *                           example: 250000
 *                         total_harga_rupiah:
 *                           type: string
 *                           example: "Rp 250.000"
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
 *                         data:
 *                           type: array
 *                           items:
 *                             type: object
 *                         harian:
 *                           type: array
 *                           items:
 *                             type: object
 *                         mingguan:
 *                           type: array
 *                           items:
 *                             type: object
 *                         bulanan:
 *                           type: array
 *                           items:
 *                             type: object
 *                     ringkasan:
 *                       type: object
 *                     grafik_tren_produksi:
 *                       type: array
 *                       items:
 *                         type: object
 *                     is_mock_data:
 *                       type: boolean
 *                       example: false
 *       401:
 *         description: Akses ditolak. Sesi login tidak valid.
 *       500:
 *         description: Terjadi kesalahan internal server saat memuat dashboard.
 */
export async function GET(request: Request) {
  try {
    const { error: authError } = verifyDualAuth(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'harian';

    const metrics = await getDashboardMetrics(mode);

    return NextResponse.json({
      status: 'success',
      message: 'Data statistik dashboard berhasil dimuat dari database berdasarkan tanggal kalender',
      data: {
        tanggal_hari_ini_sistem: metrics.todayWib,
        cetakan_global: metrics.cetakan_global,
        harian: metrics.harian,
        mingguan: metrics.mingguan,
        bulanan: metrics.bulanan,
        data_terakhir_masuk: metrics.data_terakhir_masuk,
        pesanan: metrics.pesanan,
        grafik: metrics.grafik,
        ringkasan: metrics.ringkasan,
        grafik_tren_produksi: metrics.grafik_tren_produksi,
        is_mock_data: metrics.is_mock_data,
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
