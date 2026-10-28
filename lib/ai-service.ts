import { spawn } from 'child_process';
import path from 'path';
import { supabase } from '@/lib/supabase';
import { formatToWibDate, getWibTodayDate } from '@/lib/date-helper';

export interface DetailHarianPrediksi {
  hari: string;
  tanggal: string;
  estimasi_cetak: number;
}

export interface Basis7HariItem {
  urutan_hari: number;
  tanggal: string;
  hari: string;
  jumlah_masak: number;
  jumlah_cetak: number;
  sumber: string;
}

export interface AiPredictionResult {
  status: string;
  mode: 'database' | 'simulasi';
  model_version: string;
  total_cetak_prediksi: number;
  periode_mulai: string;
  periode_selesai: string;
  minggu_ke: number;
  bulan: number;
  detail_harian: DetailHarianPrediksi[];
  basis_7_hari_input: {
    sumber_data: string;
    rentang_7_hari: string;
    jumlah_hari_digunakan: number;
    rincian_per_hari: Basis7HariItem[];
  };
  metrik_evaluasi: {
    mae: number;
    r2_score: number;
    catatan: string;
  };
  fitur_input_16: Record<string, number>;
}

export interface CalculateOptions {
  mode?: 'database' | 'simulasi';
  tanggal?: string;
  periode_mulai?: string;
  data_simulasi?: Array<{
    hari?: string;
    tanggal?: string;
    jumlah_masak: number;
    jumlah_cetak: number;
  }>;
}

/**
 * Data Dummy 7 Hari Standar yang Sudah Disiapkan (Preset Otomatis)
 * Pengguna tidak perlu mengetik atau mengisi data secara manual.
 */
export const DEFAULT_PRESET_DUMMY_7_HARI = [
  { urutan_hari: 1, hari: 'Senin', jumlah_masak: 34, jumlah_cetak: 202 },
  { urutan_hari: 2, hari: 'Selasa', jumlah_masak: 31, jumlah_cetak: 184 },
  { urutan_hari: 3, hari: 'Rabu', jumlah_masak: 33, jumlah_cetak: 200 },
  { urutan_hari: 4, hari: 'Kamis', jumlah_masak: 32, jumlah_cetak: 193 },
  { urutan_hari: 5, hari: 'Jumat', jumlah_masak: 32, jumlah_cetak: 193 },
  { urutan_hari: 6, hari: 'Sabtu', jumlah_masak: 33, jumlah_cetak: 197 },
  { urutan_hari: 7, hari: 'Minggu', jumlah_masak: 35, jumlah_cetak: 211 },
];

export class AiValidationError extends Error {
  statusCode: number;
  detail: Record<string, unknown>;

  constructor(message: string, detail: Record<string, unknown> = {}) {
    super(message);
    this.name = 'AiValidationError';
    this.statusCode = 400;
    this.detail = detail;
  }
}

/**
 * Mengambil data produksi dari tabel `product_harian`
 * dan mengelompokkannya per tanggal WIB unik.
 */
export async function getHariProduksiDb(
  anchorDateStr?: string
): Promise<Array<{ tanggal: string; jumlah_masak: number; jumlah_cetak: number }>> {
  try {
    const targetDateStr = anchorDateStr ? anchorDateStr.slice(0, 10) : getWibTodayDate();
    const [ay, am, ad] = targetDateStr.split('-').map(Number);

    // Ambil rentang hingga 30 hari ke belakang dari tanggal acuan
    const startDate = new Date(Date.UTC(ay, am - 1, ad));
    startDate.setUTCDate(startDate.getUTCDate() - 30);
    const startIso = startDate.toISOString();

    const endDate = new Date(Date.UTC(ay, am - 1, ad));
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    const endIso = endDate.toISOString();

    const { data, error } = await supabase
      .from('product_harian')
      .select('created_at, jumlah_cetak, jumlah_masak')
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .order('created_at', { ascending: true });

    if (error || !data) {
      console.warn('[AIService] Gagal query product_harian:', error?.message);
      return [];
    }

    // Agregasi per tanggal (YYYY-MM-DD WIB)
    const map = new Map<string, { jumlah_masak: number; jumlah_cetak: number }>();
    data.forEach((row) => {
      const tgl = formatToWibDate(row.created_at);
      const cur = map.get(tgl) || { jumlah_masak: 0, jumlah_cetak: 0 };
      cur.jumlah_masak += Number(row.jumlah_masak) || 0;
      cur.jumlah_cetak += Number(row.jumlah_cetak) || 0;
      map.set(tgl, cur);
    });

    const result: Array<{ tanggal: string; jumlah_masak: number; jumlah_cetak: number }> = [];
    map.forEach((val, tgl) => {
      result.push({
        tanggal: tgl,
        jumlah_masak: val.jumlah_masak,
        jumlah_cetak: val.jumlah_cetak,
      });
    });

    result.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    return result;
  } catch (err) {
    console.warn('[AIService] Exception saat mengambil data produksi dari DB:', err);
    return [];
  }
}

/**
 * Menjalankan inference script Python (model/predict.py)
 */
export async function executePythonModel(payload: Record<string, unknown>): Promise<AiPredictionResult> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(process.cwd(), 'model', 'predict.py');

    const py = spawn('python', [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });

    let stdoutData = '';
    let stderrData = '';

    py.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString('utf-8');
    });

    py.stderr.on('data', (chunk) => {
      stderrData += chunk.toString('utf-8');
    });

    py.on('error', (err) => {
      reject(new Error(`Gagal memanggil binary Python: ${err.message}`));
    });

    py.on('close', (code) => {
      const output = stdoutData.trim();
      if (code !== 0) {
        return reject(
          new Error(`Python inference script exit code ${code}. Error: ${stderrData || output}`)
        );
      }

      try {
        const jsonResult = JSON.parse(output);
        if (jsonResult.status === 'error') {
          return reject(
            new AiValidationError(jsonResult.message || 'Error pada model inferensi Random Forest', {
              raw_error: jsonResult,
            })
          );
        }
        resolve(jsonResult as AiPredictionResult);
      } catch (parseErr) {
        reject(
          new Error(`Gagal parse output JSON dari Python: ${output}. Error: ${String(parseErr)}`)
        );
      }
    });

    py.stdin.write(JSON.stringify(payload));
    py.stdin.end();
  });
}

/**
 * Menjalankan peramalan AI:
 * - Mode 'database': Mengambil murni dari tabel `product_harian`. HARUS tepat 7 hari (jika < 7 atau > 7, reject 400).
 * - Mode 'simulasi': Menggunakan data dummy 7 hari bawaan sistem yang sudah terisi otomatis (siap pakai).
 */
export async function calculateAiPrediction(
  options: CalculateOptions = {}
): Promise<AiPredictionResult> {
  const mode = options.mode || 'database';

  // ── 1. MODE SIMULASI (DATA DUMMY OTOMATIS) ─────────────────────────────────
  if (mode === 'simulasi') {
    const payload: Record<string, unknown> = {
      mode: 'simulasi',
      tanggal: options.tanggal,
      periode_mulai: options.periode_mulai,
    };

    if (options.data_simulasi) {
      if (options.data_simulasi.length !== 7) {
        throw new AiValidationError(
          `Data simulasi kustom harus tepat 7 hari (diterima: ${options.data_simulasi.length} hari).`,
          {
            jumlah_hari_diterima: options.data_simulasi.length,
            jumlah_hari_dibutuhkan: 7,
          }
        );
      }
      payload.data_simulasi = options.data_simulasi;
    }

    return await executePythonModel(payload);
  }

  // ── 2. MODE DATABASE RIIL (STRICT 7 HARI) ───────────────────────────────────
  const anchorDate = options.tanggal || getWibTodayDate();
  const allDbRows = await getHariProduksiDb(anchorDate);

  const filtered = allDbRows.filter((r) => r.tanggal <= anchorDate);

  // VALIDASI KETAT HARUS TEPAT 7 HARI:
  if (filtered.length < 7) {
    const daftarTgl = filtered.map((r) => r.tanggal);
    throw new AiValidationError(
      `Data produksi di database belum mencukupi 7 hari (hanya ditemukan ${filtered.length} hari: ${JSON.stringify(daftarTgl)}). ` +
      `Model Random Forest membutuhkan tepat 7 hari data historis produksi. ` +
      `Silakan lengkapi data pada tabel product_harian atau gunakan endpoint simulasi (/api/ai/prediksi/simulasi) untuk mencoba data dummy bawaan.`,
      {
        jumlah_hari_ditemukan: filtered.length,
        jumlah_hari_dibutuhkan: 7,
        tanggal_yang_ada: daftarTgl,
        saran: "Gunakan endpoint simulasi (/api/ai/prediksi/simulasi) yang sudah memiliki data dummy bawaan siap pakai.",
      }
    );
  }

  const last7Days = filtered.slice(-7);

  const payload: Record<string, unknown> = {
    mode: 'database',
    data_7_hari: last7Days,
    tanggal: anchorDate,
    periode_mulai: options.periode_mulai,
  };

  return await executePythonModel(payload);
}
