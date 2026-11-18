import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyDualAuth } from '@/lib/auth-check';

/**
 * @swagger
 * /api/produksi/hitung:
 *   post:
 *     summary: Menghitung total harga secara live saat user menginput jumlah cetak di form FE
 *     description: |
 *       Endpoint ringan untuk kalkulasi real-time di form FE.
 *       FE memanggil endpoint ini setiap kali user selesai mengetik jumlah_cetak,
 *       lalu menampilkan hasil total (Rp) kepada user sebelum form disubmit.
 *       Data TIDAK disimpan ke database di endpoint ini.
 *     tags:
 *       - Produksi
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jumlah_cetak
 *             properties:
 *               jumlah_cetak:
 *                 type: integer
 *                 description: Jumlah cetakan tahu yang diinput user
 *                 example: 50
 *     responses:
 *       200:
 *         description: Hasil kalkulasi total berhasil dihitung
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     jumlah_cetak:
 *                       type: integer
 *                       example: 50
 *                     harga_per_cetak:
 *                       type: integer
 *                       example: 2000
 *                     total:
 *                       type: integer
 *                       description: Total harga (jumlah_cetak x harga_per_cetak)
 *                       example: 100000
 *                     total_rupiah:
 *                       type: string
 *                       description: Format rupiah siap tampil di FE
 *                       example: "Rp 100.000"
 *       400:
 *         description: jumlah_cetak tidak valid
 *       404:
 *         description: Harga cetak belum diatur di database
 *       401:
 *         description: Belum login atau API Key tidak valid
 */
export async function POST(request: Request) {
  const { error: authError } = verifyDualAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { jumlah_cetak } = body;

    // Validasi input
    const qty = Number(jumlah_cetak);
    if (isNaN(qty) || qty < 0) {
      return NextResponse.json(
        { status: 'error', message: 'jumlah_cetak harus berupa angka positif!' },
        { status: 400 }
      );
    }

    // Ambil harga terkini dari tabel harga_cetak
    const { data: hargaData, error: hargaError } = await supabase
      .from('harga_cetak')
      .select('id, harga, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (hargaError) {
      return NextResponse.json(
        { status: 'error', message: 'Gagal membaca harga cetak', details: hargaError.message },
        { status: 500 }
      );
    }

    if (!hargaData || !hargaData.harga) {
      return NextResponse.json(
        {
          status: 'error',
          message:
            'Harga cetak belum diatur! Silakan tambahkan harga di tabel harga_cetak terlebih dahulu.',
        },
        { status: 404 }
      );
    }

    const hargaPerCetak = Number(hargaData.harga);
    const total = qty * hargaPerCetak;

    // Format Rupiah untuk langsung ditampilkan di FE
    const totalRupiah = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(total);

    return NextResponse.json({
      status: 'success',
      data: {
        jumlah_cetak: qty,
        harga_per_cetak: hargaPerCetak,
        total,
        total_rupiah: totalRupiah, // "Rp 100.000" — langsung pakai di FE
      },
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Terjadi kesalahan saat menghitung', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * @swagger
 * /api/produksi/hitung:
 *   get:
 *     summary: Mengambil harga cetak aktif saat ini (untuk inisialisasi form FE)
 *     description: |
 *       FE memanggil endpoint ini saat pertama kali form dibuka,
 *       untuk mengetahui harga per cetakan yang berlaku hari ini.
 *     tags:
 *       - Produksi
 *     responses:
 *       200:
 *         description: Harga aktif berhasil dimuat
 *       404:
 *         description: Harga belum diatur
 *       401:
 *         description: Belum login
 */
export async function GET(request: Request) {
  const { error: authError } = verifyDualAuth(request);
  if (authError) return authError;

  try {
    const { data: hargaData, error } = await supabase
      .from('harga_cetak')
      .select('id, harga, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { status: 'error', message: 'Gagal memuat harga cetak', details: error.message },
        { status: 500 }
      );
    }

    if (!hargaData) {
      return NextResponse.json(
        { status: 'error', message: 'Harga cetak belum diatur!' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: 'success',
      data: {
        id: hargaData.id,
        harga_per_cetak: Number(hargaData.harga),
        berlaku_sejak: hargaData.created_at,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Terjadi kesalahan', details: String(error) },
      { status: 500 }
    );
  }
}
