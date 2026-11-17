"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as KeyboardEventReact,
} from "react";
import ProdChart from "./ProdChart";
import {
  IconAlert,
  IconCalendar,
  IconPrint,
  IconSearch,
} from "./icons";
import { ModalFilterLaporan, type FilterKustom } from "./ModalFilterLaporan";
import { ModalCetakLaporan } from "./ModalCetakLaporan";
import { skin } from "./theme";
import {
  formatRibuan,
  rupiah,
  tanggalPendek,
  type BarisProduksi,
  type DashboardData,
  type Mode,
  type Pagination,
  type RincianPelanggan,
} from "./data";

const TABS: { key: Mode; label: string }[] = [
  { key: "harian", label: "Harian" },
  { key: "mingguan", label: "Mingguan" },
  { key: "bulanan", label: "Bulanan" },
];

const BATAS_HALAMAN = 20;
const PANEL_GRAFIK = "panel-grafik-produksi";

const GAYA_GRAFIK_TERANG = {
  "--tj-ink": "#14342B",
  "--tj-dot": "#F6F1E7",
  "--tj-lin-a": "#14342B",
  "--tj-lin-b": "#1B4A3A",
  "--tj-tip": "#14342B",
  "--tj-garis": "rgba(20,52,43,0.14)",
} as CSSProperties;

const GAYA_GRAFIK_GELAP = {
  "--tj-ink": "#F6F1E7",
  "--tj-dot": "#14342B",
  "--tj-lin-a": "#F6F1E7",
  "--tj-lin-b": "#E7D6B6",
  "--tj-tip": "#0E2620",
  "--tj-garis": "rgba(246,241,231,0.16)",
} as CSSProperties;

type MuatanDash = { kunci: number; data: DashboardData | null; pesan: string | null };
type MuatanBaris = { kunci: string; baris: BarisProduksi[]; pagination: Pagination | null; pesan: string | null };
type MuatanPelanggan = { kunci: string; data: Record<string, string[]> };

/* ---------- utilitas data ---------- */

function labelBulan(kunci: string) {
  const [tahun, bulan] = kunci.split("-").map(Number);
  if (!tahun || !bulan) return kunci;
  return new Date(tahun, bulan - 1, 1).toLocaleDateString("id-ID", { month: "short", year: "numeric" });
}

/** Agregasi tren dari API sesuai rentang tab yang dipilih. */
function mingguKe(tanggal: string): number {
  const d = new Date(tanggal);
  const oneJan = new Date(d.getFullYear(), 0, 1);
  /* Day of week: 0=Senin, 1=Selasa, ..., 6=Minggu di getDay().
     ISO week: minggu pertama adalah yang berandung ke tahun baru.
     Rumus sederhana: ambil hari ke-kecantikan dari 1 Januari, bagi 7, plus offset hari. */
  const janOneDay = oneJan.getDay(); // 0=Senin, ..., 6=Minggu
  const daysSinceJan1 = Math.floor((d.getTime() - oneJan.getTime()) / 86400000); // hari lengkap sejak 1 Januari
  return Math.ceil((daysSinceJan1 + janOneDay + 1) / 7);
}

function agregatTren(tren: Array<{ tanggal: string; jumlah_cetak: number }>, mode: Mode): { labels: string[]; values: number[] } {
  if (tren.length === 0) return { labels: [], values: [] };
  if (mode === "harian") {
    return {
      labels: tren.map((t) => tanggalPendek(t.tanggal)),
      values: tren.map((t) => Number(t.jumlah_cetak) || 0),
    };
  }
  if (mode === "mingguan") {
    // Jika data 7 hari atau kurang (misal periode 1 minggu tertentu), tampilkan rincian harian
    if (tren.length <= 7) {
      return {
        labels: tren.map((t) => tanggalPendek(t.tanggal)),
        values: tren.map((t) => Number(t.jumlah_cetak) || 0),
      };
    }
    /* Kelompokkan per minggu ISO, label "Minggu 1", "Minggu 2", dst. */
    const perMinggu = new Map<number, number>();
    for (const t of tren) {
      const wk = mingguKe(t.tanggal);
      perMinggu.set(wk, (perMinggu.get(wk) ?? 0) + (Number(t.jumlah_cetak) || 0));
    }
    /* Ambil semua minggu yang ada dan urutkan dari Minggu 1 */
    const mingguTersort = [...perMinggu.entries()].sort((a, b) => a[0] - b[0]);
    const labels = mingguTersort.map(([wk]) => `Minggu ${wk}`);
    const values = mingguTersort.map(([, val]) => val);
    return { labels, values };
  }
  // bulanan: jika data hanya 1 bulan tertentu, tampilkan per tanggal
  const uniqueMonths = new Set(tren.map((t) => t.tanggal.slice(0, 7)));
  if (uniqueMonths.size <= 1) {
    return {
      labels: tren.map((t) => tanggalPendek(t.tanggal)),
      values: tren.map((t) => Number(t.jumlah_cetak) || 0),
    };
  }
  const perBulan = new Map<string, number>();
  for (const t of tren) {
    const d = new Date(t.tanggal);
    const kunci = Number.isNaN(d.getTime())
      ? t.tanggal
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    perBulan.set(kunci, (perBulan.get(kunci) ?? 0) + (Number(t.jumlah_cetak) || 0));
  }
  const isi = [...perBulan.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return { labels: isi.map(([kunci]) => labelBulan(kunci)), values: isi.map(([, nilai]) => nilai) };
}

function pesanGagal(respon: Response, json: { message?: string } | null, konteks: string) {
  const pesan = typeof json?.message === "string" ? json.message.trim() : "";
  return pesan ? `${konteks}: ${pesan}` : `${konteks} (HTTP ${respon.status}).`;
}

/* ---------- komponen kecil ---------- */

function KotakGagal({
  dark,
  pesan,
  onCoba,
  cobaLabel,
}: {
  dark: boolean;
  pesan: string;
  onCoba: () => void;
  cobaLabel: string;
}) {
  return (
    <div
      role="alert"
      className={`flex flex-wrap items-start gap-3 rounded-2xl border px-4 py-3.5 ${dark ? "border-red-400/35 bg-red-400/10" : "border-red-300/60 bg-red-50/70"}`}
    >
      <IconAlert className={`mt-px h-4 w-4 shrink-0 ${dark ? "text-red-300" : "text-red-600"}`} />
      <p className={`min-w-0 flex-1 text-[12.5px] leading-5 font-semibold ${dark ? "text-red-200" : "text-red-800"}`}>
        {pesan}
      </p>
      <button
        type="button"
        onClick={onCoba}
        className={`btn-press h-8 shrink-0 rounded-lg border px-3 text-[12px] font-bold ${dark ? "border-red-300/40 text-red-200 hover:bg-red-400/10" : "border-red-300 text-red-700 hover:bg-red-100"}`}
      >
        {cobaLabel}
      </button>
    </div>
  );
}

/**
 * Komponen Form Status Pembayaran per baris rekap produksi:
 * Menggantikan sistem centang manual dengan form pengisian nominal dan tombol "Kirim".
 * Mendukung input nominal Rupiah langsung (mis. 500000 atau 1008000) maupun jumlah cetak (mis. 24).
 * Menampilkan badge status: Lunas (hijau), Cicil (oranye), atau Belum lunas (merah/abu).
 * Terhubung langsung ke API `/api/produksi/rincian/[id]/bayar` dan database Supabase.
 */
function FormStatusBayar({
  id,
  rincianId,
  jumlahCetak,
  totalHarga,
  hargaCetakAktif,
  sisaDb,
  statusDb,
  dataBayar,
  onKirim,
  dark,
}: {
  id: string;
  rincianId?: string;
  jumlahCetak: number;
  totalHarga: number;
  hargaCetakAktif: number;
  sisaDb?: number;
  statusDb?: string;
  dataBayar?: {
    lunas: boolean;
    cicil: boolean;
    cetakDibayar: number;
    nominalRupiah?: number;
    sisa?: number;
  };
  onKirim: (
    id: string,
    rincianId: string | undefined,
    nominalRupiah: number,
    cetakDibayar: number,
    lunas: boolean,
    cicil: boolean
  ) => Promise<boolean | void>;
  dark: boolean;
}) {
  const sisaEfektif =
    dataBayar?.sisa !== undefined
      ? dataBayar.sisa
      : sisaDb !== undefined && sisaDb !== null
      ? sisaDb
      : totalHarga;

  const isLunas = dataBayar?.lunas ?? (statusDb === "Lunas" || sisaEfektif <= 0);
  const isCicil =
    dataBayar?.cicil ?? (!isLunas && sisaEfektif < totalHarga && sisaEfektif > 0);

  const nominalTerbayar =
    dataBayar?.nominalRupiah ?? Math.max(0, totalHarga - sisaEfektif);

  const [editedVal, setEditedVal] = useState<string | null>(null);
  const [sedangKirim, setSedangKirim] = useState(false);
  const [tersimpan, setTersimpan] = useState(false);

  // Nilai input: saat sedang diedit tampilkan editedVal; jika tidak, tampilkan string kosong
  const inputVal = editedVal ?? "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanDigits = (editedVal ?? "").replace(/[^\d]/g, "");
    const rawVal = cleanDigits ? parseInt(cleanDigits, 10) : 0;

    if (rawVal <= 0) return;

    let nominalRupiah = 0;
    let cetakDibayar = 0;

    if (rawVal <= jumlahCetak && rawVal > 0 && hargaCetakAktif > 0) {
      // Jika angka kecil (<= jumlah cetak), diperlakukan sebagai jumlah cetak yang dibayar
      cetakDibayar = rawVal;
      nominalRupiah = rawVal * hargaCetakAktif;
    } else {
      // Nominal Rupiah langsung
      nominalRupiah = rawVal;
      cetakDibayar =
        hargaCetakAktif > 0
          ? Math.min(jumlahCetak, Math.round(rawVal / hargaCetakAktif))
          : 0;
    }

    const sisaBaruPreview = Math.max(0, sisaEfektif - nominalRupiah);
    const lunasPreview = sisaBaruPreview <= 0;
    const cicilPreview = !lunasPreview && sisaBaruPreview < totalHarga;

    setSedangKirim(true);
    await onKirim(id, rincianId, nominalRupiah, cetakDibayar, lunasPreview, cicilPreview);
    setSedangKirim(false);
    setEditedVal(null);
    setTersimpan(true);
    setTimeout(() => setTersimpan(false), 2000);
  }

  const badgeClass = isLunas
    ? dark
      ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-300"
      : "border-emerald-300/70 bg-emerald-50 text-emerald-800"
    : isCicil
    ? dark
      ? "border-amber-400/40 bg-amber-400/15 text-amber-300"
      : "border-amber-300/70 bg-amber-50 text-amber-800"
    : dark
    ? "border-rose-400/30 bg-rose-400/15 text-rose-300"
    : "border-rose-300/70 bg-rose-50 text-rose-700";

  const badgeText = isLunas ? "✓ Lunas" : isCicil ? "◐ Cicil" : "✕ Belum lunas";

  return (
    <div className="flex flex-col gap-1.5 py-1 min-w-[210px]">
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold border transition-colors ${badgeClass}`}
        >
          {badgeText}
        </span>
        {nominalTerbayar > 0 && (
          <span
            className={`text-[10px] font-semibold tabular-nums ${dark ? "text-cream/55" : "text-pine/60"}`}
          >
            {isLunas ? "(Lunas penuh)" : `(Masuk: ${rupiah(nominalTerbayar)})`}
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <span
            className={`pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold select-none ${dark ? "text-cream/40" : "text-pine/40"}`}
          >
            Rp
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={inputVal}
            onChange={(e) => setEditedVal(e.target.value.replace(/[^\d.,]/g, ""))}
            onBlur={() => {
              if (editedVal !== null && editedVal !== "") {
                const digits = editedVal.replace(/[^\d]/g, "");
                setEditedVal(digits ? formatRibuan(parseInt(digits, 10)) : "");
              }
            }}
            placeholder={isLunas ? "0 (Lunas)" : sisaEfektif > 0 ? formatRibuan(sisaEfektif) : "0"}
            aria-label={`Nominal bayar baris ID ${id}`}
            disabled={sedangKirim}
            className={`h-7 w-full rounded-lg border pl-7 pr-2 text-right font-mono text-[11px] font-bold tabular-nums transition-colors focus:border-brand focus:outline-none ${
              dark
                ? "border-cream/15 bg-pine-deep text-cream placeholder:text-cream/30 focus:bg-pine"
                : "border-line-strong bg-white text-pine placeholder:text-pine/30 focus:bg-white"
            } ${isLunas ? "opacity-75" : ""}`}
          />
        </div>

        <button
          type="submit"
          disabled={sedangKirim || (editedVal === null || editedVal === "")}
          className={`btn-press flex h-7 items-center justify-center rounded-lg px-2.5 text-[11px] font-bold transition-all shadow-xs cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
            tersimpan
              ? "bg-emerald-600 text-white"
              : dark
              ? "bg-brand text-pine-deep hover:bg-brand/90"
              : "bg-brand text-white hover:bg-brand/90"
          }`}
          title="Kirim dan simpan nominal pembayaran"
        >
          {sedangKirim ? "..." : tersimpan ? "✓ Disimpan" : "Kirim"}
        </button>
      </form>
    </div>
  );
}

/* ---------- view utama ---------- */

export default function DashboardView({
  dark,
  mode,
  setMode,
  onTotalsChange,
  onToast,
}: {
  dark: boolean;
  mode: Mode;
  setMode: (v: Mode) => void;
  onTotalsChange: (cetak: number, pendapatan: number) => void;
  onToast?: (msg: string) => void;
}) {
  const s = skin(dark);
  const [q, setQ] = useState("");
  const [halaman, setHalaman] = useState(1);
  const [cobaDashboard, setCobaDashboard] = useState(0);
  const [cobaBaris, setCobaBaris] = useState(0);
  const [muatanDash, setMuatanDash] = useState<MuatanDash | null>(null);
  const [muatanBaris, setMuatanBaris] = useState<MuatanBaris | null>(null);
  const [showModalCetak, setShowModalCetak] = useState(false);

  /* Modal filter periode laporan (Harian / Mingguan / Bulanan) */
  const [modalFilterMode, setModalFilterMode] = useState<Mode | null>(null);
  const [filterKustom, setFilterKustom] = useState<FilterKustom | null>(null);

  function handleTerapkanFilter(filter: FilterKustom) {
    setFilterKustom(filter);
    setMode(filter.mode);
    setHalaman(1);
    setModalFilterMode(null);
  }

  function handleResetFilter() {
    setFilterKustom(null);
    setHalaman(1);
    setModalFilterMode(null);
  }

  /* Status pembayaran (tersimpan di frontend / localStorage) */
  const [pembayaran, setPembayaran] = useState<
    Record<string, { lunas: boolean; cicil: boolean; cetakDibayar: number; nominalRupiah?: number; sisa?: number }>
  >(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem("tmj_pembayaran_status");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed;
      }
    } catch {
      // Abaikan bila diakses di SSR
    }
    return {};
  });

  // Simpan perubahan status pembayaran ke localStorage
  const refMountedStorage = useRef(false);
  useEffect(() => {
    if (!refMountedStorage.current) {
      refMountedStorage.current = true;
      return;
    }
    try {
      localStorage.setItem("tmj_pembayaran_status", JSON.stringify(pembayaran));
    } catch (e) {
      console.warn("[pembayaran] Gagal menyimpan ke localStorage:", e);
    }
  }, [pembayaran]);

  const handleSimpanPembayaran = useCallback(
    async (
      id: string,
      rincianId: string | undefined,
      nominalRupiah: number,
      cetakDibayar: number,
      lunas: boolean,
      cicil: boolean
    ) => {
      const targetId = rincianId || id;

      // 1. Simpan sementara ke state lokal agar UI langsung responsif
      setPembayaran((prev) => ({
        ...prev,
        [id]: {
          lunas,
          cicil,
          cetakDibayar,
          nominalRupiah,
          sisa: lunas ? 0 : undefined,
        },
      }));

      // 2. Kirim aksi pembayaran ke backend API untuk update tabel rincian_product_harian
      try {
        const res = await fetch(`/api/produksi/rincian/${targetId}/bayar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            bayar: nominalRupiah,
            rincian_id: rincianId ? parseInt(rincianId, 10) : undefined,
          }),
        });
        const resJson = await res.json().catch(() => null);
        if (res.ok && resJson?.status === "success" && resJson.data) {
          const d = resJson.data;
          const isLunas = d.status_pembayaran === "Lunas" || d.sisa <= 0;
          const hargaSatuan =
            d.jumlah_cetak > 0 && d.total > 0 ? d.total / d.jumlah_cetak : 0;

          setPembayaran((prev) => ({
            ...prev,
            [id]: {
              lunas: isLunas,
              cicil: !isLunas && d.sisa < d.total,
              cetakDibayar:
                hargaSatuan > 0
                  ? Math.round((d.total - d.sisa) / hargaSatuan)
                  : 0,
              nominalRupiah: d.total - d.sisa,
              sisa: d.sisa,
            },
          }));

          // Update langsung baris di state tabel agar seketika sinkron dengan DB
          setMuatanBaris((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              baris: prev.baris.map((b) => {
                if (
                  String(b.id) === String(id) ||
                  (b.rincian_id && String(b.rincian_id) === String(targetId)) ||
                  (d.id && String(b.rincian_id) === String(d.id))
                ) {
                  return {
                    ...b,
                    sisa: d.sisa,
                    sisa_rupiah: d.sisa_rupiah,
                    status_pembayaran: d.status_pembayaran,
                  };
                }
                return b;
              }),
            };
          });

          if (resJson.message && onToast) {
            onToast(resJson.message);
          }
          return true;
        } else if (resJson?.message && onToast) {
          onToast(resJson.message);
        }
      } catch (err) {
        console.warn("[pembayaran] Gagal mengirim aksi pembayaran ke API:", err);
        if (onToast) {
          onToast("Gagal menghubungi server saat menyimpan pembayaran.");
        }
      }
    },
    [onToast]
  );

  /* Nama pelanggan per tanggal rekap. Header rekap (/api/produksi) tidak
     menyimpan nama — nama ada di rincian_product_harian yang dibaca lewat
     /api/produksi/input?tanggal=. Dipasangkan lewat tanggal rekap. */
  const [muatanPelanggan, setMuatanPelanggan] = useState<MuatanPelanggan | null>(null);

  const refTab = useRef<(HTMLButtonElement | null)[]>([]);

  /* Ringkasan + tren — GET /api/dashboard */
  useEffect(() => {
    let batal = false;
    (async () => {
      try {
        const res = await fetch("/api/dashboard", { credentials: "include", cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (batal) return;
        if (!res.ok || !json || json.status !== "success") {
          setMuatanDash({ kunci: cobaDashboard, data: null, pesan: pesanGagal(res, json, "Gagal memuat ringkasan dashboard") });
          return;
        }
        setMuatanDash({ kunci: cobaDashboard, data: json.data as DashboardData, pesan: null });
      } catch {
        if (!batal) {
          setMuatanDash({ kunci: cobaDashboard, data: null, pesan: "Tidak dapat menghubungi server saat memuat ringkasan." });
        }
      }
    })();
    return () => {
      batal = true;
    };
  }, [cobaDashboard]);

  /* Rekap harian — GET /api/produksi */
  const kunciBaris = `${halaman}|${cobaBaris}|${filterKustom?.startDate ?? ""}|${filterKustom?.endDate ?? ""}`;
  useEffect(() => {
    let batal = false;
    (async () => {
      try {
        let url = `/api/produksi?page=${halaman}&limit=${BATAS_HALAMAN}`;
        if (filterKustom) {
          url += `&start_date=${encodeURIComponent(filterKustom.startDate)}&end_date=${encodeURIComponent(filterKustom.endDate)}`;
        }
        const res = await fetch(url, {
          credentials: "include",
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (batal) return;
        if (!res.ok || !json || json.status !== "success") {
          setMuatanBaris({
            kunci: kunciBaris,
            baris: [],
            pagination: null,
            pesan: pesanGagal(res, json, "Gagal memuat rekap produksi"),
          });
          return;
        }
        setMuatanBaris({
          kunci: kunciBaris,
          baris: Array.isArray(json.data) ? (json.data as BarisProduksi[]) : [],
          pagination: (json.pagination as Pagination) ?? null,
          pesan: null,
        });
      } catch {
        if (!batal) {
          setMuatanBaris({
            kunci: kunciBaris,
            baris: [],
            pagination: null,
            pesan: "Tidak dapat menghubungi server saat memuat rekap produksi.",
          });
        }
      }
    })();
    return () => {
      batal = true;
    };
  }, [halaman, cobaBaris, kunciBaris, filterKustom]);

  /* Status turunan — tidak ada setState sinkron di dalam effect */
  const dash = muatanDash?.kunci === cobaDashboard ? muatanDash.data : null;
  const errorDash = muatanDash?.kunci === cobaDashboard ? muatanDash.pesan : null;
  const memuatDash = muatanDash?.kunci !== cobaDashboard;

  const baris = useMemo(
    () => (muatanBaris?.kunci === kunciBaris ? muatanBaris.baris : []),
    [muatanBaris, kunciBaris],
  );
  const pagination = muatanBaris?.kunci === kunciBaris ? muatanBaris.pagination : null;
  const errorBaris = muatanBaris?.kunci === kunciBaris ? muatanBaris.pesan : null;
  const memuatBaris = muatanBaris?.kunci !== kunciBaris;

  /* Tanggal unik pada halaman ini — satu request per tanggal untuk ambil
     rincian pelanggan. Header rekap tidak membawa nama, jadi ini sumbernya. */
  const tanggalBunik = useMemo(
    () => [...new Set(baris.map((r) => r.tanggal).filter(Boolean))].sort(),
    [baris],
  );
  const kunciTanggal = tanggalBunik.join(",");

  useEffect(() => {
    let batal = false;
    if (tanggalBunik.length === 0) return;
    (async () => {
      /* Header rekap dan rinciannya ditulis dengan created_at yang sama, jadi
         pasangan dibuat per created_at — bukan per tanggal. Dengan begitu dua
         rekap pada tanggal sama tetap punya nama pelanggan masing-masing. */
      const hasil: Record<string, string[]> = {};
      await Promise.all(
        tanggalBunik.map(async (tanggal) => {
          try {
            const res = await fetch(`/api/produksi/input?tanggal=${encodeURIComponent(tanggal)}`, {
              credentials: "include",
              cache: "no-store",
            });
            const json = await res.json().catch(() => null);
            if (batal) return;
            if (!res.ok || !json || json.status !== "success") return;
            const rincian = json.data?.rincian_hari_ini;
            if (!Array.isArray(rincian)) return;
            for (const item of rincian as RincianPelanggan[]) {
              const nama = String(item.nama ?? "").trim();
              if (!nama) continue;
              const kunci = String(item.created_at ?? "");
              if (!kunci) continue;
              (hasil[kunci] ??= []).push(nama);
            }
          } catch {
            /* biarkan kosong — tabel tetap menampilkan "—" */
          }
        }),
      );
      if (!batal) setMuatanPelanggan({ kunci: kunciTanggal, data: hasil });
    })();
    return () => {
      batal = true;
    };
  }, [kunciTanggal, tanggalBunik]);

  const ringkasan = dash?.ringkasan ?? null;
  const tren = useMemo(() => dash?.grafik_tren_produksi ?? [], [dash]);

  /* Susun tren dari baris rekap yang sudah dimuat (seadanya), tanpa
     mengharuskan minimal 7 hari. Ini adalah sumber grafik utama supaya
     grafik selalu mencerminkan tabel rekap di bawahnya. */
  const trenDariBaris = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const r of baris) {
      const tgl = r.tanggal;
      byDate.set(tgl, (byDate.get(tgl) || 0) + (Number(r.jumlah_cetak) || 0));
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tanggal, jumlah_cetak]) => ({ tanggal, jumlah_cetak }));
  }, [baris]);

  /* Gabungkan data API (grafik_tren_produksi) dengan data rekap, tanpa
     duplikasi tanggal. Data rekap prioritas tinggi karena relevan dengan
     tabel di bawah. */
  const trenEfektif = useMemo(() => {
    /* Jika ada data rekap dengan cetakan > 0, pakai itu (seadanya, tanpa
       memaksa 7 hari terakhir dari API). Jika tidak, fall back ke data API. */
    const adaDataRiil = trenDariBaris.some((t) => (Number(t.jumlah_cetak) || 0) > 0);
    if (adaDataRiil) return trenDariBaris;

    const byDate = new Map<string, number>();
    for (const t of tren) {
      byDate.set(t.tanggal, (byDate.get(t.tanggal) || 0) + (Number(t.jumlah_cetak) || 0));
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tanggal, jumlah_cetak]) => ({ tanggal, jumlah_cetak }));
  }, [tren, trenDariBaris]);

  const seri = useMemo(() => agregatTren(trenEfektif, mode), [trenEfektif, mode]);

  /* Data rincian hanya dipakai kalau cocok dengan tanggal yang sedang tampil. */
  const dataPelanggan = muatanPelanggan?.kunci === kunciTanggal ? muatanPelanggan.data : null;
  const muatPelanggan = muatanPelanggan !== null && muatanPelanggan.kunci !== kunciTanggal;

  /* Nama pelanggan untuk satu baris rekap. Header rekap di /api/produksi tidak
     membawa nama, jadi diambil dari rincian dengan created_at yang sama —
     pasangan itu ditulis bersamaan saat pencatatan produksi. */
  const namaPelanggan = useMemo(() => {
    const peta = new Map<string, string[]>();
    for (const [createdAt, nama] of Object.entries(dataPelanggan ?? {})) {
      peta.set(createdAt, nama);
    }
    return (createdAt: string) => peta.get(createdAt) ?? [];
  }, [dataPelanggan]);

  const hargaCetakAktif = Number(ringkasan?.harga_cetak_aktif) || 0;

  /* Filter data cetak sesuai mode yang dipilih atau periode kustom */
  const barisUntukCetak = useMemo(() => {
    if (filterKustom) {
      return baris.filter(
        (r: BarisProduksi) =>
          r.tanggal >= filterKustom.startDate && r.tanggal <= filterKustom.endDate
      );
    }
    return baris;
  }, [baris, filterKustom]);

  /* Total untuk mode grafik (dikirim ke kartu KPI atas) */
  const totalCetakCetak = useMemo(
    () => barisUntukCetak.reduce((a, b) => a + (Number(b.jumlah_cetak) || 0), 0),
    [barisUntukCetak],
  );
  const totalHargaCetak = useMemo(
    () => barisUntukCetak.reduce((a, b) => a + (Number(b.jumlah_cetak) * hargaCetakAktif || 0), 0),
    [barisUntukCetak, hargaCetakAktif],
  );

  /* Kirim total terfilter ke DashboardApp untuk kartu KPI atas */
  useEffect(() => {
    onTotalsChange(totalCetakCetak, totalHargaCetak);
  }, [totalCetakCetak, totalHargaCetak, onTotalsChange]);

  /* Filter pencarian (q) di atas baris mode */
  const barisTampil = useMemo(() => {
    const kunci = q.trim().toLowerCase();
    if (!kunci) return barisUntukCetak;
    return barisUntukCetak.filter((r) => {
      const idStr = String(r.id).toLowerCase();
      const rincianIdStr = r.rincian_id ? String(r.rincian_id).toLowerCase() : "";
      const tglStr = (r.tanggal || "").toLowerCase();
      const waktuStr = (r.waktu_wib || "").toLowerCase();
      const namaDirect = (r.nama || "").toLowerCase();
      const pelangganList = namaPelanggan(r.created_at).join(" ").toLowerCase();
      const sisaVal = pembayaran[String(r.id)]?.sisa ?? r.sisa;
      const isLunas = (pembayaran[String(r.id)]?.lunas ?? r.status_pembayaran === "Lunas") || sisaVal === 0;
      const isCicil = pembayaran[String(r.id)]?.cicil ?? (!isLunas && sisaVal !== undefined && sisaVal > 0 && sisaVal < (r.total ?? 0));
      const statusStr = isLunas ? "lunas" : isCicil ? "cicil" : "belum lunas";
      return (
        idStr.includes(kunci) ||
        rincianIdStr.includes(kunci) ||
        tglStr.includes(kunci) ||
        waktuStr.includes(kunci) ||
        namaDirect.includes(kunci) ||
        pelangganList.includes(kunci) ||
        statusStr.includes(kunci)
      );
    });
  }, [barisUntukCetak, q, namaPelanggan, pembayaran]);

  const totalCetakTampil = useMemo(
    () => barisTampil.reduce((a, b) => a + (Number(b.jumlah_cetak) || 0), 0),
    [barisTampil],
  );
  const totalMasakTampil = useMemo(
    () => barisTampil.reduce((a, b) => a + (Number(b.jumlah_masak) || 0), 0),
    [barisTampil],
  );
  const totalHargaTampil = useMemo(
    () => barisTampil.reduce((a, b) => a + (b.total ?? (Number(b.jumlah_cetak) * hargaCetakAktif || 0)), 0),
    [barisTampil, hargaCetakAktif],
  );

  /* Total nominal pembayaran yang sudah dicatat untuk baris yang sedang tampil */
  const totalNominalDibayarTampil = useMemo(() => {
    return barisTampil.reduce((acc, r) => {
      const bayar = pembayaran[String(r.id)];
      if (bayar && bayar.nominalRupiah !== undefined) return acc + bayar.nominalRupiah;
      if (r.sisa !== undefined && r.sisa !== null) {
        const total = r.total ?? (Number(r.jumlah_cetak) * hargaCetakAktif);
        return acc + Math.max(0, total - Number(r.sisa));
      }
      if (!bayar) return acc;
      const nominal = bayar.nominalRupiah ?? (bayar.cetakDibayar * hargaCetakAktif);
      return acc + nominal;
    }, 0);
  }, [barisTampil, pembayaran, hargaCetakAktif]);

  const totalSisaBelumLunasTampil = useMemo(() => {
    return barisTampil.reduce((acc, r) => {
      const info = pembayaran[String(r.id)];
      if (info?.sisa !== undefined) return acc + info.sisa;
      if (r.sisa !== undefined && r.sisa !== null) return acc + Number(r.sisa);
      const total = r.total ?? (Number(r.jumlah_cetak) * hargaCetakAktif);
      const dibayar = info?.nominalRupiah ?? ((info?.cetakDibayar ?? 0) * hargaCetakAktif);
      return acc + Math.max(0, total - dibayar);
    }, 0);
  }, [barisTampil, pembayaran, hargaCetakAktif]);

  function pindahTab(e: KeyboardEventReact<HTMLButtonElement>) {
    const ini = TABS.findIndex((t) => t.key === mode);
    let tujuan = -1;
    if (e.key === "ArrowRight") tujuan = (ini + 1) % TABS.length;
    else if (e.key === "ArrowLeft") tujuan = (ini - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") tujuan = 0;
    else if (e.key === "End") tujuan = TABS.length - 1;
    if (tujuan < 0) return;
    e.preventDefault();
    setMode(TABS[tujuan].key);
    refTab.current[tujuan]?.focus();
  }

  const gayaGrafik = dark ? GAYA_GRAFIK_GELAP : GAYA_GRAFIK_TERANG;

  return (
    <div className="space-y-5">
      {/* ===== kartu utama: tabs + grafik + tabel ===== */}
      <section
        style={{ ...gayaGrafik, animationDelay: "120ms" }}
        className={`anim-rise overflow-hidden rounded-3xl ${s.kartu}`}
      >
        <div className={`flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 sm:px-6 ${s.garis} ${s.kepala}`}>
          <div>
            <h2 className={`text-[16px] font-extrabold tracking-tight ${s.judul}`}>Grafik Produksi Tahu</h2>
            <p className={`text-[12px] font-medium ${s.sub}`}>Papan tercetak dari data produksi yang tersimpan di database</p>
          </div>

          <div
            className={`relative grid grid-cols-3 rounded-xl border p-1 text-[12px] font-bold ${s.garisKuat} ${s.chip}`}
            role="tablist"
            aria-label="Rentang grafik produksi"
          >
            <span
              aria-hidden
              className={`tab-thumb absolute top-1 bottom-1 rounded-lg ${dark ? "bg-brand" : "bg-pine"}`}
              style={{
                left: 4,
                width: "calc((100% - 8px) / 3)",
                transform: `translateX(${mode === "harian" ? 0 : mode === "mingguan" ? 100 : 200}%)`,
              }}
            />
            {TABS.map((t, i) => {
              const terpilih = mode === t.key;
              return (
                <button
                  key={t.key}
                  ref={(el) => {
                    refTab.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`tab-${t.key}`}
                  aria-selected={terpilih}
                  aria-controls={PANEL_GRAFIK}
                  tabIndex={terpilih ? 0 : -1}
                  onKeyDown={pindahTab}
                  onClick={() => setModalFilterMode(t.key)}
                  className={`tab-pill relative z-10 rounded-lg px-4 py-2 sm:px-6 cursor-pointer ${terpilih ? (dark ? "text-pine-deep" : "text-cream") : s.hantu}`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* panel yang dikendalikan tab */}
        <div
          id={PANEL_GRAFIK}
          role="tabpanel"
          aria-labelledby={`tab-${mode}`}
          tabIndex={0}
          className={`px-5 pt-4 focus:outline-none sm:px-6 ${s.judul}`}
        >
          {memuatDash ? (
            <p role="status" className={`py-14 text-center text-[13px] font-semibold ${s.sub}`}>
              Memuat grafik produksi…
            </p>
          ) : errorDash ? (
            <div className="py-6">
              <KotakGagal
                dark={dark}
                pesan={errorDash}
                cobaLabel="Muat ulang"
                onCoba={() => {
                  setMuatanDash(null);
                  setCobaDashboard((n) => n + 1);
                }}
              />
            </div>
          ) : (
            <>
              {dash?.is_mock_data && (
                <div
                  role="status"
                  className={`mb-4 flex items-start gap-2.5 rounded-2xl border px-4 py-3 ${dark ? "border-brand/40 bg-brand/10" : "border-amber-300/70 bg-amber-50/80"}`}
                >
                  <IconAlert className={`mt-px h-4 w-4 shrink-0 ${dark ? "text-brand" : "text-amber-600"}`} />
                  <p className={`text-[12.5px] leading-5 font-semibold ${dark ? "text-cream/85" : "text-amber-900"}`}>
                    Data contoh — database masih kosong. Angka di bawah ini bukan hasil pencatatan asli; catat
                    produksi lewat menu Input lalu muat ulang halaman ini.
                  </p>
                </div>
              )}
              <ProdChart labels={seri.labels} values={seri.values} mode={mode} />
            </>
          )}
        </div>

        {/* toolbar filter + cetak */}
        <div className="px-5 py-4 sm:px-6">
          {/* baris 1: pencarian */}
          <div className="relative mb-3">
            <span className={`pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 ${s.ikon}`} aria-hidden>
              <IconSearch className="h-[15px] w-[15px]" />
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter tanggal / id / status…"
              aria-label="Filter rekap produksi"
              className={`h-10 w-full rounded-xl border pr-3 pl-10 text-[13px] font-medium transition focus:border-brand focus:shadow-[0_0_0_4px_rgba(217,119,6,0.14)] focus:outline-none ${s.input}`}
            />
          </div>

          {/* baris 2: ringkasan + filter mode di kiri, tombol rekap di kanan */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`hidden rounded-lg px-3 py-2 text-[12px] font-bold sm:inline ${dark ? "bg-pine-deep text-cream/70" : "bg-cream-muted text-pine/70"}`}>
              {barisTampil.length} baris • {formatRibuan(totalCetakTampil)} cetak
            </span>
            <div className={`relative grid grid-cols-3 rounded-xl border p-1 text-[11px] font-bold ${s.garisKuat} ${s.chip}`} role="tablist" aria-label="Filter rekap">
              <span
                aria-hidden
                className={`tab-thumb absolute top-1 bottom-1 rounded-lg z-0 ${dark ? "bg-brand" : "bg-pine"}`}
                style={{
                  left: 4,
                  width: "calc((100% - 8px) / 3)",
                  transform: `translateX(${mode === "harian" ? 0 : mode === "mingguan" ? 100 : 200}%)`,
                }}
              />
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setModalFilterMode(t.key)}
                  aria-label={`Filter ${t.label}`}
                  aria-pressed={mode === t.key}
                  className={`relative z-10 text-[11px] uppercase tracking-widest px-3 py-2 rounded-lg transition-colors cursor-pointer ${mode === t.key ? "bg-pine text-cream font-bold" : dark ? "text-cream/30 hover:text-cream hover:bg-cream/10" : "text-pine/70 hover:text-pine hover:bg-pine/10"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Badge pill filter periode aktif */}
            {filterKustom && (
              <div className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11.5px] font-bold ${
                dark ? "border-brand/40 bg-brand/15 text-cream" : "border-amber-300 bg-amber-50 text-amber-900"
              }`}>
                <IconCalendar className={`h-3.5 w-3.5 ${dark ? "text-brand" : "text-amber-700"}`} />
                <span>{filterKustom.label}</span>
                <button
                  type="button"
                  onClick={() => setModalFilterMode(filterKustom.mode)}
                  className={`ml-1 underline cursor-pointer text-[11px] font-extrabold ${dark ? "text-brand hover:text-brand-soft" : "text-amber-800 hover:text-amber-950"}`}
                >
                  Ubah
                </button>
                <button
                  type="button"
                  onClick={handleResetFilter}
                  title="Hapus filter periode"
                  aria-label="Hapus filter periode"
                  className="ml-1 grid h-4 w-4 place-items-center rounded-full bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 text-[10px] font-black cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowModalCetak(true)}
                className="btn-press flex h-10 items-center gap-2 rounded-xl bg-brand px-5 text-[12.5px] font-bold text-white shadow-[0_8px_20px_rgba(217,119,6,0.3)] hover:bg-brand-deep cursor-pointer"
              >
                <IconPrint className="h-4 w-4" />
                Cetak Laporan
              </button>
            </div>
          </div>
        </div>

        {/* ===== tabel rekap ===== */}
        <div className="px-5 pb-5 sm:px-6">
          {errorBaris && !memuatBaris ? (
            <KotakGagal
              dark={dark}
              pesan={errorBaris}
              cobaLabel="Muat ulang"
              onCoba={() => {
                setMuatanBaris(null);
                setCobaBaris((n) => n + 1);
              }}
            />
          ) : memuatBaris ? (
            <div role="status" className="space-y-2">
              <p className={`text-[12.5px] font-semibold ${s.sub}`}>Memuat rekap produksi…</p>
              <div className={`overflow-hidden rounded-2xl border ${s.garis}`}>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={`shimmer-wrap h-11 border-b last:border-b-0 ${dark ? "bg-cream/10" : "bg-cream-muted"} ${s.garis}`} />
                ))}
              </div>
            </div>
          ) : barisTampil.length === 0 ? (
            <div className={`rounded-2xl border px-4 py-8 text-center ${s.panel}`}>
              <p className={`text-[14px] font-bold ${s.judul}`}>
                {baris.length === 0
                  ? "Belum ada catatan produksi"
                  : filterKustom
                  ? `Tidak ada catatan pada periode ${filterKustom.label}`
                  : "Tidak ada baris yang cocok"}
              </p>
              <p className={`mt-1 text-[12.5px] ${s.sub}`}>
                {filterKustom
                  ? "Coba pilih tanggal/minggu/bulan lain atau klik tombol reset filter di bawah."
                  : baris.length === 0
                  ? "Catat cetakan lewat menu Input, atau isi tabel product_harian lebih dulu, lalu muat ulang halaman ini."
                  : "Coba kata kunci lain, mis. “selesai”, “2026-10-17”, atau id baris."}
              </p>
              {filterKustom && (
                <button
                  type="button"
                  onClick={handleResetFilter}
                  className={`mt-3 btn-press inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[12px] font-bold ${s.garisKuat} ${s.chip} cursor-pointer`}
                >
                  ✕ Reset Filter Periode
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className={`w-full min-w-[560px] overflow-hidden rounded-2xl border text-left text-[13px] ${s.garis}`}>
                <caption className="sr-only">Rekap produksi harian yang dimuat dari server</caption>
                <thead>
                  <tr className={s.kepalaTabel}>
                    <th scope="col" className="px-4 py-3 text-[11px] font-bold tracking-widest uppercase">
                      ID
                    </th>
                    <th scope="col" className="px-4 py-3 text-[11px] font-bold tracking-widest uppercase">
                      Tanggal / Shift
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-[11px] font-bold tracking-widest uppercase">
                      Cetak
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-[11px] font-bold tracking-widest uppercase">
                      Sisa Belum Lunas
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-[11px] font-bold tracking-widest uppercase">
                      Masak
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-[11px] font-bold tracking-widest uppercase">
                      Total Harga
                    </th>
                    <th scope="col" className="px-4 py-3 text-[11px] font-bold tracking-widest uppercase">
                      Status Bayar
                    </th>
                    <th scope="col" className="px-4 py-3 text-[11px] font-bold tracking-widest uppercase">
                      Pelanggan
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {barisTampil.map((r, i) => (
                    <tr
                      key={String(r.id)}
                      className={`row-enter border-t transition-colors ${s.baris} ${s.barisZebra}`}
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <td className={`px-4 py-3 font-mono text-[12px] font-bold ${s.badgeHarga}`}>{String(r.id)}</td>
                      <td className="px-4 py-3 font-semibold">
                        {r.tanggal}
                        {r.waktu_wib ? <span className={`block text-[11px] font-medium ${s.sub}`}>{r.waktu_wib}</span> : null}
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">{formatRibuan(r.jumlah_cetak)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">
                        {(() => {
                          const info = pembayaran[String(r.id)];
                          if (info?.sisa !== undefined) return rupiah(info.sisa);
                          if (r.sisa !== undefined && r.sisa !== null) return rupiah(r.sisa);
                          const total = r.total ?? (Number(r.jumlah_cetak) * hargaCetakAktif);
                          const dibayar = info?.nominalRupiah ?? ((info?.cetakDibayar ?? 0) * hargaCetakAktif);
                          const sisa = Math.max(0, total - dibayar);
                          return rupiah(sisa);
                        })()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{Number(r.jumlah_masak)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{rupiah(r.total ?? (Number(r.jumlah_cetak) * hargaCetakAktif))}</td>
                      <td className="px-4 py-3 align-middle">
                        <FormStatusBayar
                          id={String(r.id)}
                          rincianId={r.rincian_id ? String(r.rincian_id) : undefined}
                          jumlahCetak={Number(r.jumlah_cetak)}
                          totalHarga={r.total ?? (Number(r.jumlah_cetak) * hargaCetakAktif)}
                          hargaCetakAktif={hargaCetakAktif}
                          sisaDb={r.sisa}
                          statusDb={r.status_pembayaran}
                          dataBayar={pembayaran[String(r.id)]}
                          onKirim={handleSimpanPembayaran}
                          dark={dark}
                        />
                      </td>
                      <td className="px-4 py-3 text-[13px]">
                        {r.nama && r.nama !== "-" ? (
                          <span className="block max-w-[220px] truncate font-medium" title={r.nama}>
                            {r.nama}
                          </span>
                        ) : namaPelanggan(r.created_at).length > 0 ? (
                          <span className="block max-w-[220px] truncate font-medium" title={namaPelanggan(r.created_at).join(", ")}>
                            {namaPelanggan(r.created_at).join(", ")}
                          </span>
                        ) : (
                          <span className={s.redup}>{muatPelanggan ? "…" : "-"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={`border-t-2 font-extrabold ${dark ? "border-cream/15 bg-pine-deep/60" : "border-pine/15 bg-cream/70"}`}>
                    <td colSpan={2} className="px-4 py-3 text-[12px] tracking-wide uppercase">
                      Total tampil ({barisTampil.length} baris)
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatRibuan(totalCetakTampil)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold">
                      {rupiah(totalSisaBelumLunasTampil)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatRibuan(totalMasakTampil)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatRibuan(totalHargaTampil)}
                    </td>
                    <td className={`px-4 py-3 text-right text-[11px] font-bold tabular-nums ${dark ? "text-emerald-300" : "text-emerald-700"}`}>
                      {totalNominalDibayarTampil > 0 ? `Terbayar ${rupiah(totalNominalDibayarTampil)}` : ""}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {pagination && !memuatBaris && !errorBaris && (
            <div className={`mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] font-semibold ${s.sub}`}>
              <p>
                Halaman {pagination.page} dari {Math.max(1, pagination.total_pages)} • {formatRibuan(pagination.total)} baris
                tersimpan
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHalaman((h) => Math.max(1, h - 1))}
                  disabled={pagination.page <= 1}
                  className={`btn-press h-9 rounded-xl border px-3 font-bold disabled:opacity-40 ${s.garisKuat} ${s.chip} ${s.hantu}`}
                >
                  ← Sebelumnya
                </button>
                <button
                  type="button"
                  onClick={() => setHalaman((h) => Math.min(Math.max(1, pagination.total_pages), h + 1))}
                  disabled={pagination.page >= pagination.total_pages}
                  className={`btn-press h-9 rounded-xl border px-3 font-bold disabled:opacity-40 ${s.garisKuat} ${s.chip} ${s.hantu}`}
                >
                  Berikutnya →
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {showModalCetak && (
        <ModalCetakLaporan
          dark={dark}
          hargaCetakAktif={hargaCetakAktif}
          onTutup={() => setShowModalCetak(false)}
        />
      )}

      {modalFilterMode && (
        <ModalFilterLaporan
          modeAwal={modalFilterMode}
          dark={dark}
          filterSaatIni={filterKustom}
          onTutup={() => setModalFilterMode(null)}
          onTerapkan={handleTerapkanFilter}
          onReset={filterKustom ? handleResetFilter : undefined}
        />
      )}
    </div>
  );
}