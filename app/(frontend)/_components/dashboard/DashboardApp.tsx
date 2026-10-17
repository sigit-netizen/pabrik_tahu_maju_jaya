"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AiView from "./AiView";
import DashboardView from "./DashboardView";
import InputView from "./InputView";
import SettingsView from "./SettingsView";
import { StatCard } from "./StatCard";
import { Logo } from "./Logo";
import { hariIniLabel, type DashboardData, type Pengguna, type RingkasanDashboard, type ViewKey } from "./data";
import { skin } from "./theme";

const NAV: { key: ViewKey; label: string; icon: string; desc: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "◧", desc: "Grafik & rekap" },
  { key: "input", label: "Input", icon: "✎", desc: "Catat cetak" },
  { key: "ai", label: "AI", icon: "✦", desc: "Prediksi" },
  { key: "pengaturan", label: "Pengaturan", icon: "⚙", desc: "Profil & harga" },
];

const TITLES: Record<ViewKey, { t: string; s: string }> = {
  dashboard: { t: "Dashboard Produksi", s: "Pantau cetakan, memasak & rekap shift hari ini." },
  input: { t: "Input Cetakan", s: "Catat papan tercetak & masak per pelanggan." },
  ai: { t: "Estimasi Produksi", s: "Perkiraan kebutuhan cetakan untuk pekan depan." },
  pengaturan: { t: "Pengaturan", s: "Kelola profil, tampilan, dan harga tahu." },
};

export default function DashboardApp() {
  const router = useRouter();

  const [view, setView] = useState<ViewKey>("dashboard");
  const [dark, setDarkState] = useState(() => {
    try {
      return (JSON.parse(localStorage.getItem("tmj_settings") || "{}") as { dark?: boolean }).dark === true;
    } catch {
      return false;
    }
  });
  const [toast, setToast] = useState<string | null>(null);
  const [toastKey, setToastKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  /* sesi */
  const [cekSesi, setCekSesi] = useState(true);
  const [pengguna, setPengguna] = useState<Pengguna | null>(null);
  const [keluar, setKeluar] = useState(false);

  /* ringkasan untuk kartu KPI */
  const [ringkasan, setRingkasan] = useState<RingkasanDashboard | null>(null);
  const [ringkasanMock, setRingkasanMock] = useState(false);
  const [diperbarui, setDiperbarui] = useState<Date | null>(null);

  const s = skin(dark);

  function onToast(msg: string) {
    setToast(msg);
    setToastKey((k) => k + 1);
  }

  /* Toast menutup sendiri — sebelumnya hanya bisa ditutup manual. */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toastKey, toast]);

  /* Guard: /dashboard tidak boleh terbuka tanpa sesi. */
  useEffect(() => {
    let batal = false;
    (async () => {
      try {
        const res = await fetch("/api/proxy/me", { credentials: "include", cache: "no-store" });
        if (batal) return;
        if (!res.ok) {
          router.replace("/");
          return;
        }
        const json = await res.json().catch(() => null);
        if (!batal && json?.data) setPengguna(json.data as Pengguna);
      } catch {
        if (!batal) router.replace("/");
      } finally {
        if (!batal) setCekSesi(false);
      }
    })();
    return () => {
      batal = true;
    };
  }, [router]);

  /* Ringkasan untuk KPI. Kegagalan tidak diblokir halaman — kartu akan tampil "—". */
  useEffect(() => {
    let batal = false;
    (async () => {
      try {
        const res = await fetch("/api/dashboard", { credentials: "include", cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (batal) return;
        if (res.ok && json?.status === "success" && json.data) {
          const d = json.data as DashboardData;
          setRingkasan(d.ringkasan ?? null);
          setRingkasanMock(d.is_mock_data === true);
          setDiperbarui(new Date());
        }
      } catch {
        /* biarkan null — UI menampilkan "—" */
      }
    })();
    return () => {
      batal = true;
    };
  }, []);

  function ubahDark(v: boolean) {
    setDarkState(v);
    try {
      const raw = localStorage.getItem("tmj_settings");
      const j = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      localStorage.setItem("tmj_settings", JSON.stringify({ ...j, dark: v }));
    } catch (e) {
      console.warn("[tema] localStorage tidak bisa ditulis:", e);
    }
  }

  async function keluarPengguna() {
    if (keluar) return;
    setKeluar(true);
    try {
      await fetch("/api/proxy/logout", { method: "POST", credentials: "include" });
    } catch {
      /* tetap keluar dari sisi UI */
    }
    try {
      sessionStorage.removeItem("ptmj_user");
    } catch (e) {
      console.warn("[auth] sessionStorage tidak bisa dibersihkan:", e);
    }
    router.replace("/");
  }

  /* ---- Layar saat sesi dicek ---- */
  if (cekSesi) {
    return (
      <div className={`grid min-h-screen place-items-center ${dark ? "bg-pine-deep" : "bg-cream"}`}>
        <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
          <span className={`h-8 w-8 animate-spin rounded-full border-2 ${dark ? "border-cream/20 border-t-brand" : "border-pine/15 border-t-brand"}`} />
          <p className={`text-[12.5px] font-semibold ${dark ? "text-cream/60" : "text-pine/60"}`}>Memeriksa sesi…</p>
        </div>
      </div>
    );
  }

  const totalCetak = ringkasan?.total_cetak ?? 0;
  const totalMasak = ringkasan?.total_masak ?? 0;
  const belumMasak = Math.max(0, totalCetak - totalMasak);
  const inisial = (pengguna?.username || pengguna?.email || "?").trim().charAt(0).toUpperCase();
  const waktuMuat = diperbarui
    ? diperbarui.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).replace(/\./g, ":")
    : null;

  return (
    <div className={`min-h-screen transition-colors duration-500 ${dark ? "bg-pine-deep text-cream" : "bg-cream text-pine"}`}>
      {/* ===== header ===== */}
      <header className={`no-print sticky top-0 z-30 border-b backdrop-blur-xl ${dark ? "border-cream/10 bg-pine-deep/85" : "border-line bg-cream/85"}`}>
        <div className="mx-auto flex h-[64px] w-full max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              className={`btn-press grid h-10 w-10 place-items-center rounded-xl border lg:hidden ${dark ? "border-cream/15" : "border-line-strong bg-white"}`}
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Tutup menu" : "Buka menu"}
              aria-expanded={menuOpen}
            >
              ☰
            </button>
            <Logo />
            <span className="leading-tight">
              <span className="block text-[14.5px] font-extrabold tracking-tight">Tahu Maju Jaya</span>
              <span className={`block text-[10.5px] font-bold tracking-[0.14em] uppercase ${dark ? "text-cream/55" : "text-pine/50"}`}>
                Pencatatan Pabrik Tahu
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <p className={`hidden text-[12px] font-bold md:block ${dark ? "text-cream/70" : "text-pine/70"}`}>
              {hariIniLabel()}
            </p>
            <button
              onClick={keluarPengguna}
              disabled={keluar}
              className={`btn-press hidden h-10 items-center rounded-xl border px-4 text-[12.5px] font-bold sm:flex disabled:opacity-60 ${
                dark ? "border-cream/15 hover:bg-cream/10" : "border-line-strong bg-white hover:bg-cream"
              }`}
            >
              {keluar ? "Keluar…" : "Keluar"}
            </button>
            <span
              className={`grid h-10 w-10 place-items-center rounded-xl bg-brand text-[15px] font-extrabold text-white shadow-md ${dark ? "ring-1 ring-cream/20" : ""}`}
              title={pengguna?.username || "Operator"}
              aria-label={pengguna ? `Pengguna ${pengguna.username}` : "Operator"}
            >
              {inisial}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1200px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[228px_1fr]">
        {/* ===== sidebar ===== */}
        <aside className={`no-print ${menuOpen ? "block" : "hidden"} lg:block`}>
          <nav className={`anim-rise overflow-hidden rounded-3xl border p-3 shadow-[0_16px_40px_rgba(20,52,43,0.08)] ${s.kartu} ${s.judul}`} aria-label="Navigasi utama">
            {NAV.map((n, i) => {
              const active = view === n.key;
              return (
                <button
                  key={n.key}
                  onClick={() => { setView(n.key); setMenuOpen(false); }}
                  aria-current={active ? "page" : undefined}
                  className={`nav-item mb-1.5 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left ${
                    active ? "bg-pine text-cream shadow-md" : dark ? "text-cream/80 hover:bg-cream/10" : "text-pine/75 hover:bg-cream hover:text-pine"
                  }`}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[16px] transition-transform ${
                      active ? "scale-105 bg-brand text-white" : dark ? "bg-cream/10" : "border border-line bg-cream"
                    }`}
                  >
                    {n.icon}
                  </span>
                  <span className="leading-tight">
                    <span className="block text-[13.5px] font-extrabold">{n.label}</span>
                    <span className={`block text-[11px] font-medium ${active ? "text-cream/65" : dark ? "text-cream/50" : "text-pine/55"}`}>{n.desc}</span>
                  </span>
                  {active && <span className="ml-auto text-brand-soft">▸</span>}
                </button>
              );
            })}

            {/* Ringkasan nyata — sebelumnya angka 96/6 papan itu karangan */}
            {ringkasan ? (
              <div className="relative mt-2 overflow-hidden rounded-2xl bg-pine p-4 text-cream">
                <div className="dot-grid absolute inset-0" aria-hidden />
                <p className="relative text-[12px] font-extrabold">
                  Total {totalCetak.toLocaleString("id-ID")} papan
                </p>
                <p className="relative mt-1 text-[11.5px] leading-4 text-cream/65">
                  {belumMasak > 0 ? `${belumMasak} papan belum masak.` : "Semua papan hari ini sudah masak."}
                </p>
                <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-cream/15">
                  <div
                    className="h-full rounded-full bg-brand transition-[width] duration-500"
                    style={{ width: `${totalCetak > 0 ? Math.round((totalMasak / totalCetak) * 100) : 0}%` }}
                  />
                </div>
                <button
                  onClick={() => { setView("input"); setMenuOpen(false); }}
                  className="btn-press relative mt-3 h-9 w-full rounded-xl bg-brand text-[12px] font-bold text-white hover:bg-brand-deep"
                >
                  Lanjut input ▸
                </button>
              </div>
            ) : (
              <p className={`mt-2 px-3 py-4 text-center text-[11.5px] font-medium ${s.redup}`}>
                Ringkasan muncul setelah sesi & data tersedia.
              </p>
            )}
            <p className={`mt-3 px-2 text-center text-[10.5px] font-semibold ${dark ? "text-cream/45" : "text-pine/45"}`}>v2.5 • frontend</p>
          </nav>
        </aside>

        {/* ===== konten ===== */}
        <main className="min-w-0">
          <div className="anim-rise mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="text-[21px] font-extrabold tracking-tight sm:text-[24px]">{TITLES[view].t}</h1>
              <p className={`text-[12.5px] font-medium ${dark ? "text-cream/60" : "text-pine/60"}`}>{TITLES[view].s}</p>
            </div>
            {waktuMuat && (
              <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[11.5px] font-bold ${dark ? "border-cream/15 bg-pine" : "border-line bg-white"}`}>
                <span className="h-2 w-2 rounded-full bg-emerald-500" style={{ animation: "tmj-pulse-dot 1.6s infinite" }} />
                Diperbarui {waktuMuat} WIB
              </div>
            )}
          </div>

          {ringkasanMock && (
            <p role="status" className="mb-4 rounded-2xl border border-amber-300/60 bg-amber-50/80 px-4 py-2.5 text-[12px] font-semibold text-amber-900">
              Database produksi masih kosong — angka di bawah adalah data contoh dari server, bukan hasil pencatatan sebenarnya.
            </p>
          )}

          {view === "dashboard" && (
            <div className="anim-view" key="dash">
              <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
                <StatCard dark={dark} label="Cetakan tercatat" value={totalCetak} suffix="papan" delta={ringkasan ? `${totalCetak - totalMasak} belum masak` : "Belum ada data"} icon="▦" delay={0} accent />
                <StatCard dark={dark} label="Sudah masak" value={totalMasak} suffix="papan" delta={ringkasan && totalCetak > 0 ? `${Math.round((totalMasak / totalCetak) * 100)}% selesai` : "—"} icon="♨" delay={80} />
                <StatCard dark={dark} label="Belum masak" value={belumMasak} suffix="papan" delta={totalCetak > 0 ? `${Math.round((belumMasak / totalCetak) * 100)}% tertinggal` : "—"} icon="◷" delay={160} />
                <StatCard dark={dark} label="Total pendapatan" value={Math.round((ringkasan?.total_pendapatan ?? 0) / 1000)} suffix="rb" delta={ringkasan?.total_pendapatan_rupiah ?? "—"} icon="Rp" delay={240} />
              </div>
              <DashboardView onToast={onToast} dark={dark} />
            </div>
          )}
          {view === "input" && (
            <div className="anim-view" key="input">
              <InputView onToast={onToast} dark={dark} />
            </div>
          )}
          {view === "ai" && (
            <div className="anim-view" key="ai">
              <AiView onToast={onToast} dark={dark} />
            </div>
          )}
          {view === "pengaturan" && (
            <div className="anim-view" key="set">
              <SettingsView onToast={onToast} dark={dark} setDark={ubahDark} />
            </div>
          )}

          <footer className={`mt-6 flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-[11px] font-medium ${dark ? "border-cream/10 text-cream/50" : "border-line text-pine/50"}`}>
            <p>© 2026 Pabrik Tahu Maju Jaya — dicatat rapi, dijual berkah.</p>
            <p className="flex items-center gap-3">
              <Link href="/api-doc" className="font-bold hover:underline">API Doc</Link>
              <button onClick={keluarPengguna} className="font-bold hover:underline">Keluar</button>
              <span className="font-mono">palet #F6F1E7 • #14342B • #D97706</span>
            </p>
          </footer>
        </main>
      </div>

      {/* toast */}
      {toast && (
        <div key={toastKey} className="no-print fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-[480px] -translate-x-1/2" role="status">
          <div className="anim-toast flex items-start gap-3 rounded-2xl border border-cream/10 bg-pine px-4 py-3.5 text-cream shadow-2xl">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-[13px] font-bold text-white">✓</span>
            <p className="flex-1 text-[12.5px] leading-5 font-semibold">{toast}</p>
            <button onClick={() => setToast(null)} aria-label="Tutup notifikasi" className="text-cream/70 hover:text-cream">×</button>
          </div>
        </div>
      )}
    </div>
  );
}