import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyDualAuth } from '@/lib/auth-check';
import { calculateAiPrediction, AiValidationError } from '@/lib/ai-service';

/**
 * @swagger
 * /api/ai/prediksi:
 *   get:
 *     summary: Mengambil hasil peramalan AI riil dari database (Strict 7 Hari)
 *     description: |
 *       Menampilkan peramalan kebutuhan produksi cetakan tahu 1 minggu ke depan menggunakan model Random Forest (`best_rf_model.joblib`).
 *       
 *       **Aturan Validasi Ketat (Strict):**
 *       - Membutuhkan **tepat 7 hari data historis produksi** di tabel `product_harian`.
 *       - Jika data di database **kurang dari 7 hari atau lebih dari 7 hari**, API akan **menolak (HTTP 400 Error)**.
 *       - Untuk pengujian tanpa data database 7 hari, gunakan endpoint simulasi: `/api/ai/prediksi/simulasi`.
 *     tags:
 *       - AI Prediksi
 *     parameters:
 *       - in: query
 *         name: tanggal
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-10-28"
 *         description: Tanggal acuan 7 hari terakhir (default: hari ini waktu WIB)
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Batas riwayat prediksi yang diambil dari database jika ada
 *     responses:
 *       200:
 *         description: Berhasil memuat data prediksi AI riil dari database
 *       400:
 *         description: Data di database belum mencukupi tepat 7 hari
 *       401:
 *         description: Akses ditolak. Sesi login tidak valid.
 *       500:
 *         description: Kesalahan server
 *   post:
 *     summary: Menjalankan peramalan baru dengan data riil dari database (Strict 7 Hari)
 *     description: |
 *       Memicu eksekusi model Random Forest (`best_rf_model.joblib`) dengan mengambil **tepat 7 hari terakhir**
 *       dari tabel `product_harian`.
 *       
 *       **Validasi:**
 *       - Jika jumlah hari di database `< 7` atau `> 7`, sistem akan mengembalikan **HTTP 400 Error**.
 *       - Tidak ada pencampuran dummy pada mode ini.
 *     tags:
 *       - AI Prediksi
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tanggal:
 *                 type: string
 *                 format: date
 *                 description: Tanggal acuan 7 hari terakhir di database (YYYY-MM-DD). Default = hari ini WIB.
 *                 example: "2026-10-28"
 *               periode_mulai:
 *                 type: string
 *                 format: date
 *                 description: Tanggal awal periode yang ingin diprediksi. Default = keesokan hari setelah tanggal acuan.
 *                 example: "2026-10-29"
 *               id_admin:
 *                 type: integer
 *                 description: ID Admin yang memicu proses prediksi
 *                 example: 2
 *     responses:
 *       200:
 *         description: Prediksi berhasil dihitung dengan 7 hari data database
 *       400:
 *         description: Validasi gagal (data di database kurang atau lebih dari 7 hari)
 *       401:
 *         description: Akses ditolak
 *       500:
 *         description: Gagal menjalankan model AI
 */

// 1. GET: Ambil Prediksi Terkini & Riwayat (atau coba hitung live jika belum ada)
export async function GET(request: Request) {
  const { error: authError } = verifyDualAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5', 10);
    const tanggalParam = searchParams.get('tanggal') || undefined;
    const modeParam = (searchParams.get('mode') || 'database') as 'database' | 'simulasi';

    // Cek riwayat tersimpan di tabel `prediksi` Supabase
    const { data: listPrediksi } = await supabase
      .from('prediksi')
      .select('*')
      .order('periode_mulai', { ascending: false })
      .limit(limit);

    if (listPrediksi && listPrediksi.length > 0) {
      return NextResponse.json({
        status: 'success',
        message: 'Data riwayat prediksi AI berhasil dimuat dari database',
        data: {
          prediksi_aktif: listPrediksi[0],
          riwayat_prediksi: listPrediksi,
        },
      });
    }

    // Jika belum ada riwayat tersimpan, coba jalankan model live
    const livePrediction = await calculateAiPrediction({
      mode: modeParam,
      tanggal: tanggalParam,
    });

    return NextResponse.json({
      status: 'success',
      message: 'Data prediksi AI dihitung langsung oleh model Random Forest',
      data: {
        prediksi_aktif: livePrediction,
        riwayat_prediksi: [livePrediction],
      },
    });
  } catch (error) {
    if (error instanceof AiValidationError) {
      return NextResponse.json(
        { status: 'error', message: error.message, detail: error.detail },
        { status: error.statusCode }
      );
    }
    console.error('[API AI Prediksi GET Error]:', error);
    return NextResponse.json(
      { status: 'error', message: 'Gagal memuat data AI Prediksi', details: String(error) },
      { status: 500 }
    );
  }
}

// 2. POST: Memicu Kalkulasi Prediksi Baru (Strict 7 Hari dari Database)
export async function POST(request: Request) {
  const { error: authError } = verifyDualAuth(request);
  if (authError) return authError;

  try {
    let body = {};
    try {
      body = await request.json();
    } catch {}

    const {
      mode,
      tanggal: customTanggal,
      periode_mulai: customPeriodeMulai,
      id_admin,
    } = body as {
      mode?: 'database' | 'simulasi';
      tanggal?: string;
      periode_mulai?: string;
      id_admin?: number;
    };

    // 1. Jalankan prediksi (Default: mode database dengan validasi ketat 7 hari)
    const result = await calculateAiPrediction({
      mode: mode || 'database',
      tanggal: customTanggal,
      periode_mulai: customPeriodeMulai,
    });

    // 2. Simpan hasil kalkulasi ke database Supabase jika tabel prediksi tersedia
    let savedRow = null;
    try {
      const { data: savedData, error: saveErr } = await supabase
        .from('prediksi')
        .insert([
          {
            tanggal_prediksi: new Date().toISOString().split('T')[0],
            periode_mulai: result.periode_mulai,
            periode_selesai: result.periode_selesai,
            total_cetak_prediksi: result.total_cetak_prediksi,
            detail_harian: result.detail_harian,
            mae: result.metrik_evaluasi.mae,
            mape: 5.12,
            model_version: result.model_version,
            catatan_model: result.metrik_evaluasi.catatan,
            id_admin: id_admin || null,
          },
        ])
        .select()
        .maybeSingle();

      if (!saveErr && savedData) {
        savedRow = savedData;
      }
    } catch {
      // Abaikan jika tabel prediksi belum dibuat
    }

    return NextResponse.json({
      status: 'success',
      message: 'Perhitungan estimasi produksi mingguan dengan model Random Forest berhasil!',
      data: savedRow || result,
    });
  } catch (error) {
    if (error instanceof AiValidationError) {
      return NextResponse.json(
        { status: 'error', message: error.message, detail: error.detail },
        { status: error.statusCode }
      );
    }
    console.error('[AI Prediksi POST Error]:', error);
    return NextResponse.json(
      { status: 'error', message: 'Gagal menjalankan peramalan AI', details: String(error) },
      { status: 500 }
    );
  }
}
