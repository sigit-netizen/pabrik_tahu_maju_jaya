import { NextResponse } from 'next/server';
import { verifyDualAuth } from '@/lib/auth-check';
import { calculateAiPrediction, AiValidationError, DEFAULT_PRESET_DUMMY_7_HARI } from '@/lib/ai-service';

/**
 * @swagger
 * /api/ai/prediksi/simulasi:
 *   post:
 *     summary: Simulasi Peramalan AI dengan Data Dummy (Otomatis & Siap Pakai)
 *     description: |
 *       Mengeksekusi model **Random Forest ONNX (`best_rf_model.onnx`)** secara langsung via **ONNX Runtime (Node.js)** tanpa runtime Python.
 *       
 *       **Cara Pengujian:**
 *       1. **Otomatis (Tinggal Klik Execute)**: Kirim body kosong `{}` untuk langsung memakai preset data dummy 7 hari bawaan sistem (Row #0 dataset pelatihan).
 *       2. **Format Kolom Dataset CSV Langsung**: Mengirim kolom `masak_1..7`, `cetak_1..7`, dan `tanggal` persis seperti baris `DatasetPenjualanTahuv3.csv`.
 *       3. **Format Array Harian Kustom**: Mengirim array `data_simulasi` berisi tepat 7 hari objek `{ hari, jumlah_masak, jumlah_cetak }`.
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
 *                 description: "Alternatif jika menggunakan format array 7 hari kustom"
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
 *         description: Simulasi prediksi AI ONNX berhasil dieksekusi
 *       400:
 *         description: Validasi gagal (data kustom tidak tepat 7 hari)
 *       401:
 *         description: Akses ditolak. Sesi login tidak valid.
 *       500:
 *         description: Terjadi kesalahan server
 */

// 1. GET: Ambil hasil simulasi cepat data dummy (opsional / fallback browser)
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
      message: 'Simulasi peramalan AI (ONNX) dengan data dummy bawaan berhasil dijalankan',
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

// 2. POST: Menjalankan Simulasi Peramalan AI (ONNX)
export async function POST(request: Request) {
  const { error: authError } = verifyDualAuth(request);
  if (authError) return authError;

  try {
    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {}

    // Jalankan kalkulasi prediksi ONNX (Mendukung format kolom dataset langsung, array 7 hari, maupun body kosong {})
    const result = await calculateAiPrediction({
      mode: 'simulasi',
      ...body,
    });

    return NextResponse.json({
      status: 'success',
      message: 'Simulasi peramalan AI (ONNX) berhasil dieksekusi',
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
