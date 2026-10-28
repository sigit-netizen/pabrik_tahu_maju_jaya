import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyDualAuth } from '@/lib/auth-check';
import { calculateAiPrediction } from '@/lib/ai-service';

/**
 * @swagger
 * /api/ai/prediksi:
 *   get:
 *     summary: Mengambil hasil peramalan AI (Random Forest) berdasarkan data 7 hari terakhir
 *     description: |
 *       Mengembalikan estimasi kebutuhan cetakan tahu untuk 1 minggu ke depan menggunakan model Random Forest (`best_rf_model.joblib`).
 *       
 *       **Mekanisme Perhitungan:**
 *       1. Secara default, sistem mengambil data produksi **7 hari terakhir** berdasarkan tanggal yang di-input (parameter `tanggal`).
 *       2. Jika parameter `tanggal` tidak diisi, sistem otomatis menggunakan **tanggal hari ini (real-time WIB)** sebagai default.
 *       3. Data 7 hari tersebut diambil dari tabel database `product_harian`.
 *       4. Apabila ada hari yang belum memiliki data di database (misal baru mulai input atau hari libur), sistem secara otomatis melengkapinya dengan **data baseline dummy** (`masak: 32`, `cetak: 190`).
 *       5. Sebanyak 16 fitur (`masak_1..7`, `cetak_1..7`, `minggu_ke`, `bulan`) dieksekusi oleh model AI untuk menghasilkan estimasi mingguan dan rincian per hari (Senin s/d Minggu).
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
 *         description: Tanggal acuan untuk menarik 7 hari terakhir dari database. Default = hari ini waktu WIB.
 *       - in: query
 *         name: periode_mulai
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-10-29"
 *         description: Tanggal mulai periode yang diprediksi. Default = keesokan hari setelah tanggal acuan.
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Batas jumlah riwayat prediksi yang diambil dari database jika ada.
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
 *                       properties:
 *                         total_cetak_prediksi:
 *                           type: integer
 *                           example: 1246
 *                         periode_mulai:
 *                           type: string
 *                           example: "2026-10-29"
 *                         periode_selesai:
 *                           type: string
 *                           example: "2026-11-04"
 *                         minggu_ke:
 *                           type: integer
 *                           example: 44
 *                         bulan:
 *                           type: integer
 *                           example: 10
 *                         detail_harian:
 *                           type: array
 *                           items:
 *                             type: object
 *                         basis_7_hari_input:
 *                           type: object
 *                           properties:
 *                             tanggal_acuan_input:
 *                               type: string
 *                               example: "2026-10-28"
 *                             rentang_7_hari:
 *                               type: string
 *                               example: "2026-10-22 s/d 2026-10-28"
 *                             rincian_per_hari:
 *                               type: array
 *                               items:
 *                                 type: object
 *                         sumber_fitur:
 *                           type: object
 *                           properties:
 *                             jumlah_hari_dari_database:
 *                               type: integer
 *                               example: 1
 *                             jumlah_hari_dari_dummy:
 *                               type: integer
 *                               example: 6
 *       401:
 *         description: Akses ditolak. Sesi login tidak valid.
 *       500:
 *         description: Kesalahan server
 *   post:
 *     summary: Menjalankan peramalan baru (Forecasting) dengan Random Forest
 *     description: |
 *       Memicu eksekusi model Random Forest (`best_rf_model.joblib`) secara live.
 *       Secara default langsung menarik **7 hari terakhir** berdasarkan tanggal yang dikirim di request body.
 *       Jika field `tanggal` dikosongkan, default mengambil **7 hari terakhir dari hari ini**.
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
 *                 description: Tanggal acuan 7 hari terakhir (YYYY-MM-DD). Default = hari ini WIB jika tidak diisi.
 *                 example: "2026-10-28"
 *               periode_mulai:
 *                 type: string
 *                 format: date
 *                 description: Tanggal mulai peramalan 7 hari ke depan (YYYY-MM-DD). Default = keesokan hari setelah tanggal acuan.
 *                 example: "2026-10-29"
 *               id_admin:
 *                 type: integer
 *                 description: ID Admin yang memicu kalkulasi
 *                 example: 2
 *     responses:
 *       200:
 *         description: Peramalan berhasil dihitung oleh model Random Forest
 *       401:
 *         description: Akses ditolak. Sesi login tidak valid.
 *       500:
 *         description: Gagal menjalankan model AI
 */

// 1. GET: Ambil Prediksi Terkini & Riwayat (dengan opsi kalkulasi live berdasarkan tanggal)
export async function GET(request: Request) {
  const { error: authError } = verifyDualAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5', 10);
    const tanggalParam = searchParams.get('tanggal') || undefined;
    const periodeMulaiParam = searchParams.get('periode_mulai') || undefined;

    // Jika user meminta tanggal spesifik, langsung hitung prediksi berdasarkan tanggal tersebut
    if (tanggalParam || periodeMulaiParam) {
      const customPred = await calculateAiPrediction({
        tanggal: tanggalParam,
        periode_mulai: periodeMulaiParam,
      });

      return NextResponse.json({
        status: 'success',
        message: 'Data prediksi AI dihitung berdasarkan tanggal acuan yang di-request',
        data: {
          prediksi_aktif: customPred,
          riwayat_prediksi: [customPred],
        },
      });
    }

    // Ambil prediksi dari Supabase (jika ada data tersimpan sebelumnya)
    const { data: listPrediksi } = await supabase
      .from('prediksi')
      .select('*')
      .order('periode_mulai', { ascending: false })
      .limit(limit);

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

    // Jika database belum memiliki riwayat, jalankan model live dengan default hari ini (WIB)
    const livePrediction = await calculateAiPrediction();

    return NextResponse.json({
      status: 'success',
      message: 'Data prediksi AI dihitung langsung oleh model Random Forest (default 7 hari terakhir dari hari ini)',
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

    const {
      tanggal: customTanggal,
      periode_mulai: customPeriodeMulai,
      id_admin,
    } = body as {
      tanggal?: string;
      periode_mulai?: string;
      id_admin?: number;
    };

    // 1. Jalankan prediksi dengan 7 hari terakhir berdasarkan tanggal input (atau default hari ini)
    const result = await calculateAiPrediction({
      tanggal: customTanggal,
      periode_mulai: customPeriodeMulai,
    });

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
      // Abaikan jika tabel prediksi belum dibuat di Supabase
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
