/**
 * @swagger
 * /api/produksi/laporan:
 *   get:
 *     summary: Mengambil data laporan rincian produksi lengkap untuk cetak laporan & rekap tabel
 *     description: |
 *       Alias resmi dari `/api/produksi/rincian`.
 *       Mengambil data rincian pesanan pelanggan langsung dari tabel rincian_product_harian:
 *       - Mendukung filter periode: harian, mingguan, bulanan, atau rentang tanggal (start_date & end_date)
 *       - Mendukung pencarian keyword (nama, ID, tanggal)
 *       - Mendukung filter status: 'Lunas', 'Belum lunas', atau semua
 *       - Mendukung paginasi (?page=1&limit=20) atau ambil semua sekaligus untuk Cetak Laporan (?all=true atau ?limit=1000)
 *       - Menyertakan ringkasan agregat: total baris, total cetak, total masak, total harga, total sisa belum lunas, total lunas
 *     tags:
 *       - Produksi
 *     parameters:
 *       - in: query
 *         name: periode
 *         schema:
 *           type: string
 *           enum: [harian, mingguan, bulanan, semua]
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Lunas, "Belum lunas", semua]
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *       - in: query
 *         name: all
 *         schema:
 *           type: boolean
 *         description: Set true untuk mengambil semua baris sekaligus tanpa terpotong paginasi (khusus tombol Cetak Laporan)
 *     responses:
 *       200:
 *         description: Data laporan berhasil dimuat
 *       401:
 *         description: Akses ditolak
 */
export { GET } from '../rincian/route';
