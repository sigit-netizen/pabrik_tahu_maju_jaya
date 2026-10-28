import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import * as ort from 'onnxruntime-node';
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
  model_file?: string;
  engine?: 'onnx' | 'python';
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
  // Memungkinkan format baris dataset langsung
  [key: string]: unknown;
}

/**
 * Data Dummy 7 Hari Standar yang Diambil Langsung dari Baris Awal Dataset
 * (DatasetPenjualanTahuv3.csv Row #0)
 * Pengguna tidak perlu mengisi secara manual saat pengujian.
 */
export const DEFAULT_PRESET_DUMMY_7_HARI = [
  { urutan_hari: 1, hari: 'Senin', jumlah_masak: 34, jumlah_cetak: 202 },
  { urutan_hari: 2, hari: 'Selasa', jumlah_masak: 31, jumlah_cetak: 184 },
  { urutan_hari: 3, hari: 'Rabu', jumlah_masak: 33, jumlah_cetak: 200 },
  { urutan_hari: 4, hari: 'Kamis', jumlah_masak: 32, jumlah_cetak: 193 },
  { urutan_hari: 5, hari: 'Jumat', jumlah_masak: 32, jumlah_cetak: 193 },
  { urutan_hari: 6, hari: 'Sabtu', jumlah_masak: 33, jumlah_cetak: 197 },
  { urutan_hari: 7, hari: 'Minggu', jumlah_masak: 25, jumlah_cetak: 150 },
];

const NAMA_HARI_MAP = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

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

// ── ONNX SESSION SINGLETON ───────────────────────────────────────────────────
let cachedOnnxSession: ort.InferenceSession | null = null;

function resolveOnnxModelPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'model', 'models', 'best_rf_model.onnx'),
    path.resolve(process.cwd(), 'my-app', 'model', 'models', 'best_rf_model.onnx'),
    path.join(__dirname, '..', 'model', 'models', 'best_rf_model.onnx'),
    'D:\\semester7\\capstone\\my-app\\model\\models\\best_rf_model.onnx',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return candidates[0];
}

async function getOnnxSession(): Promise<ort.InferenceSession> {
  if (cachedOnnxSession) return cachedOnnxSession;
  const modelPath = resolveOnnxModelPath();
  if (!fs.existsSync(modelPath)) {
    throw new Error(`File model ONNX tidak ditemukan di: ${modelPath}`);
  }
  cachedOnnxSession = await ort.InferenceSession.create(modelPath);
  return cachedOnnxSession;
}

// ── DATE & FEATURE HELPERS ───────────────────────────────────────────────────

/**
 * Menghitung Minggu ISO dan Bulan sesuai preprocessing notebook RandomForest_Tuning.ipynb:
 * df['minggu_ke'] = df['tanggal_bersih'].dt.isocalendar().week.astype(int)
 * df['bulan'] = df['tanggal_bersih'].dt.month
 */
export function getIsoWeekAndMonth(date: Date): { isoWeek: number; month: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const isoWeek = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { isoWeek, month: date.getMonth() + 1 };
}

/**
 * Parsing tanggal dari berbagai format (rentang '01-07/04/2025', 'YYYY-MM-DD', 'DD/MM/YYYY')
 */
export function parseDateLikeNotebook(tanggalStr?: string): {
  date: Date;
  isoWeek: number;
  month: number;
} {
  if (!tanggalStr) {
    const now = new Date();
    const { isoWeek, month } = getIsoWeekAndMonth(now);
    return { date: now, isoWeek, month };
  }

  const str = String(tanggalStr).trim();

  // Format rentang dataset '01-07/04/2025'
  if (str.includes('-') && str.includes('/')) {
    const lastPart = str.split('-').pop() || '';
    const parts = lastPart.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      const dt = new Date(year, month - 1, day);
      const { isoWeek } = getIsoWeekAndMonth(dt);
      return { date: dt, isoWeek, month };
    }
  }

  // Format YYYY-MM-DD
  if (str.length >= 10 && str[4] === '-' && str[7] === '-') {
    const [y, m, d] = str.slice(0, 10).split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const { isoWeek } = getIsoWeekAndMonth(dt);
    return { date: dt, isoWeek, month: m };
  }

  // Format DD/MM/YYYY
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      const dt = new Date(year, month - 1, day);
      const { isoWeek } = getIsoWeekAndMonth(dt);
      return { date: dt, isoWeek, month };
    }
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const { isoWeek, month } = getIsoWeekAndMonth(parsed);
    return { date: parsed, isoWeek, month };
  }

  const fallback = new Date();
  const { isoWeek, month } = getIsoWeekAndMonth(fallback);
  return { date: fallback, isoWeek, month };
}

function formatDateToIso(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ── FALLBACK PYTHON RUNNER ───────────────────────────────────────────────────

function getPythonExecutable(): string {
  if (process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)) {
    return process.env.PYTHON_PATH;
  }
  const explicit311 = 'C:\\Users\\user\\AppData\\Local\\Programs\\Python\\Python311\\python.exe';
  if (fs.existsSync(explicit311)) {
    return explicit311;
  }
  const localAppData = process.env.LOCALAPPDATA || 'C:\\Users\\user\\AppData\\Local';
  const pyCandidate = path.join(localAppData, 'Programs', 'Python', 'Python311', 'python.exe');
  if (fs.existsSync(pyCandidate)) {
    return pyCandidate;
  }
  return 'python';
}

export async function executePythonModel(payload: Record<string, unknown>): Promise<AiPredictionResult> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(process.cwd(), 'model', 'predict.py');
    const pythonBin = getPythonExecutable();

    const py = spawn(pythonBin, [scriptPath], {
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
      reject(new Error(`Gagal memanggil binary Python (${pythonBin}): ${err.message}`));
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

// ── DATABASE QUERY ───────────────────────────────────────────────────────────

export async function getHariProduksiDb(
  anchorDateStr?: string
): Promise<Array<{ tanggal: string; jumlah_masak: number; jumlah_cetak: number }>> {
  try {
    const targetDateStr = anchorDateStr ? anchorDateStr.slice(0, 10) : getWibTodayDate();
    const [ay, am, ad] = targetDateStr.split('-').map(Number);

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
    console.warn('[AIService] Exception saat query DB product_harian:', err);
    return [];
  }
}

// ── NATIVE ONNX INFERENCE ENGINE ─────────────────────────────────────────────

async function executeOnnxInference(
  featureValues16: number[]
): Promise<number> {
  const session = await getOnnxSession();
  const inputTensor = new ort.Tensor('float32', new Float32Array(featureValues16), [1, 16]);
  const feeds = { float_input: inputTensor };
  const results = await session.run(feeds);
  const outputData = results.variable.data;
  return Number(outputData[0]);
}

// ── UTAMA: CALCULATE AI PREDICTION ───────────────────────────────────────────

export async function calculateAiPrediction(
  options: CalculateOptions = {}
): Promise<AiPredictionResult> {
  const mode = options.mode || 'database';

  try {
    const rincian7Hari: Basis7HariItem[] = [];
    let sumberDeskripsi = '';
    let targetDt: Date;
    let mingguKe: number;
    let bulan: number;

    const fiturDict: Record<string, number> = {};

    // ── JALUR A: FORMAT KOLOM DATASET LANGSUNG ───────────────────────────────
    if ('masak_1' in options && 'cetak_7' in options) {
      const { date: lastDt, isoWeek, month } = parseDateLikeNotebook(
        typeof options.tanggal === 'string' ? options.tanggal : undefined
      );
      mingguKe = isoWeek;
      bulan = month;

      targetDt = new Date(lastDt);
      targetDt.setDate(targetDt.getDate() + 1);

      for (let i = 1; i <= 7; i++) {
        const m = Number(options[`masak_${i}`]) || 0;
        const c = Number(options[`cetak_${i}`]) || 0;
        fiturDict[`masak_${i}`] = m;
        fiturDict[`cetak_${i}`] = c;

        const dI = new Date(lastDt);
        dI.setDate(dI.getDate() - (7 - i));
        rincian7Hari.push({
          urutan_hari: i,
          tanggal: formatDateToIso(dI),
          hari: NAMA_HARI_MAP[dI.getDay()],
          jumlah_masak: m,
          jumlah_cetak: c,
          sumber: 'Format Kolom Dataset CSV Langsung',
        });
      }

      fiturDict['minggu_ke'] = mingguKe;
      fiturDict['bulan'] = bulan;
      sumberDeskripsi = `Input Kolom Dataset Langsung (Tanggal Acuan: ${formatDateToIso(lastDt)})`;
    }

    // ── JALUR B: MODE SIMULASI (DATA DUMMY OTOMATIS) ──────────────────────────
    else if (mode === 'simulasi') {
      const rawRecords = options.data_simulasi;
      const anchorDateStr = options.tanggal;
      const periodeMulaiStr = options.periode_mulai;

      if (periodeMulaiStr) {
        targetDt = parseDateLikeNotebook(periodeMulaiStr).date;
      } else if (anchorDateStr) {
        const parsedAnchor = parseDateLikeNotebook(anchorDateStr).date;
        targetDt = new Date(parsedAnchor);
        targetDt.setDate(targetDt.getDate() + 1);
      } else {
        const now = new Date();
        now.setDate(now.getDate() + 1);
        targetDt = now;
      }

      if (rawRecords && rawRecords.length > 0) {
        if (rawRecords.length !== 7) {
          throw new AiValidationError(
            `Data simulasi kustom harus tepat 7 hari (diterima: ${rawRecords.length} hari). ` +
            `Sesuai dataset pelatihan, model Random Forest membutuhkan tepat 7 hari historis produksi.`,
            {
              jumlah_hari_diterima: rawRecords.length,
              jumlah_hari_dibutuhkan: 7,
            }
          );
        }

        sumberDeskripsi = 'Input Kustom Pengguna (7 Hari)';
        for (let i = 1; i <= 7; i++) {
          const item = rawRecords[i - 1];
          const m = Number(item.jumlah_masak) || 0;
          const c = Number(item.jumlah_cetak) || 0;
          const dI = new Date(targetDt);
          dI.setDate(dI.getDate() - (8 - i));
          const tglStr = item.tanggal || formatDateToIso(dI);
          const hariNama = item.hari || NAMA_HARI_MAP[dI.getDay()];

          fiturDict[`masak_${i}`] = m;
          fiturDict[`cetak_${i}`] = c;
          rincian7Hari.push({
            urutan_hari: i,
            tanggal: tglStr,
            hari: hariNama,
            jumlah_masak: m,
            jumlah_cetak: c,
            sumber: sumberDeskripsi,
          });
        }
      } else {
        // Preset otomatis Row #0
        sumberDeskripsi = 'Data Dummy Bawaan Sistem (Row #0 DatasetPenjualanTahuv3.csv)';
        for (let i = 1; i <= 7; i++) {
          const preset = DEFAULT_PRESET_DUMMY_7_HARI[i - 1];
          const dI = new Date(targetDt);
          dI.setDate(dI.getDate() - (8 - i));

          fiturDict[`masak_${i}`] = preset.jumlah_masak;
          fiturDict[`cetak_${i}`] = preset.jumlah_cetak;
          rincian7Hari.push({
            urutan_hari: i,
            tanggal: formatDateToIso(dI),
            hari: preset.hari,
            jumlah_masak: preset.jumlah_masak,
            jumlah_cetak: preset.jumlah_cetak,
            sumber: sumberDeskripsi,
          });
        }
      }

      // Hitung minggu_ke dan bulan berdasarkan hari ke-7
      const day7Date = parseDateLikeNotebook(rincian7Hari[6].tanggal).date;
      const parsedWeekMonth = getIsoWeekAndMonth(day7Date);
      mingguKe = parsedWeekMonth.isoWeek;
      bulan = parsedWeekMonth.month;
      fiturDict['minggu_ke'] = mingguKe;
      fiturDict['bulan'] = bulan;
    }

    // ── JALUR C: MODE DATABASE RIIL (STRICT 7 HARI) ───────────────────────────
    else {
      const anchorDate = options.tanggal || getWibTodayDate();
      const allDbRows = await getHariProduksiDb(anchorDate);
      const filtered = allDbRows.filter((r) => r.tanggal <= anchorDate);

      if (filtered.length < 7) {
        const daftarTgl = filtered.map((r) => r.tanggal);
        throw new AiValidationError(
          `Data produksi di database belum mencukupi 7 hari (hanya ditemukan ${filtered.length} hari: ${JSON.stringify(daftarTgl)}). ` +
          `Sesuai tahapan preprocessing pada notebook RandomForest_Tuning.ipynb, model membutuhkan tepat 7 hari data historis produksi (masak_1..7, cetak_1..7) untuk membentuk 1 window observasi. ` +
          `Silakan lengkapi tabel product_harian atau gunakan endpoint simulasi (/api/ai/prediksi/simulasi) yang sudah memiliki data dummy siap pakai.`,
          {
            jumlah_hari_ditemukan: filtered.length,
            jumlah_hari_dibutuhkan: 7,
            tanggal_yang_ada: daftarTgl,
            saran: 'Gunakan endpoint simulasi (/api/ai/prediksi/simulasi) yang sudah menyediakan data dummy 7 hari bawaan siap pakai.',
          }
        );
      }

      const last7Days = filtered.slice(-7);
      sumberDeskripsi = 'Data Riil Database Supabase (product_harian)';

      for (let i = 1; i <= 7; i++) {
        const row = last7Days[i - 1];
        const m = Number(row.jumlah_masak) || 0;
        const c = Number(row.jumlah_cetak) || 0;

        if (c <= 0) {
          throw new AiValidationError(
            `Data produksi tanggal ${row.tanggal} (hari ke-${i}) memiliki jumlah cetak <= 0. Semua 7 hari harus memiliki data produksi yang valid untuk peramalan.`,
            { tanggal: row.tanggal, urutan_hari: i }
          );
        }

        const dtObj = parseDateLikeNotebook(row.tanggal).date;
        fiturDict[`masak_${i}`] = m;
        fiturDict[`cetak_${i}`] = c;
        rincian7Hari.push({
          urutan_hari: i,
          tanggal: row.tanggal,
          hari: NAMA_HARI_MAP[dtObj.getDay()],
          jumlah_masak: m,
          jumlah_cetak: c,
          sumber: 'database_product_harian',
        });
      }

      const lastDate = parseDateLikeNotebook(last7Days[6].tanggal).date;
      const parsedWeekMonth = getIsoWeekAndMonth(lastDate);
      mingguKe = parsedWeekMonth.isoWeek;
      bulan = parsedWeekMonth.month;
      fiturDict['minggu_ke'] = mingguKe;
      fiturDict['bulan'] = bulan;

      targetDt = new Date(lastDate);
      targetDt.setDate(targetDt.getDate() + 1);
    }

    // ── EKSEKUSI ONNX RUNTIME (16 FITUR) ─────────────────────────────────────
    const featureOrder = [
      'masak_1', 'cetak_1', 'masak_2', 'cetak_2', 'masak_3', 'cetak_3',
      'masak_4', 'cetak_4', 'masak_5', 'cetak_5', 'masak_6', 'cetak_6',
      'masak_7', 'cetak_7', 'minggu_ke', 'bulan'
    ];
    const featureArray16 = featureOrder.map((key) => Number(fiturDict[key]) || 0);

    const predictionRaw = await executeOnnxInference(featureArray16);
    const totalCetakPrediksi = Math.round(predictionRaw);

    // Rincian 7 hari ke depan
    const bobotHari = [0.135, 0.138, 0.142, 0.140, 0.145, 0.155, 0.145];
    const totalBobot = bobotHari.reduce((a, b) => a + b, 0);

    const detailHarian: DetailHarianPrediksi[] = [];
    for (let i = 0; i < 7; i++) {
      const curDate = new Date(targetDt);
      curDate.setDate(curDate.getDate() + i);
      const prop = bobotHari[i] / totalBobot;
      const estimasiHari = Math.round(predictionRaw * prop);

      detailHarian.push({
        hari: NAMA_HARI_MAP[curDate.getDay()],
        tanggal: formatDateToIso(curDate),
        estimasi_cetak: estimasiHari,
      });
    }

    // Selaraskan pembulatan pada hari terakhir
    const sumDetail = detailHarian.reduce((acc, cur) => acc + cur.estimasi_cetak, 0);
    const selisih = totalCetakPrediksi - sumDetail;
    if (selisih !== 0 && detailHarian.length > 0) {
      detailHarian[detailHarian.length - 1].estimasi_cetak += selisih;
    }

    const tglAwal = rincian7Hari[0]?.tanggal || '';
    const tglAkhir = rincian7Hari[6]?.tanggal || '';
    const periodeSelesai = detailHarian[6]?.tanggal || '';

    return {
      status: 'success',
      mode,
      model_version: 'RandomForestRegressor-ONNX-v1',
      model_file: 'best_rf_model.onnx',
      engine: 'onnx',
      total_cetak_prediksi: totalCetakPrediksi,
      periode_mulai: formatDateToIso(targetDt),
      periode_selesai: periodeSelesai,
      minggu_ke: mingguKe,
      bulan: bulan,
      detail_harian: detailHarian,
      basis_7_hari_input: {
        sumber_data: sumberDeskripsi,
        rentang_7_hari: `${tglAwal} s/d ${tglAkhir}`,
        jumlah_hari_digunakan: rincian7Hari.length,
        rincian_per_hari: rincian7Hari,
      },
      metrik_evaluasi: {
        mae: 6.42,
        r2_score: 0.7712,
        catatan: 'Model Random Forest (R2 77%) dieksekusi native via ONNX Runtime di Node.js',
      },
      fitur_input_16: fiturDict,
    };
  } catch (err) {
    if (err instanceof AiValidationError) {
      throw err;
    }
    // Jika ONNX runtime mengalami kendala, gunakan fallback Python
    console.warn('[AIService] Terjadi kesalahan pada engine ONNX, mencoba fallback Python...', err);
    try {
      const pythonPayload: Record<string, unknown> = {
        mode,
        tanggal: options.tanggal,
        periode_mulai: options.periode_mulai,
        data_simulasi: options.data_simulasi,
      };
      const pyResult = await executePythonModel(pythonPayload);
      pyResult.engine = 'python';
      return pyResult;
    } catch (fallbackErr) {
      if (fallbackErr instanceof AiValidationError) {
        throw fallbackErr;
      }
      throw err;
    }
  }
}
