import { NextResponse } from 'next/server';
import { verifyDualAuth } from '@/lib/auth-check';
import { calculateAiPrediction, AiValidationError } from '@/lib/ai-service';

/**
 * @swagger
 * /api/ai/prediksi/simulasi:
 *   get:
 *     summary: Simulasi peramalan AI menggunakan sampel data dummy (DatasetPenjualanTahuv3.csv)
 *     description: |
 *       Menjalankan model Random Forest (`best_rf_model.joblib`) menggunakan **data dummy**
 *       dari baris dataset pelatihan `DatasetPenjualanTahuv3.csv`.
 *       
 *       **Kegunaan:**
 *       - Memungkinkan pengujian/demo model AI tanpa memerlukan 7 hari data riil di tabel `product_harian`.
 *       - Setiap baris simulasi memiliki tepat 7 hari historis (`masak_1..7`, `cetak_1..7`).
 *     tags:
 *       - AI Prediksi
 *     parameters:
 *       - in: query
 *         name: row_index
 *         required: false
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Nomor indeks baris sampel di DatasetPenjualanTahuv3.csv (0 s/d 389)
 *       - in: query
 *         name: periode_mulai
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-11-02"
 *         description: Tanggal awal periode yang ingin diprediksi
 *     responses:
 *       200:
 *         description: Simulasi prediksi AI berhasil dijalankan dengan data dummy
 *       400:
 *         description: Parameter input simulasi tidak valid
 *       401:
 *         description: Akses ditolak. Sesi login tidak valid.
 *       500:
 *         description: Kesalahan server
 *   post:
 *     summary: Menjalankan simulasi peramalan AI dengan parameter kustom atau data dummy
 *     description: |
 *       Memicu simulasi prediksi Random Forest. Dapat menggunakan baris dataset `DatasetPenjualanTahuv3.csv`
 *       atau mengirimkan array kustom data produksi 7 hari untuk disimulasikan.
 *     tags:
 *       - AI Prediksi
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dummy_row_index:
 *                 type: integer
 *                 default: 0
 *                 description: Indeks baris sampel dataset (0 s/d 389)
 *                 example: 0
 *               periode_mulai:
 *                 type: string
 *                 format: date
 *                 example: "2026-11-02"
 *               data_simulasi:
 *                 type: array
 *                 description: Opsional, jika ingin mengirimkan array 7 hari kustom (HARUS tepat 7 hari)
 *                 items:
 *                   type: object
 *                   properties:
 *                     tanggal:
 *                       type: string
 *                     jumlah_masak:
 *                       type: number
 *                     jumlah_cetak:
 *                       type: number
 *     responses:
 *       200:
 *         description: Simulasi berhasil dieksekusi
 *       400:
 *         description: Validasi gagal (misal data_simulasi kurang atau lebih dari 7 hari)
 *       401:
 *         description: Akses ditolak
 *       500:
 *         description: Kesalahan server
 */

export async function GET(request: Request) {
  const { error: authError } = verifyDualAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const rowIndex = parseInt(searchParams.get('row_index') || '0', 10);
    const periodeMulai = searchParams.get('periode_mulai') || undefined;

    const result = await calculateAiPrediction({
      mode: 'simulasi',
      dummy_row_index: rowIndex,
      periode_mulai: periodeMulai,
    });

    return NextResponse.json({
      status: 'success',
      message: 'Simulasi peramalan AI dengan data dummy berhasil dijalankan',
      data: result,
    });
  } catch (error) {
    if (error instanceof AiValidationError) {
      return NextResponse.json(
        { status: 'error', message: error.message, detail: error.detail },
        { status: error.statusCode }
      );
    }
    console.error('[API AI Simulasi GET Error]:', error);
    return NextResponse.json(
      { status: 'error', message: 'Gagal menjalankan simulasi AI', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { error: authError } = verifyDualAuth(request);
  if (authError) return authError;

  try {
    let body = {};
    try {
      body = await request.json();
    } catch {}

    const { dummy_row_index, periode_mulai, data_simulasi } = body as {
      dummy_row_index?: number;
      periode_mulai?: string;
      data_simulasi?: Array<{
        tanggal?: string;
        jumlah_masak: number;
        jumlah_cetak: number;
      }>;
    };

    const result = await calculateAiPrediction({
      mode: 'simulasi',
      dummy_row_index: dummy_row_index ?? 0,
      periode_mulai,
      data_simulasi,
    });

    return NextResponse.json({
      status: 'success',
      message: 'Simulasi peramalan AI dengan data dummy berhasil dieksekusi',
      data: result,
    });
  } catch (error) {
    if (error instanceof AiValidationError) {
      return NextResponse.json(
        { status: 'error', message: error.message, detail: error.detail },
        { status: error.statusCode }
      );
    }
    console.error('[API AI Simulasi POST Error]:', error);
    return NextResponse.json(
      { status: 'error', message: 'Gagal menjalankan simulasi AI', details: String(error) },
      { status: 500 }
    );
  }
}
