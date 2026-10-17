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
import { IconAlert } from "./icons";
import { skin } from "./theme";
import {
  formatRibuan,
  rupiah,
  tanggalPendek,
  type BarisProduksi,
  type DashboardData,
  type Pagination,
  type TrenProduksi,
} from "./data";

type Mode = "harian" | "mingguan" | "bulanan";

const TABS: { key: Mode; label: string }[] = [
  { key: "harian", label: "Harian" },
  { key: "mingguan", label: "Mingguan" },
  { key: "bulanan", label: "Bulanan" },
];

const BATAS_HALAMAN = 20;
const PANEL_GRAFIK = "panel-grafik-produksi";

const FOKUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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

type StatusRekap = "Selesai" | "Proses" | "Ditekan";
type MuatanDash = { kunci: number; data: DashboardData | null; pesan: string | null };
type MuatanBaris = { kunci: string; baris: BarisProduksi[]; pagination: Pagination | null; pesan: string | null };

/* ---------- utilitas data ---------- */

function statusRekap(b: BarisProduksi): StatusRekap {
  if (b.jumlah_masak <= 0) return "Ditekan";
  if (b.jumlah_masak >= b.jumlah_cetak) return "Selesai";
  return "Proses";
}

function labelBulan(kunci: string) {
  const [tahun, bulan] = kunci.split("-").map(Number);
  if (!tahun || !bulan) return kunci;
  return new Date(tahun, bulan - 1, 1).toLocaleDateString("id-ID", { month: "short", year: "numeric" });
}

/** Agregasi tren dari API sesuai rentang tab yang dipilih. */
function agregatTren(tren: TrenProduksi[], mode: Mode): { labels: string[]; values: number[] } {
  if (tren.length === 0) return { labels: [], values: [] };
  if (mode === "harian") {
    return {
      labels: tren.map((t) => tanggalPendek(t.tanggal)),
      values: tren.map((t) => Number(t.jumlah_cetak) || 0),
    };
  }
  if (mode === "mingguan") {
    const total = tren.reduce((a, t) => a + (Number(t.jumlah_cetak) || 0), 0);
    const awal = tren[0].tanggal;
    const akhir = tren[tren.length - 1].tanggal;
    return { labels: [`${tanggalPendek(awal)}–${tanggalPendek(akhir)}`], values: [total] };
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

function StatusPill({ status, dark }: { status: StatusRekap; dark: boolean }) {
  const cls =
    status === "Selesai"
      ? dark
        ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
        : "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "Proses"
        ? dark
          ? "border-brand/50 bg-brand/15 text-brand"
          : "border-amber-200 bg-amber-50 text-amber-800"
        : dark
          ? "border-cream/15 bg-cream/10 text-cream/70"
          : "border-line-strong bg-cream-muted text-pine";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${cls}`}>
      <span
        className="h-1.5 w-1.5 rounded-full bg-current"
        style={status === "Proses" ? { animation: "tmj-blink 1.4s infinite" } : undefined}
        aria-hidden
      />
      {status}
    </span>
  );
}

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
      className={`flex flex-wrap items-start gap-3 rounded-2xl border px-4 py-3.5 ${
        dark ? "border-red-400/35 bg-red-400/10" : "border-red-300/60 bg-red-50/70"
      }`}
    >
      <IconAlert className={`mt-px h-4 w-4 shrink-0 ${dark ? "text-red-300" : "text-red-600"}`} />
      <p className={`min-w-0 flex-1 text-[12.5px] leading-5 font-semibold ${dark ? "text-red-200" : "text-red-800"}`}>
        {pesan}
      </p>
      <button
        type="button"
        onClick={onCoba}
        className={`btn-press h-8 shrink-0 rounded-lg border px-3 text-[12px] font-bold ${
          dark ? "border-red-300/40 text-red-200 hover:bg-red-400/10" : "border-red-300 text-red-700 hover:bg-red-100"
        }`}
      >
        {cobaLabel}
      </button>
    </div>
  );
}

/** Modal list rekap: focus masuk saat terbuka, Escape menutup, Tab terperangkap, fokus kembali ke pemicu. */
function ModalRekap({
  dark,
  baris,
  onTutup,
}: {
  dark: boolean;
  baris: BarisProduksi[];
  onTutup: () => void;
}) {
  const s = skin(dark);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const overflowAwal = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("[data-fokus-awal]")?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onTutup();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const daftar = Array.from(panel.querySelectorAll<HTMLElement>(FOKUSABLE));
      if (daftar.length === 0) return;
      const pertama = daftar[0];
      const terakhir = daftar[daftar.length - 1];
      const aktif = document.activeElement as HTMLElement | null;
      if (!aktif || !panel.contains(aktif)) {
        e.preventDefault();
        (e.shiftKey ? terakhir : pertama).focus();
        return;
      }
      if (e.shiftKey && aktif === pertama) {
        e.preventDefault();
        terakhir.focus();
      } else if (!e.shiftKey && aktif === terakhir) {
        e.preventDefault();
        pertama.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflowAwal;
    };
  }, [onTutup]);

  return (
    <div
      className={`fixed inset-0 z-50 grid place-items-center p-4 backdrop-blur-sm ${dark ? "bg-black/65" : "bg-pine-deep/60"}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="judul-rekap"
      onClick={onTutup}
    >
      <div
        ref={panelRef}
        className={`anim-modal w-full max-w-[620px] overflow-hidden rounded-3xl shadow-2xl ${s.kartu}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between px-6 py-4 text-cream ${dark ? "bg-pine-deep" : "bg-pine"}`}>
          <div>
            <p className="text-[11px] font-bold tracking-widest text-cream/60 uppercase">Pratinjau cetak</p>
            <h3 id="judul-rekap" className="text-[16px] font-extrabold">
              List Rekap Produksi
            </h3>
          </div>
          <button
            type="button"
            data-fokus-awal
            onClick={onTutup}
            aria-label="Tutup pratinjau rekap"
            className="btn-press grid h-9 w-9 place-items-center rounded-xl bg-cream/10 text-lg hover:bg-cream/20"
          >
            ×
          </button>
        </div>

        <div className="max-h-[46vh] overflow-auto p-6">
          {baris.length === 0 ? (
            <p className={`py-6 text-center text-[13px] font-semibold ${s.sub}`}>
              Tidak ada baris untuk dicetak. Ubah filter atau muat halaman lain.
            </p>
          ) : (
            <table className="w-full border-collapse text-[12.5px]">
              <caption className="sr-only">Rekap produksi lengkap untuk pencetakan</caption>
              <thead>
                <tr className={`border-b ${s.garis}`}>
                  <th scope="col" className={`py-2 pr-2 text-left text-[10.5px] font-bold tracking-widest uppercase ${s.label}`}>
                    ID
                  </th>
                  <th scope="col" className={`py-2 pr-2 text-left text-[10.5px] font-bold tracking-widest uppercase ${s.label}`}>
                    Tanggal
                  </th>
                  <th scope="col" className={`py-2 pr-2 text-right text-[10.5px] font-bold tracking-widest uppercase ${s.label}`}>
                    Cetak/Masak
                  </th>
                  <th scope="col" className={`py-2 pr-2 text-right text-[10.5px] font-bold tracking-widest uppercase ${s.label}`}>
                    Pendapatan
                  </th>
                  <th scope="col" className={`py-2 text-center text-[10.5px] font-bold tracking-widest uppercase ${s.label}`}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {baris.map((r) => (
                  <tr key={String(r.id)} className={`border-b ${s.tbody}`}>
                    <td className={`py-2.5 pr-2 font-mono text-[12px] font-bold ${s.badgeHarga}`}>{String(r.id)}</td>
                    <td className="py-2.5 pr-2 font-semibold">{r.tanggal}</td>
                    <td className="py-2.5 pr-2 text-right tabular-nums">
                      {formatRibuan(r.jumlah_cetak)}/{formatRibuan(r.jumlah_masak)}
                    </td>
                    <td className="py-2.5 pr-2 text-right tabular-nums">{r.jumlah_pendapatan_rupiah}</td>
                    <td className="py-2.5 text-center">
                      <StatusPill status={statusRekap(r)} dark={dark} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className={`mt-3 text-[11.5px] ${s.redup}`}>
            Dokumen internal Pabrik Tahu Maju Jaya • {baris.length} baris • dicetak{" "}
            {new Date().toLocaleString("id-ID")}
          </p>
        </div>

        <div className={`no-print flex gap-2 border-t px-6 py-4 ${s.garis} ${s.kepala}`}>
          <button
            type="button"
            onClick={onTutup}
            className={`btn-press h-10 flex-1 rounded-xl border text-[13px] font-bold ${s.garisKuat} ${s.chip} ${s.hantu}`}
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className={`btn-press h-10 flex-1 rounded-xl text-[13px] font-bold ${s.tombolGelap}`}
          >
            ⎙ Cetak sekarang
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- view utama ---------- */

export default function DashboardView({ onToast, dark }: { onToast: (m: string) => void; dark: boolean }) {
  const s = skin(dark);
  const [mode, setMode] = useState<Mode>("mingguan");
  const [q, setQ] = useState("");
  const [halaman, setHalaman] = useState(1);
  const [cobaDashboard, setCobaDashboard] = useState(0);
  const [cobaBaris, setCobaBaris] = useState(0);
  const [muatanDash, setMuatanDash] = useState<MuatanDash | null>(null);
  const [muatanBaris, setMuatanBaris] = useState<MuatanBaris | null>(null);
  const [showRekap, setShowRekap] = useState(false);

  const refTab = useRef<(HTMLButtonElement | null)[]>([]);
  const refPemicuRekap = useRef<HTMLButtonElement>(null);

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
  const kunciBaris = `${halaman}|${cobaBaris}`;
  useEffect(() => {
    let batal = false;
    (async () => {
      try {
        const res = await fetch(`/api/produksi?page=${halaman}&limit=${BATAS_HALAMAN}`, {
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
  }, [halaman, cobaBaris, kunciBaris]);

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

  const ringkasan = dash?.ringkasan ?? null;
  const tren = useMemo(() => dash?.grafik_tren_produksi ?? [], [dash]);
  const seri = useMemo(() => agregatTren(tren, mode), [tren, mode]);

  const barisTampil = useMemo(() => {
    const kunci = q.trim().toLowerCase();
    if (!kunci) return baris;
    return baris.filter(
      (r) =>
        String(r.id).toLowerCase().includes(kunci) ||
        r.tanggal.toLowerCase().includes(kunci) ||
        (r.waktu_wib ?? "").toLowerCase().includes(kunci) ||
        (r.jumlah_pendapatan_rupiah ?? "").toLowerCase().includes(kunci) ||
        statusRekap(r).toLowerCase().includes(kunci),
    );
  }, [baris, q]);

  const totalCetak = useMemo(() => barisTampil.reduce((a, b) => a + (Number(b.jumlah_cetak) || 0), 0), [barisTampil]);
  const totalMasak = useMemo(() => barisTampil.reduce((a, b) => a + (Number(b.jumlah_masak) || 0), 0), [barisTampil]);

  const totalCetakApi = Number(ringkasan?.total_cetak) || 0;
  const totalMasakApi = Number(ringkasan?.total_masak) || 0;
  const sisaApi = Math.max(0, totalCetakApi - totalMasakApi);
  const persenMasak = totalCetakApi > 0 ? Math.round((totalMasakApi / totalCetakApi) * 100) : 0;
  const pendapatan = ringkasan?.total_pendapatan_rupiah || rupiah(Number(ringkasan?.total_pendapatan) || 0);
  const prediksi = dash?.prediksi_mingguan ?? null;
  const ketCetak =
    tren.length > 0
      ? `Rata-rata harian ${formatRibuan(Math.round(totalCetakApi / tren.length))} papan`
      : "Ringkasan seluruh catatan tersimpan";

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

  const tutupRekap = useCallback(() => {
    setShowRekap(false);
    refPemicuRekap.current?.focus();
  }, []);

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
                  onClick={() => setMode(t.key)}
                  className={`tab-pill relative z-10 rounded-lg px-4 py-2 sm:px-6 ${
                    terpilih ? (dark ? "text-pine-deep" : "text-cream") : s.hantu
                  }`}
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
                  className={`mb-4 flex items-start gap-2.5 rounded-2xl border px-4 py-3 ${
                    dark ? "border-brand/40 bg-brand/10" : "border-amber-300/70 bg-amber-50/80"
                  }`}
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

        {/* ringkasan angka dari API */}
        {memuatDash ? (
          <div className="px-5 py-5 sm:px-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={`shimmer-wrap h-[74px] rounded-2xl ${dark ? "bg-cream/10" : "bg-cream-muted"}`} />
              ))}
            </div>
          </div>
        ) : ringkasan ? (
          <div className="px-5 py-5 sm:px-6">
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: "Total cetakan", nilai: formatRibuan(totalCetakApi), satuan: "papan", ket: ketCetak },
                { label: "Sudah masak", nilai: formatRibuan(totalMasakApi), satuan: "papan", ket: `${persenMasak}% dari cetakan` },
                { label: "Antre masak", nilai: formatRibuan(sisaApi), satuan: "papan", ket: "Cetak minus masak" },
                { label: "Pendapatan", nilai: pendapatan, satuan: "", ket: ringkasan.status_pabrik ?? "Status tidak dilaporkan" },
              ].map((k) => (
                <div key={k.label} className={`rounded-2xl border px-4 py-3 ${s.panel}`}>
                  <dt className={`text-[10.5px] font-bold tracking-[0.14em] uppercase ${s.sub}`}>{k.label}</dt>
                  <dd className={`mt-1 text-[20px] leading-none font-extrabold tracking-tight tabular-nums ${s.judul}`}>
                    {k.nilai}
                    {k.satuan ? <span className={`ml-1 text-[11px] font-bold ${s.sub}`}>{k.satuan}</span> : null}
                  </dd>
                  <dd className={`mt-1.5 text-[11px] font-medium ${s.redup}`}>{k.ket}</dd>
                </div>
              ))}
            </dl>
            <p className={`mt-3 text-[11.5px] font-medium ${s.redup}`}>
              {ringkasan.harga_cetak_aktif
                ? `Harga cetak aktif ${rupiah(Number(ringkasan.harga_cetak_aktif))} per papan`
                : "Harga cetak aktif belum ditetapkan"}{" "}
              {prediksi
                ? `• Prediksi ${tanggalPendek(prediksi.periode_mulai)}–${tanggalPendek(
                    prediksi.periode_selesai,
                  )}: ${formatRibuan(prediksi.estimasi_total_cetak)} papan`
                : ""}
            </p>
          </div>
        ) : null}

        {/* toolbar filter + cetak */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-6">
          <div className="relative min-w-[210px] flex-1">
            <span className={`pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 ${s.ikon}`} aria-hidden>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter tanggal / id / status…"
              aria-label="Filter rekap produksi"
              className={`h-10 w-full rounded-xl border pr-3 pl-10 text-[13px] font-medium transition focus:border-brand focus:shadow-[0_0_0_4px_rgba(217,119,6,0.14)] focus:outline-none ${s.input}`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`hidden rounded-lg px-3 py-2 text-[12px] font-bold sm:inline ${dark ? "bg-pine-deep text-cream/70" : "bg-cream-muted text-pine/70"}`}>
              {barisTampil.length} baris • {formatRibuan(totalCetak)} cetak
            </span>
            <button
              type="button"
              ref={refPemicuRekap}
              onClick={() => setShowRekap(true)}
              className={`btn-press h-10 rounded-xl border px-4 text-[12.5px] font-bold ${s.garisKuat} ${s.chip} ${s.hantu}`}
            >
              ⧉ List Rekap
            </button>
            <button
              type="button"
              onClick={() => {
                onToast("Membuka pratinjau cetak — gunakan Ctrl+P untuk mencetak.");
                setShowRekap(true);
              }}
              className="btn-press h-10 rounded-xl bg-brand px-5 text-[12.5px] font-bold text-white shadow-[0_8px_20px_rgba(217,119,6,0.3)] hover:bg-brand-deep"
            >
              ⎙ Cetak
            </button>
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
                {baris.length === 0 ? "Belum ada catatan produksi" : "Tidak ada baris yang cocok"}
              </p>
              <p className={`mt-1 text-[12.5px] ${s.sub}`}>
                {baris.length === 0
                  ? "Catat cetakan lewat menu Input, atau isi tabel product_harian lebih dulu, lalu muat ulang halaman ini."
                  : "Coba kata kunci lain, mis. “selesai”, “2026-10-17”, atau id baris."}
              </p>
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
                      Masak
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-[11px] font-bold tracking-widest uppercase">
                      Sisa
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-[11px] font-bold tracking-widest uppercase">
                      Status
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
                      <td className={`px-4 py-3 text-right tabular-nums ${s.label}`}>{formatRibuan(r.jumlah_masak)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span
                          className={`font-bold ${r.jumlah_cetak - r.jumlah_masak > 10 ? s.badgeHarga : s.redup}`}
                        >
                          {formatRibuan(r.jumlah_cetak - r.jumlah_masak)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <StatusPill status={statusRekap(r)} dark={dark} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={`border-t-2 font-extrabold ${dark ? "border-cream/15 bg-pine-deep/60" : "border-pine/15 bg-cream/70"}`}>
                    <td colSpan={2} className="px-4 py-3 text-[12px] tracking-wide uppercase">
                      Total tampil
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatRibuan(totalCetak)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatRibuan(totalMasak)}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${s.badgeHarga}`}>
                      {formatRibuan(totalCetak - totalMasak)}
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

      {showRekap && <ModalRekap dark={dark} baris={barisTampil} onTutup={tutupRekap} />}
    </div>
  );
}