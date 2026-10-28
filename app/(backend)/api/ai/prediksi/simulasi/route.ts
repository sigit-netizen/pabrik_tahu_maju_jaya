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
 *     summary: Menjalankan simulasi peramalan AI (Mendukung Format Kolom Dataset CSV & Format Array)
 *     description: |
 *       Mendukung 2 format input:
 *       1. **Format Kolom Dataset CSV Langsung**: Mengirim kolom `masak_1..7`, `cetak_1..7`, dan `tanggal` persis seperti baris `DatasetPenjualanTahuv3.csv`.
 *       2. **Format Array Harian**: Mengirim `data_simulasi` berisi 7 hari objek `{ hari, jumlah_masak, jumlah_cetak }`.
 *       3. **Format Kosong `{}`**: Jika body kosong, sistem otomatis memakai data dummy bawaan (Row #0 dataset).
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
 *                 example: "01-07/04/2025"
 *                 description: "Format rentang tanggal seperti di dataset CSV ('01-07/04/2025') atau tanggal ISO YYYY-MM-DD"
 *               masak_1:
 *                 type: number
 *                 example: 34
 *               cetak_1:
 *                 type: number
 *                 example: 202
 *               masak_2:
 *                 type: number
 *                 example: 31
 *               cetak_2:
 *                 type: number
 *                 example: 184
 *               masak_3:
 *                 type: number
 *                 example: 33
 *               cetak_3:
 *                 type: number
 *                 example: 200
 *               masak_4:
 *                 type: number
 *                 example: 32
 *               cetak_4:
 *                 type: number
 *                 example: 193
 *               masak_5:
 *                 type: number
 *                 example: 32
 *               cetak_5:
 *                 type: number
 *                 example: 193
 *               masak_6:
 *                 type: number
 *                 example: 33
 *               cetak_6:
 *                 type: number
 *                 example: 197
 *               masak_7:
 *                 type: number
 *                 example: 25
 *               cetak_7:
 *                 type: number
 *                 example: 150
 *               data_simulasi:
 *                 type: array
 *                 description: "Alternatif jika menggunakan format array 7 hari"
 *                 items:
 *                   type: object
 *           example:
 *             tanggal: "01-07/04/2025"
 *             masak_1: 34
 *             cetak_1: 202
 *             masak_2: 31
 *             cetak_2: 184
 *             masak_3: 33
 *             cetak_3: 200
 *             masak_4: 32
 *             cetak_4: 193
 *             masak_5: 32
 *             cetak_5: 193
 *             masak_6: 33
 *             cetak_6: 197
 *             masak_7: 25
 *             cetak_7: 150
 *     responses:
 *       200:
 *         description: Simulasi berhasil dieksekusi dengan model Random Forest
 *       400:
 *         description: Validasi gagal (data tidak sesuai aturan 7 hari)
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
    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {}

    // Jika user mengirimkan format baris dataset CSV langsung (masak_1..7, cetak_1..7)
    if ('masak_1' in body && 'cetak_7' in body) {
      const { executePythonModel } = await import('@/lib/ai-service');
      const result = await executePythonModel(body);
      return NextResponse.json({
        status: 'success',
        message: 'Simulasi peramalan AI dengan format kolom dataset CSV berhasil dieksekusi',
        data: result,
      });
    }

    const { periode_mulai, data_simulasi, tanggal } = body as {
      periode_mulai?: string;
      tanggal?: string;
      data_simulasi?: Array<{
        hari?: string;
        tanggal?: string;
        jumlah_masak: number;
        jumlah_cetak: number;
      }>;
    };

    const result = await calculateAiPrediction({
      mode: 'simulasi',
      tanggal,
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
