import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyDualAuth } from '@/lib/auth-check';
import { toWibTimestamp, formatToWibDisplay } from '@/lib/date-helper';

/**
 * @swagger
 * /api/pengaturan/harga:
 *   get:
 *     summary: Mengambil harga cetak aktif dan riwayat perubahan harga (Menu Pengaturan)
 *     description: |
 *       Menampilkan harga per cetakan tahu yang berlaku saat ini serta seluruh riwayat
 *       perubahan harga sebelumnya dari tabel harga_cetak.
 *     tags:
 *       - Pengaturan
 *     responses:
 *       200:
 *         description: Berhasil memuat data harga cetak
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     harga_aktif:
 *                       type: object
 *                     riwayat_harga:
 *                       type: array
 *       401:
 *         description: Belum login atau API Key tidak valid
 *       500:
 *         description: Terjadi kesalahan server
 */
export async function GET(request: Request) {
  const { error: authError } = verifyDualAuth(request);
  if (authError) return authError;

  try {
    const { data, error } = await supabase
      .from('harga_cetak')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { status: 'error', message: 'Gagal mengambil data harga cetak', details: error.message },
        { status: 500 }
      );
    }

    const formatRupiah = (val: number) =>
      new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
      }).format(val || 0);

    const formattedList = (data || []).map((row) => ({
      id: row.id,
      harga: Number(row.harga),
      harga_rupiah: formatRupiah(Number(row.harga)),
      created_at: row.created_at,
      berlaku_sejak: row.created_at,
      waktu_wib: formatToWibDisplay(row.created_at),
    }));

    const hargaAktif = formattedList.length > 0 ? formattedList[0] : null;

    return NextResponse.json({
      status: 'success',
      data: {
        harga_aktif: hargaAktif,
        total_riwayat: formattedList.length,
        riwayat_harga: formattedList,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Terjadi kesalahan sistem saat memuat harga', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * @swagger
 * /api/pengaturan/harga:
 *   post:
 *     summary: Menetapkan / Memperbarui harga per cetakan tahu (Menu Pengaturan)
 *     description: |
 *       Admin mengatur tarif baru harga cetakan tahu. Jika sudah ada data harga cetak di database,
 *       baris yang ada akan diperbarui (update). Jika belum ada, baris baru dibuat (insert).
 *       Harga terbaru otomatis dipakai untuk perhitungan form produksi berikutnya.
 *     tags:
 *       - Pengaturan
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - harga
 *             properties:
 *               harga:
 *                 type: integer
 *                 description: Nominal harga baru per cetakan (Rp)
 *                 example: 2500
 *     responses:
 *       200:
 *         description: Harga cetak berhasil diperbarui
 *       400:
 *         description: Nilai harga tidak valid
 *       403:
 *         description: Akses RLS Supabase terhalang
 *       401:
 *         description: Akses ditolak
 */
export async function POST(request: Request) {
  const { error: authError } = verifyDualAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { harga } = body;

    const nominal = Number(harga);
    if (isNaN(nominal) || nominal <= 0) {
      return NextResponse.json(
        { status: 'error', message: 'Nominal harga cetak harus berupa angka lebih dari 0!' },
        { status: 400 }
      );
    }

    const timestampWib = toWibTimestamp();

    // Cek apakah sudah ada data harga cetak di database
    const { data: existingHarga, error: checkError } = await supabase
      .from('harga_cetak')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (checkError) {
      return NextResponse.json(
        { status: 'error', message: 'Gagal memeriksa harga cetak di database', details: checkError.message },
        { status: 500 }
      );
    }

    let savedData;
    let savedError;

    if (existingHarga?.id) {
      // Perbarui (UPDATE) baris harga yang sudah ada agar tidak membuat baris baru di tabel
      const { data, error } = await supabase
        .from('harga_cetak')
        .update({ harga: nominal, created_at: timestampWib })
        .eq('id', existingHarga.id)
        .select()
        .single();
      savedData = data;
      savedError = error;
    } else {
      // Jika tabel masih kosong, baru buat baris pertama (INSERT)
      const { data, error } = await supabase
        .from('harga_cetak')
        .insert([{ harga: nominal, created_at: timestampWib }])
        .select()
        .single();
      savedData = data;
      savedError = error;
    }

    if (savedError) {
      if (savedError.code === '42501' || savedError.message.includes('row-level security')) {
        return NextResponse.json(
          {
            status: 'error',
            message: 'Akses ke tabel harga_cetak terhalang Row Level Security (RLS) Supabase.',
            solusi: 'Jalankan query di Supabase SQL Editor: ALTER TABLE harga_cetak DISABLE ROW LEVEL SECURITY;',
            details: savedError.message,
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { status: 'error', message: 'Gagal memperbarui harga cetak di database', details: savedError.message },
        { status: 500 }
      );
    }

    const formatRupiah = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(nominal);

    return NextResponse.json(
      {
        status: 'success',
        message: `Harga cetak berhasil diperbarui menjadi ${formatRupiah} per cetakan!`,
        data: {
          id: savedData.id,
          harga: Number(savedData.harga),
          harga_rupiah: formatRupiah,
          created_at: savedData.created_at,
          berlaku_sejak: savedData.created_at,
          waktu_wib: formatToWibDisplay(savedData.created_at),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Terjadi kesalahan sistem saat menyimpan harga', details: String(error) },
      { status: 500 }
    );
  }
}
