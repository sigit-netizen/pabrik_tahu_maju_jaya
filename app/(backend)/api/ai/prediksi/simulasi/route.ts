import { NextResponse } from 'next/server';
import { verifyDualAuth } from '@/lib/auth-check';
import { calculateAiPrediction, AiValidationError, DEFAULT_PRESET_DUMMY_7_HARI } from '@/lib/ai-service';

/**
 * @swagger
 * /api/ai/prediksi/simulasi:
 *   get:
 *     summary: Simulasi peramalan AI dengan data dummy bawaan (Otomatis & Siap Pakai)
 *     description: |
 *       Menjalankan model Random Forest (`best_rf_model.joblib`) menggunakan **data dummy 7 hari bawaan sistem**.
 *       
 *       **Keunggulan:**
 *       - Langsung klik "Execute" tanpa perlu mengisi data apa pun secara manual.
 *       - Berguna untuk menguji peramalan AI ketika database belum memiliki 7 hari data riil.
 *     tags:
 *       - AI Prediksi
 *     parameters:
 *       - in: query
 *         name: periode_mulai
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-11-02"
 *         description: "Tanggal awal periode yang ingin diprediksi (opsional, default: Senin depan)"
 *     responses:
 *       200:
 *         description: Simulasi prediksi AI berhasil dijalankan dengan data dummy
 *       400:
 *         description: Parameter input tidak valid
 *       401:
 *         description: Akses ditolak. Sesi login tidak valid.
 *       500:
 *         description: Kesalahan server
 *   post:
 *     summary: Menjalankan simulasi peramalan AI (Data dummy sudah terisi otomatis di request body)
 *     description: |
 *       Memicu simulasi peramalan Random Forest.
 *       Request body sudah menyertakan contoh data dummy 7 hari siap pakai.
 *       Bahkan jika dikirim body kosong `{}`, sistem otomatis menggunakan preset dummy 7 hari.
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
 *                 example: "2026-11-02"
 *                 description: "Tanggal awal periode 1 minggu ke depan yang ingin diprediksi"
 *               data_simulasi:
 *                 type: array
 *                 description: "Array data dummy 7 hari (sudah terisi otomatis, tidak perlu ketik manual)"
 *                 items:
 *                   type: object
 *                   properties:
 *                     hari:
 *                       type: string
 *                     jumlah_masak:
 *                       type: number
 *                     jumlah_cetak:
 *                       type: number
 *           example:
 *             periode_mulai: "2026-11-02"
 *             data_simulasi:
 *               - hari: "Senin"
 *                 jumlah_masak: 34
 *                 jumlah_cetak: 202
 *               - hari: "Selasa"
 *                 jumlah_masak: 31
 *                 jumlah_cetak: 184
 *               - hari: "Rabu"
 *                 jumlah_masak: 33
 *                 jumlah_cetak: 200
 *               - hari: "Kamis"
 *                 jumlah_masak: 32
 *                 jumlah_cetak: 193
 *               - hari: "Jumat"
 *                 jumlah_masak: 32
 *                 jumlah_cetak: 193
 *               - hari: "Sabtu"
 *                 jumlah_masak: 33
 *                 jumlah_cetak: 197
 *               - hari: "Minggu"
 *                 jumlah_masak: 35
 *                 jumlah_cetak: 211
 *     responses:
 *       200:
 *         description: Simulasi berhasil dieksekusi dengan data dummy
 *       400:
 *         description: Validasi gagal (data_simulasi tidak tepat 7 hari)
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
    const periodeMulai = searchParams.get('periode_mulai') || undefined;

    const result = await calculateAiPrediction({
      mode: 'simulasi',
      periode_mulai: periodeMulai,
    });

    return NextResponse.json({
      status: 'success',
      message: 'Simulasi peramalan AI dengan data dummy bawaan berhasil dijalankan',
      data: result,
      preset_dummy_tersedia: DEFAULT_PRESET_DUMMY_7_HARI,
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

    const { periode_mulai, data_simulasi } = body as {
      periode_mulai?: string;
      data_simulasi?: Array<{
        hari?: string;
        tanggal?: string;
        jumlah_masak: number;
        jumlah_cetak: number;
      }>;
    };

    const result = await calculateAiPrediction({
      mode: 'simulasi',
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
