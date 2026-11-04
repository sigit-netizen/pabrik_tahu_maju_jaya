import { NextResponse } from 'next/server';
import { verifyDualAuth } from '@/lib/auth-check';
import { getDashboardMetrics } from '@/lib/dashboard-service';

/**
 * @swagger
 * /api/dashboard/bulanan:
 *   get:
 *     summary: Mendapatkan data statistik produksi bulanan (bulan kalender berjalan saat ini)
 *     description: |
 *       Menampilkan data statistik produksi untuk bulan kalender berjalan saat ini (WIB):
 *       - Periode tahun-bulan (contoh: "2026-10")
 *       - Nama bulan lengkap (contoh: "Oktober 2026")
 *       - Total cetak bulan ini
 *       - Total masak bulan ini
 *       - Total pendapatan bulan ini (nominal dan format Rupiah)
 *       - Total transaksi pesanan pelanggan bulan ini
 *       - Tren 7 bulan terakhir sebagai komparasi performa
 *     tags:
 *       - Dashboard
 *     responses:
 *       200:
 *         description: Berhasil memuat data statistik dashboard bulanan
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
 *                   example: Data statistik dashboard bulanan berhasil dimuat
 *                 data:
 *                   type: object
 *                   properties:
 *                     tanggal_hari_ini_sistem:
 *                       type: string
 *                       example: "2026-10-28"
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
 *                     tren_7_bulan:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           bulan_ke:
 *                             type: integer
 *                           label:
 *                             type: string
 *                           nama_bulan:
 *                             type: string
 *                           periode:
 *                             type: string
 *                           tahun:
 *                             type: integer
 *                           bulan:
 *                             type: integer
 *                           is_bulan_ini:
 *                             type: boolean
 *                           jumlah_cetak:
 *                             type: integer
 *                           jumlah_masak:
 *                             type: integer
 *                           total_harga:
 *                             type: integer
 *                           total_harga_rupiah:
 *                             type: string
 *       401:
 *         description: Unauthorized - Sesi login tidak valid
 *       500:
 *         description: Terjadi kesalahan server
 */
export async function GET(request: Request) {
  try {
    const { error: authError } = verifyDualAuth(request);
    if (authError) return authError;

    const metrics = await getDashboardMetrics();

    return NextResponse.json({
      status: 'success',
      message: 'Data statistik dashboard bulanan berhasil dimuat',
      data: {
        tanggal_hari_ini_sistem: metrics.todayWib,
        bulanan: metrics.bulanan,
        tren_7_bulan: metrics.grafik.bulanan,
      },
    });
  } catch (error) {
    console.error('[API Dashboard Bulanan Error]:', error);
    return NextResponse.json(
      { status: 'error', message: 'Gagal memuat data statistik bulanan', details: String(error) },
      { status: 500 }
    );
  }
}
