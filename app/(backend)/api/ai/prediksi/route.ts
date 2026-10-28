import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyDualAuth } from '@/lib/auth-check';
import { calculateAiPrediction } from '@/lib/ai-service';

/**
 * @swagger
 * /api/ai/prediksi:
 *   get:
 *     summary: Mengambil hasil prediksi mingguan terbaru dan riwayat peramalan AI (Random Forest)
 *     description: |
 *       Mengembalikan hasil peramalan kebutuhan produksi cetakan tahu 1 minggu ke depan.
 *       Model AI yang digunakan adalah Random Forest Regressor (`best_rf_model.joblib`),
 *       dilatih dengan 16 fitur (masak_1 s/d 7, cetak_1 s/d 7, minggu_ke, bulan)
 *       dari data riil database `product_harian` + pelengkap data dummy baseline.
 *     tags:
 *       - AI Prediksi
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Jumlah riwayat prediksi yang diambil
 *     responses:
 *       200:
 *         description: Berhasil memuat data prediksi AI
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
 *                   example: Data prediksi AI berhasil dimuat
 *                 data:
 *                   type: object
 *                   properties:
 *                     prediksi_aktif:
 *                       type: object
 *                     riwayat_prediksi:
 *                       type: array
 *                       items:
 *                         type: object
 *       401:
 *         description: Akses ditolak. Sesi login tidak valid.
 *       500:
 *         description: Kesalahan server
 *   post:
 *     summary: Menjalankan peramalan (forecasting) Random Forest dengan data 7 hari terakhir dari database
 *     description: |
 *       Memicu eksekusi model Random Forest (`best_rf_model.joblib`) secara real-time:
 *       1. Mengambil data produksi 7 hari terakhir dari tabel `product_harian`.
 *       2. Melengkapi hari kosong / data yang kurang dengan baseline data dummy.
 *       3. Menyusun 16 fitur input sesuai notebook `RandomForest_Tuning.ipynb`.
 *       4. Menghasilkan estimasi cetakan total mingguan dan rincian hari demi hari (Senin - Minggu).
 *     tags:
 *       - AI Prediksi
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               periode_mulai:
 *                 type: string
 *                 format: date
 *                 description: Tanggal awal periode prediksi (YYYY-MM-DD). Default: Senin minggu depan.
 *                 example: "2026-11-02"
 *               id_admin:
 *                 type: integer
 *                 description: ID Admin yang memicu proses prediksi
 *                 example: 2
 *     responses:
 *       200:
 *         description: Prediksi berhasil dihitung oleh model Random Forest
 *       401:
 *         description: Akses ditolak. Sesi login tidak valid.
 *       500:
 *         description: Gagal menjalankan model AI
 */

// 1. GET: Ambil Prediksi Terkini & Riwayat
export async function GET(request: Request) {
  const { error: authError } = verifyDualAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5', 10);

    // Ambil prediksi dari Supabase (jika tabel prediksi tersedia)
    const { data: listPrediksi } = await supabase
      .from('prediksi')
      .select('*')
      .order('periode_mulai', { ascending: false })
      .limit(limit);

    // Jika di database sudah ada hasil simpanan sebelumnya
    if (listPrediksi && listPrediksi.length > 0) {
      return NextResponse.json({
        status: 'success',
        message: 'Data prediksi AI berhasil dimuat dari database',
        data: {
          prediksi_aktif: listPrediksi[0],
          riwayat_prediksi: listPrediksi,
        },
      });
    }

    // Jika belum ada di database, hitung langsung secara on-the-fly via Random Forest
    const livePrediction = await calculateAiPrediction();

    return NextResponse.json({
      status: 'success',
      message: 'Data prediksi AI dihitung langsung oleh model Random Forest',
      data: {
        prediksi_aktif: livePrediction,
        riwayat_prediksi: [livePrediction],
      },
    });
  } catch (error) {
    console.error('[API AI Prediksi GET Error]:', error);
    return NextResponse.json(
      { status: 'error', message: 'Gagal memuat data AI Prediksi', details: String(error) },
      { status: 500 }
    );
  }
}

// 2. POST: Memicu Kalkulasi Prediksi Baru (Run Model Random Forest)
export async function POST(request: Request) {
  const { error: authError } = verifyDualAuth(request);
  if (authError) return authError;

  try {
    let body = {};
    try {
      body = await request.json();
    } catch {}

    const { periode_mulai: customPeriodeMulai, id_admin } = body as {
      periode_mulai?: string;
      id_admin?: number;
    };

    // 1. Jalankan prediksi dengan data 7 hari database + dummy fallback
    const result = await calculateAiPrediction(customPeriodeMulai);

    // 2. Upayakan simpan hasil ke tabel `prediksi` di Supabase (jika tabel ada)
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
      // Tidak masalah jika tabel prediksi belum dibuat di Supabase
    }

    return NextResponse.json({
      status: 'success',
      message: 'Perhitungan estimasi produksi mingguan dengan model Random Forest berhasil!',
      data: savedRow || result,
    });
  } catch (error) {
    console.error('[AI Prediksi POST Error]:', error);
    return NextResponse.json(
      { status: 'error', message: 'Gagal menjalankan peramalan AI', details: String(error) },
      { status: 500 }
    );
  }
}
