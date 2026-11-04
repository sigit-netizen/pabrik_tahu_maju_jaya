import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyDualAuth } from '@/lib/auth-check';
import { toWibTimestamp, formatToWibDate, formatToWibDisplay, getWibDayRange } from '@/lib/date-helper';

/**
 * @swagger
 * /api/produksi/input:
 *   post:
 *     summary: Menyimpan data produksi harian beserta rincian per pelanggan (WIB Timezone)
 *     description: |
 *       Menerima 1 form per hari yang berisi array rincian pesanan per pelanggan.
 *       Mendukung input tanggal spesifik (opsional, default: hari ini waktu WIB).
 *       API akan:
 *       1. Menggunakan tanggal dari FE atau waktu lokal WIB (UTC+7)
 *       2. Ambil harga terkini dari tabel harga_cetak (sebagai acuan / fallback)
 *       3. Gunakan `total` dari FE jika ada (sudah dihitung via /api/produksi/hitung)
 *          → jika tidak ada, hitung otomatis: total = jumlah_cetak × harga
 *       4. Simpan semua baris ke rincian_product_harian dengan timestamp WIB
 *       5. Simpan baris header rekap ke product_harian dengan timestamp WIB
 *     tags:
 *       - Produksi
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rincian
 *             properties:
 *               tanggal:
 *                 type: string
 *                 format: date
 *                 description: Tanggal produksi (YYYY-MM-DD). Opsional, default hari ini (WIB).
 *                 example: "2026-10-17"
 *               rincian:
 *                 type: array
 *                 description: Array daftar pesanan pelanggan hari ini
 *                 items:
 *                   type: object
 *                   required:
 *                     - nama
 *                     - jumlah_cetak
 *                     - jumlah_masak
 *                   properties:
 *                     nama:
 *                       type: string
 *                       description: Nama pelanggan/pembeli
 *                       example: "Bu Sari"
 *                     jumlah_cetak:
 *                       type: integer
 *                       description: Jumlah cetakan tahu yang dipesan pelanggan ini
 *                       example: 50
 *                     jumlah_masak:
 *                       type: integer
 *                       description: Jumlah kali masak untuk pelanggan ini
 *                       example: 5
 *                     total:
 *                       type: integer
 *                       description: |
 *                         Total harga (Rp) untuk pelanggan ini — OPSIONAL.
 *                         Jika FE sudah menghitung via /api/produksi/hitung, kirimkan di sini.
 *                         Jika tidak dikirim, API akan menghitung otomatis (jumlah_cetak × harga aktif).
 *                       example: 100000
 *           example:
 *             tanggal: "2026-10-17"
 *             rincian:
 *               - nama: "Bu Sari"
 *                 jumlah_cetak: 50
 *                 jumlah_masak: 5
 *                 total: 100000
 *               - nama: "Pak Budi"
 *                 jumlah_cetak: 30
 *                 jumlah_masak: 3
 *                 total: 60000
 *     responses:
 *       201:
 *         description: Data produksi harian berhasil disimpan
 *       400:
 *         description: Validasi gagal
 *       401:
 *         description: Belum login atau API Key tidak valid
 *       404:
 *         description: Harga cetak belum diatur di database
 *       500:
 *         description: Kesalahan server
 */
export async function POST(request: Request) {
  // ── KEAMANAN GANDA: wajib login + api app key ──────────────────────────────
  const { error: authError, user } = verifyDualAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();

    // ── TIPE DATA: menerima tanggal dan array rincian ────────────────────────
    const { rincian, tanggal } = body as {
      tanggal?: string; // Format: "YYYY-MM-DD", misal "2026-10-17"
      rincian: Array<{
        nama: string;
        jumlah_cetak: number;
        jumlah_masak: number;
        total?: number; // FE mengirimkan ini setelah hitung via /hitung — opsional
      }>;
    };

    // ── VALIDASI INPUT ────────────────────────────────────────────────────────
    if (!Array.isArray(rincian) || rincian.length === 0) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Field "rincian" wajib berupa array dan tidak boleh kosong!',
          contoh_format: {
            tanggal: '2026-10-17',
            rincian: [
              { nama: 'Bu Sari', jumlah_cetak: 50, jumlah_masak: 5, total: 100000 },
              { nama: 'Pak Budi', jumlah_cetak: 30, jumlah_masak: 3, total: 60000 },
            ],
          },
        },
        { status: 400 }
      );
    }

    // Validasi format tanggal jika dikirim
    if (tanggal && !/^\d{4}-\d{2}-\d{2}$/.test(tanggal.trim())) {
      return NextResponse.json(
        { status: 'error', message: 'Format tanggal harus YYYY-MM-DD (contoh: 2026-10-17)!' },
        { status: 400 }
      );
    }

    // Validasi setiap baris rincian
    for (let i = 0; i < rincian.length; i++) {
      const item = rincian[i];
      if (!item.nama || typeof item.nama !== 'string' || item.nama.trim() === '') {
        return NextResponse.json(
          { status: 'error', message: `Baris ke-${i + 1}: Nama pelanggan tidak boleh kosong!` },
          { status: 400 }
        );
      }

      const jumlahCetak = Number(item.jumlah_cetak);
      if (
        item.jumlah_cetak === undefined ||
        item.jumlah_cetak === null ||
        String(item.jumlah_cetak).trim() === '' ||
        isNaN(jumlahCetak) ||
        jumlahCetak <= 0
      ) {
        return NextResponse.json(
          {
            status: 'error',
            message: `Baris ke-${i + 1} (${item.nama}): jumlah_cetak tidak boleh kosong atau 0! Harus bernilai lebih dari 0.`,
          },
          { status: 400 }
        );
      }

      const jumlahMasak = Number(item.jumlah_masak);
      if (
        item.jumlah_masak === undefined ||
        item.jumlah_masak === null ||
        String(item.jumlah_masak).trim() === '' ||
        isNaN(jumlahMasak) ||
        jumlahMasak <= 0
      ) {
        return NextResponse.json(
          {
            status: 'error',
            message: `Baris ke-${i + 1} (${item.nama}): jumlah_masak tidak boleh kosong atau 0! Harus bernilai lebih dari 0.`,
          },
          { status: 400 }
        );
      }

      if (
        item.total !== undefined &&
        item.total !== null &&
        (isNaN(Number(item.total)) || Number(item.total) < 0)
      ) {
        return NextResponse.json(
          { status: 'error', message: `Baris ke-${i + 1} (${item.nama}): total tidak boleh negatif!` },
          { status: 400 }
        );
      }
    }

    // ── PENANGANAN TANGGAL & ZONA WAKTU WIB (UTC+7) ──────────────────────────
    // Timestamp ISO dengan offset +07:00 (WIB)
    const timestampWib = toWibTimestamp(tanggal);
    const tanggalWib = formatToWibDate(timestampWib);

    // ── LANGKAH 1: Ambil Harga Terkini dari tabel harga_cetak ────────────────
    const { data: hargaData, error: hargaError } = await supabase
      .from('harga_cetak')
      .select('id, harga')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (hargaError) {
      return NextResponse.json(
        { status: 'error', message: 'Gagal membaca harga cetak dari database', details: hargaError.message },
        { status: 500 }
      );
    }

    if (!hargaData || !hargaData.harga) {
      return NextResponse.json(
        {
          status: 'error',
          message:
            'Harga cetak belum diatur! Silakan atur harga per cetakan tahu terlebih dahulu di Menu Pengaturan.',
        },
        { status: 404 }
      );
    }

    const hargaPerCetak = Number(hargaData.harga);

    // ── LANGKAH 2: Bangun rows untuk rincian_product_harian ──────────────────
    let sumberTotal: 'dari_fe' | 'dihitung_api' = 'dihitung_api';
    const rowsRincian = rincian.map((item) => {
      const totalBaris =
        item.total !== undefined
          ? Number(item.total)
          : Number(item.jumlah_cetak) * hargaPerCetak;

      if (item.total !== undefined) sumberTotal = 'dari_fe';

      return {
        nama: item.nama.trim(),
        jumlah_cetak: Number(item.jumlah_cetak),
        jumlah_masak: Number(item.jumlah_masak),
        total: totalBaris,
        created_at: timestampWib, // Set eksplisit timestamp WIB ke kolom timestamptz
      };
    });

    // ── LANGKAH 3: Simpan semua baris rincian ke rincian_product_harian ──────
    const { data: savedRincian, error: rincianError } = await supabase
      .from('rincian_product_harian')
      .insert(rowsRincian)
      .select();

    if (rincianError) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Gagal menyimpan rincian produksi ke database',
          details: rincianError.message,
        },
        { status: 500 }
      );
    }

    // ── LANGKAH 4: Hitung Agregat Total Hari Ini ─────────────────────────────
    const totalCetakHariIni = rowsRincian.reduce((acc, r) => acc + r.jumlah_cetak, 0);
    const totalMasakHariIni = rowsRincian.reduce((acc, r) => acc + r.jumlah_masak, 0);
    const totalPendapatanHariIni = rowsRincian.reduce((acc, r) => acc + r.total, 0);

    // ── LANGKAH 5: Simpan Header Agregat ke product_harian ───────────────────
    const headerRow = {
      jumlah_cetak: totalCetakHariIni,
      jumlah_masak: totalMasakHariIni,
      jumlah_pendapatan: totalPendapatanHariIni,
      created_at: timestampWib, // Set eksplisit timestamp WIB
    };

    const { data: savedHeader, error: headerError } = await supabase
      .from('product_harian')
      .insert([headerRow])
      .select()
      .single();

    if (headerError) {
      console.error('[produksi/input] Gagal simpan header product_harian:', headerError.message);
      return NextResponse.json(
        {
          status: 'partial_success',
          message:
            'Rincian pelanggan berhasil disimpan, namun gagal membuat rekap harian.',
          data: {
            tanggal: tanggalWib,
            rincian: savedRincian,
            harga_digunakan: hargaPerCetak,
          },
          error_header: headerError.message,
        },
        { status: 207 }
      );
    }

    // ── SUKSES: Kembalikan semua data yang tersimpan dengan format waktu WIB ──
    return NextResponse.json(
      {
        status: 'success',
        message: `Data produksi tanggal ${tanggalWib} berhasil disimpan! (${rincian.length} pelanggan dicatat).`,
        data: {
          tanggal: tanggalWib,
          waktu_wib: formatToWibDisplay(timestampWib),
          header: savedHeader,
          rincian: (savedRincian || []).map((row) => ({
            ...row,
            tanggal: tanggalWib,
            total_rupiah: new Intl.NumberFormat('id-ID', {
              style: 'currency',
              currency: 'IDR',
              minimumFractionDigits: 0,
            }).format(Number(row.total) || 0),
          })),
          ringkasan: {
            tanggal: tanggalWib,
            total_pelanggan: rincian.length,
            total_cetak: totalCetakHariIni,
            total_masak: totalMasakHariIni,
            total_pendapatan_rp: totalPendapatanHariIni,
            harga_digunakan: hargaPerCetak,
            sumber_total: sumberTotal,
          },
          audit: {
            tanggal_wib: tanggalWib,
            waktu_input_wib: formatToWibDisplay(timestampWib),
            zona_waktu: 'Asia/Jakarta (WIB - UTC+7)',
            diinput_oleh: user?.username || 'admin',
            id_admin: user?.id || null,
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[produksi/input] Error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Terjadi kesalahan sistem saat menyimpan data produksi', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * @swagger
 * /api/produksi/input:
 *   get:
 *     summary: Mengambil rincian produksi hari ini (WIB) beserta harga aktif
 *     tags:
 *       - Produksi
 *     responses:
 *       200:
 *         description: Data rincian hari ini berhasil dimuat
 *       401:
 *         description: Belum login atau API Key tidak valid
 */
export async function GET(request: Request) {
  const { error: authError } = verifyDualAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('tanggal'); // Opsional ?tanggal=YYYY-MM-DD
    const targetDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : formatToWibDate(new Date().toISOString());

    const { startWib, endWib } = getWibDayRange(targetDate);

    // Ambil harga aktif saat ini
    const { data: hargaData } = await supabase
      .from('harga_cetak')
      .select('id, harga, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Ambil rincian pesanan pada tanggal tersebut
    const { data: rincianHariIni, error } = await supabase
      .from('rincian_product_harian')
      .select('*')
      .gte('created_at', startWib)
      .lte('created_at', endWib)
      .order('created_at', { ascending: true });

    // Ambil header rekap harian pada tanggal tersebut
    const { data: headerHariIni } = await supabase
      .from('product_harian')
      .select('*')
      .gte('created_at', startWib)
      .lte('created_at', endWib)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { status: 'error', message: 'Gagal memuat data rincian produksi', details: error.message },
        { status: 500 }
      );
    }

    const formatRupiah = (val: number) =>
      new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
      }).format(val || 0);

    const rincianFormatted = (rincianHariIni || []).map((row) => ({
      ...row,
      tanggal: formatToWibDate(row.created_at),
      waktu_wib: formatToWibDisplay(row.created_at),
      total_rupiah: formatRupiah(Number(row.total) || 0),
    }));

    return NextResponse.json({
      status: 'success',
      data: {
        tanggal: targetDate,
        harga_aktif: hargaData || null,
        header_hari_ini: headerHariIni
          ? {
              ...headerHariIni,
              tanggal: formatToWibDate(headerHariIni.created_at),
              waktu_wib: formatToWibDisplay(headerHariIni.created_at),
              total_pendapatan_rupiah: formatRupiah(Number(headerHariIni.jumlah_pendapatan) || 0),
            }
          : null,
        rincian_hari_ini: rincianFormatted,
        jumlah_pelanggan: rincianFormatted.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Terjadi kesalahan sistem', details: String(error) },
      { status: 500 }
    );
  }
}
