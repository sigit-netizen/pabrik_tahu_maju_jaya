import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyDualAuth } from '@/lib/auth-check';
import { formatToWibDate, formatToWibDisplay, getWibTodayDate, getWibDayRange } from '@/lib/date-helper';

function formatRupiah(val: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(val || 0);
}

/**
 * @swagger
 * /api/produksi/rincian:
 *   get:
 *     summary: Mengambil daftar semua rincian pesanan pelanggan langsung dari DB untuk tabel dashboard & cetak laporan
 *     description: |
 *       Menampilkan data rincian pesanan pelanggan dari tabel rincian_product_harian:
 *       - Mendukung filter periode: harian (hari ini), mingguan (7 hari terakhir), bulanan (bulan ini), atau rentang kustom (start_date & end_date)
 *       - Mendukung pencarian keyword (nama pelanggan, ID, status pembayaran, atau tanggal)
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
 *         description: Shortcut filter periode waktu
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter tanggal awal (YYYY-MM-DD WIB)
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter tanggal akhir (YYYY-MM-DD WIB)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Lunas, "Belum lunas", semua]
 *         description: Filter status pembayaran
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Kata kunci pencarian (nama pelanggan, ID, tanggal)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: all
 *         schema:
 *           type: boolean
 *         description: Set true untuk mengambil semua baris tanpa paginasi (khusus cetak laporan)
 *     responses:
 *       200:
 *         description: Berhasil memuat daftar rincian dan laporan
 *       401:
 *         description: Belum login atau API Key tidak valid
 *       500:
 *         description: Terjadi kesalahan server
 */
export async function GET(request: Request) {
  const { error: authError } = verifyDualAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);

    const periode = searchParams.get('periode')?.toLowerCase();
    const startDateParam = searchParams.get('start_date');
    const endDateParam = searchParams.get('end_date');
    const statusParam = searchParams.get('status');
    const queryParam = searchParams.get('q') || searchParams.get('search') || '';
    const isAll = searchParams.get('all') === 'true' || searchParams.get('limit') === '0';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = isAll
      ? 1000
      : Math.max(1, Math.min(500, parseInt(searchParams.get('limit') || '20', 10)));

    // ── Tentukan Rentang Tanggal WIB ──────────────────────────────────────────
    let startDate: string | null = startDateParam;
    let endDate: string | null = endDateParam;

    const todayStr = getWibTodayDate();

    if (!startDate && !endDate && periode) {
      if (periode === 'harian') {
        startDate = todayStr;
        endDate = todayStr;
      } else if (periode === 'mingguan') {
        const d = new Date(`${todayStr}T00:00:00+07:00`);
        d.setDate(d.getDate() - 6);
        startDate = formatToWibDate(d.toISOString());
        endDate = todayStr;
      } else if (periode === 'bulanan') {
        const [y, m] = todayStr.split('-');
        const lastDay = new Date(Number(y), Number(m), 0).getDate();
        startDate = `${y}-${m}-01`;
        endDate = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
      }
    }

    // ── Bangun Query Supabase ────────────────────────────────────────────────
    let query = supabase
      .from('rincian_product_harian')
      .select('*', { count: 'exact' })
      .order('id', { ascending: false });

    // Filter tanggal berdasarkan created_at dalam rentang WIB (+07:00)
    if (startDate) {
      query = query.gte('created_at', `${startDate}T00:00:00+07:00`);
    }
    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59.999+07:00`);
    }

    // Filter status jika spesifik
    if (statusParam && statusParam.toLowerCase() !== 'semua') {
      if (statusParam.toLowerCase() === 'lunas') {
        query = query.eq('status_pembayaran', 'Lunas');
      } else if (statusParam.toLowerCase() === 'belum lunas' || statusParam.toLowerCase() === 'belum') {
        // Mendukung row lama yang status_pembayarannya masih NULL
        query = query.or('status_pembayaran.eq.Belum lunas,status_pembayaran.is.null');
      }
    }

    // Filter pencarian nama pelanggan atau id
    const cleanQ = queryParam.trim();
    if (cleanQ) {
      const numQ = parseInt(cleanQ, 10);
      if (!isNaN(numQ) && String(numQ) === cleanQ) {
        query = query.or(`id.eq.${numQ},nama.ilike.%${cleanQ}%`);
      } else {
        query = query.ilike('nama', `%${cleanQ}%`);
      }
    }

    // Ambil semua atau paginasi
    let dataRows: any[] = [];
    let totalCount = 0;

    if (isAll) {
      const { data, count, error } = await query;
      if (error) {
        return NextResponse.json(
          { status: 'error', message: 'Gagal mengambil data rincian', details: error.message },
          { status: 500 }
        );
      }
      dataRows = data || [];
      totalCount = count || dataRows.length;
    } else {
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      const { data, count, error } = await query.range(from, to);
      if (error) {
        return NextResponse.json(
          { status: 'error', message: 'Gagal mengambil data rincian', details: error.message },
          { status: 500 }
        );
      }
      dataRows = data || [];
      totalCount = count || 0;
    }

    // ── Format Baris & Fallback untuk Baris Lama yang Masih NULL ──────────────
    let totalCetakTampil = 0;
    let totalMasakTampil = 0;
    let totalHargaTampil = 0;
    let totalSisaTampil = 0;
    let totalTerbayarTampil = 0;
    let jumlahLunas = 0;
    let jumlahBelumLunas = 0;

    const formattedList = dataRows.map((row) => {
      const totalHarga = Number(row.total) || 0;
      // Fallback sisa: jika NULL gunakan total
      const sisa = row.sisa !== null && row.sisa !== undefined ? Number(row.sisa) : totalHarga;
      // Fallback status: jika NULL tentukan dari sisa
      const statusBayar = row.status_pembayaran || (sisa === 0 ? 'Lunas' : 'Belum lunas');
      const terbayar = Math.max(0, totalHarga - sisa);

      totalCetakTampil += Number(row.jumlah_cetak) || 0;
      totalMasakTampil += Number(row.jumlah_masak) || 0;
      totalHargaTampil += totalHarga;
      totalSisaTampil += sisa;
      totalTerbayarTampil += terbayar;

      if (statusBayar === 'Lunas') {
        jumlahLunas += 1;
      } else {
        jumlahBelumLunas += 1;
      }

      return {
        id: row.id,
        created_at: row.created_at,
        tanggal: formatToWibDate(row.created_at),
        waktu_wib: formatToWibDisplay(row.created_at),
        nama: row.nama || '-',
        jumlah_cetak: Number(row.jumlah_cetak) || 0,
        jumlah_masak: Number(row.jumlah_masak) || 0,
        total: totalHarga,
        total_rupiah: formatRupiah(totalHarga),
        sisa,
        sisa_rupiah: formatRupiah(sisa),
        status_pembayaran: statusBayar,
        terbayar,
        terbayar_rupiah: formatRupiah(terbayar),
      };
    });

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      status: 'success',
      message: 'Data rincian dan laporan produksi berhasil dimuat langsung dari database',
      pagination: {
        page,
        limit,
        total: totalCount,
        total_pages: totalPages,
      },
      ringkasan: {
        total_baris: formattedList.length,
        total_cetak: totalCetakTampil,
        total_masak: totalMasakTampil,
        total_harga: totalHargaTampil,
        total_harga_rupiah: formatRupiah(totalHargaTampil),
        total_sisa_belum_lunas: totalSisaTampil,
        total_sisa_belum_lunas_rupiah: formatRupiah(totalSisaTampil),
        total_terbayar: totalTerbayarTampil,
        total_terbayar_rupiah: formatRupiah(totalTerbayarTampil),
        jumlah_lunas: jumlahLunas,
        jumlah_belum_lunas: jumlahBelumLunas,
      },
      filter_aktif: {
        periode: periode || 'kustom',
        start_date: startDate,
        end_date: endDate,
        status: statusParam || 'semua',
        search: cleanQ || null,
      },
      data: formattedList,
    });
  } catch (error) {
    console.error('[API Rincian Error]:', error);
    return NextResponse.json(
      { status: 'error', message: 'Terjadi kesalahan sistem saat memuat rincian laporan', details: String(error) },
      { status: 500 }
    );
  }
}
