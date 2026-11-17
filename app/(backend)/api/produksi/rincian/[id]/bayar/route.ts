import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyDualAuth } from '@/lib/auth-check';
import { formatToWibDate, formatToWibDisplay } from '@/lib/date-helper';

/**
 * Format angka ke mata uang Rupiah
 */
function formatRupiah(val: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(val || 0);
}

/**
 * @swagger
 * /api/produksi/rincian/{id}/bayar:
 *   post:
 *     summary: Melakukan pembayaran cicilan atau pelunasan pesanan pelanggan
 *     description: |
 *       Menerima nominal pembayaran baru dari form input di dashboard/tabel rincian.
 *       Logika bisnis:
 *       1. Mengambil data pesanan pelanggan saat ini.
 *       2. Mengurangi sisa pembayaran: sisa_sebelumnya - nominal_bayar.
 *       3. Jika hasil <= 0 (lunas atau lebih bayar):
 *          - Sisa diisi 0 (tidak boleh minus).
 *          - Status pembayaran otomatis diupdate menjadi 'Lunas'.
 *       4. Jika hasil > 0:
 *          - Sisa diupdate menjadi hasil pengurangan.
 *          - Status pembayaran tetap 'Belum lunas'.
 *     tags:
 *       - Produksi
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID baris rincian pelanggan (rincian_product_harian)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bayar
 *             properties:
 *               bayar:
 *                 type: integer
 *                 description: Nominal uang yang dibayarkan pelanggan (Rp)
 *                 example: 500000
 *     responses:
 *       200:
 *         description: Pembayaran berhasil diproses dan sisa diperbarui
 *       400:
 *         description: Nominal pembayaran tidak valid
 *       404:
 *         description: Data pesanan tidak ditemukan
 *       401:
 *         description: Belum login atau API Key tidak valid
 *       500:
 *         description: Kesalahan server
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, user } = verifyDualAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const numericId = parseInt(id, 10);

    if (isNaN(numericId)) {
      return NextResponse.json(
        { status: 'error', message: 'Parameter ID harus berupa angka!' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    // Mendukung field 'bayar', 'nominal', atau 'jumlah_bayar'
    const inputBayar = body.bayar ?? body.nominal ?? body.jumlah_bayar;
    const nominalBayar = Number(inputBayar);

    if (isNaN(nominalBayar) || nominalBayar <= 0) {
      return NextResponse.json(
        { status: 'error', message: 'Nominal pembayaran (bayar) harus berupa angka lebih dari 0!' },
        { status: 400 }
      );
    }

    // 1. Ambil data rincian pesanan dari database
    const { data: row, error: fetchErr } = await supabase
      .from('rincian_product_harian')
      .select('id, created_at, nama, jumlah_cetak, jumlah_masak, total, sisa, status_pembayaran')
      .eq('id', numericId)
      .single();

    if (fetchErr || !row) {
      return NextResponse.json(
        { status: 'error', message: `Data pesanan pelanggan dengan ID #${id} tidak ditemukan.` },
        { status: 404 }
      );
    }

    // 2. Ambil nilai sisa sebelumnya (fallback ke total jika sisa di DB masih NULL)
    const totalHarga = Number(row.total) || 0;
    const sisaSebelumnya =
      row.sisa !== null && row.sisa !== undefined
        ? Number(row.sisa)
        : totalHarga;

    // Jika sudah lunas
    if (sisaSebelumnya <= 0 && row.status_pembayaran === 'Lunas') {
      return NextResponse.json(
        {
          status: 'error',
          message: `Pesanan ID #${id} atas nama "${row.nama}" sudah berstatus LUNAS. Tidak ada sisa tagihan.`,
        },
        { status: 400 }
      );
    }

    // 3. Hitung sisa baru: sisa_sebelumnya - input_user
    const hitungPengurangan = sisaSebelumnya - nominalBayar;

    let sisaBaru = 0;
    let statusBaru = 'Belum lunas';
    let kembalian = 0;

    // Sesuai aturan: ketika sisa pembayaran - input user <= 0 (0 atau minus):
    // status pembayaran langsung update lunas, dan ketika hasilnya minus sisa pembayaran diisikan 0 (jangan minus)
    if (hitungPengurangan <= 0) {
      sisaBaru = 0;
      statusBaru = 'Lunas';
      kembalian = hitungPengurangan < 0 ? Math.abs(hitungPengurangan) : 0;
    } else {
      sisaBaru = hitungPengurangan;
      statusBaru = 'Belum lunas';
      kembalian = 0;
    }

    // 4. Update ke database Supabase
    const { data: updated, error: updateErr } = await supabase
      .from('rincian_product_harian')
      .update({
        sisa: sisaBaru,
        status_pembayaran: statusBaru,
      })
      .eq('id', numericId)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json(
        { status: 'error', message: 'Gagal memperbarui status pembayaran ke database', details: updateErr.message },
        { status: 500 }
      );
    }

    // 5. Kembalikan data lengkap untuk update UI Frontend
    const pesanSukses = statusBaru === 'Lunas'
      ? `Pembayaran Rp ${nominalBayar.toLocaleString('id-ID')} diterima. Tagihan "${row.nama}" LUNAS!`
      : `Pembayaran Rp ${nominalBayar.toLocaleString('id-ID')} diterima. Sisa tagihan "${row.nama}": Rp ${sisaBaru.toLocaleString('id-ID')}`;

    return NextResponse.json({
      status: 'success',
      message: pesanSukses,
      data: {
        id: updated.id,
        nama: updated.nama,
        tanggal: formatToWibDate(updated.created_at),
        waktu_wib: formatToWibDisplay(updated.created_at),
        jumlah_cetak: Number(updated.jumlah_cetak) || 0,
        jumlah_masak: Number(updated.jumlah_masak) || 0,
        total: totalHarga,
        total_rupiah: formatRupiah(totalHarga),
        bayar_terbaru: nominalBayar,
        bayar_terbaru_rupiah: formatRupiah(nominalBayar),
        sisa_sebelumnya: sisaSebelumnya,
        sisa_sebelumnya_rupiah: formatRupiah(sisaSebelumnya),
        sisa: sisaBaru,
        sisa_rupiah: formatRupiah(sisaBaru),
        status_pembayaran: statusBaru,
        kembalian,
        kembalian_rupiah: formatRupiah(kembalian),
        audit: {
          diupdate_oleh: user?.username || 'admin',
          id_admin: user?.id || null,
        },
      },
    });
  } catch (error) {
    console.error('[API Bayar Error]:', error);
    return NextResponse.json(
      { status: 'error', message: 'Terjadi kesalahan sistem saat memproses pembayaran', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * PUT juga didukung untuk fleksibilitas pemanggilan
 */
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return POST(request, context);
}
