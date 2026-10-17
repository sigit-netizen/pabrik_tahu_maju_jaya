export type ViewKey = "dashboard" | "input" | "ai" | "pengaturan";

/* ---------- Bentuk respons API (dari route backend, bukan tebakan) ---------- */

/** GET /api/dashboard */
export type RingkasanDashboard = {
  total_cetak: number;
  total_masak: number;
  total_pendapatan: number;
  total_pendapatan_rupiah: string;
  rata_rata_cetak?: number;
  harga_cetak_aktif?: number;
  status_pabrik?: string;
};

export type TrenProduksi = {
  tanggal: string;
  jumlah_masak: number;
  jumlah_cetak: number;
  jumlah_pendapatan: number;
  jumlah_pendapatan_rupiah?: string;
};

export type PrediksiMingguan = {
  periode_mulai: string;
  periode_selesai: string;
  estimasi_total_cetak: number;
  model?: string;
};

export type DashboardData = {
  is_mock_data: boolean;
  ringkasan: RingkasanDashboard;
  grafik_tren_produksi: TrenProduksi[];
  prediksi_mingguan: PrediksiMingguan;
};

/** GET /api/produksi */
export type BarisProduksi = {
  id: number | string;
  created_at: string;
  tanggal: string;
  waktu_wib?: string;
  jumlah_cetak: number;
  jumlah_masak: number;
  jumlah_pendapatan: number;
  jumlah_pendapatan_rupiah: string;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

/** GET|POST /api/ai/prediksi */
export type DetailHarianPrediksi = {
  hari: string;
  tanggal: string;
  estimasi_cetak: number;
};

export type Prediksi = {
  id: string | number;
  tanggal_prediksi?: string;
  periode_mulai: string;
  periode_selesai: string;
  total_cetak_prediksi: number;
  mae?: number | null;
  mape?: number | null;
  model_version?: string;
  catatan_model?: string;
  detail_harian?: DetailHarianPrediksi[];
};

/** GET /api/proxy/me */
export type Pengguna = {
  id: number;
  username: string;
  email: string;
  status: number;
};

/* ---------- Baris input produksi (butuh `nama` untuk POST /api/produksi/input) ---------- */

export type InputRow = {
  id: number;
  nama: string;
  cetak: number;
  masak: number;
  done: boolean;
};

/* ---------- Helper tampilan ---------- */

export function formatRibuan(n: number) {
  return (n || 0).toLocaleString("id-ID");
}

export function rupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export function hariIniLabel() {
  try {
    return new Date().toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "Hari ini";
  }
}

/** "2026-10-17" -> "17 Okt" — untuk label sumbu grafik yang ringkas. */
export function tanggalPendek(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export function hariPendek(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", { weekday: "short" }).replace(".", "");
}