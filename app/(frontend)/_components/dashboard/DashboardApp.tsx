"use client";

import { useState } from "react";
import AiView from "./AiView";
import DashboardView from "./DashboardView";
import InputView from "./InputView";
import SettingsView from "./SettingsView";
import { StatCard } from "./StatCard";
import { Logo } from "./Logo";
import { hariIniLabel, type ViewKey } from "./data";

const NAV: { key: ViewKey; label: string; icon: string; desc: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "◧", desc: "Grafik & rekap" },
  { key: "input", label: "Input", icon: "✎", desc: "Catat cetak" },
  { key: "ai", label: "AI", icon: "✦", desc: "Prediksi" },
  { key: "pengaturan", label: "Pengaturan", icon: "⚙", desc: "Profil" },
];

const TITLES: Record<ViewKey, { t: string; s: string }> = {
  dashboard: { t: "Dashboard Produksi", s: "Pantau cetakan, masakan & rekap shift hari ini." },
  input: { t: "Input Cetakan", s: "Catat papan tercetak & masak per shift." },
  ai: { t: "AI Prediksi", s: "Estimasi kebutuhan cetakan minggu depan." },
  pengaturan: { t: "Pengaturan", s: "Kelola profil & tampilan." },
};

export default function DashboardApp() {
  const [view, setView] = useState<ViewKey>("dashboard");
  const [dark, setDark] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toastKey, setToastKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  function onToast(msg: string) {
    setToast(msg);
    setToastKey((k) => k + 1);
  }

  const shellBg = dark ? "bg-pine-deep text-cream" : "bg-cream text-pine";
  const panelBg = dark ? "bg-pine text-cream border-cream/10" : "bg-white text-pine border-line";

  return (
    <div className={`min-h-screen transition-colors duration-500 ${shellBg}`}>
      {/* ===== header ala wireframe: logo + nama website ===== */}
      <header className={`no-print sticky top-0 z-30 border-b backdrop-blur-xl ${dark ? "border-cream/10 bg-pine-deep/85" : "border-line bg-cream/85"}`}>
        <div className="mx-auto flex h-[64px] w-full max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              className={`btn-press grid h-10 w-10 place-items-center rounded-xl border lg:hidden ${dark ? "border-cream/15" : "border-line-strong bg-white"}`}
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Buka menu"
              aria-expanded={menuOpen}
            >
              ☰
            </button>
            <Logo />
            <span className="leading-tight">
              <span className="block text-[14.5px] font-extrabold tracking-tight">
                Tahu Maju Jaya
                <span className="ml-2 hidden rounded-full bg-brand px-2 py-0.5 align-middle text-[10px] font-bold tracking-widest text-white uppercase sm:inline">Live</span>
              </span>
              <span className={`block text-[10.5px] font-bold tracking-[0.14em] uppercase ${dark ? "text-cream/55" : "text-pine/50"}`}>
                Pencatatan Pabrik Tahu
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`hidden text-right md:block`}>
              <p className="text-[12px] font-bold">{hariIniLabel()}</p>
              <p className={`flex items-center justify-end gap-1.5 text-[11px] font-semibold ${dark ? "text-cream/60" : "text-pine/55"}`}>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" style={{ animation: "tmj-live-dot 1.8s infinite" }} />
                Shift sore berjalan
              </p>
            </div>
            <a href="/login" className={`btn-press hidden h-10 items-center rounded-xl border px-4 text-[12.5px] font-bold sm:flex ${dark ? "border-cream/15 hover:bg-cream/10" : "border-line-strong bg-white hover:bg-cream"}`}>
              Keluar
            </a>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-[15px] font-extrabold text-white shadow-md" title="Operator">J</span>
          </div>
        </div>
        {/* marquee info */}
        <div className={`overflow-hidden border-t py-1.5 ${dark ? "border-cream/10 bg-pine" : "border-line bg-pine text-cream"}`}>
          <div className="marquee-track flex w-max gap-10 text-[11px] font-semibold whitespace-nowrap">
            {[0, 1].map((k) => (
              <span key={k} className="flex gap-10" aria-hidden={k === 1}>
                <span>● Rendaman batch 4 siap digiling 14.30</span>
                <span>● Stok kedelai 420 kg — aman 3 hari</span>
                <span>● Jumat diprediksi puncak 182 papan</span>
                <span>● Cuci cetakan 12 unit sebelum shift malam</span>
              </span>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1200px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[228px_1fr]">
        {/* ===== sidebar ala wireframe ===== */}
        <aside className={`no-print ${menuOpen ? "block" : "hidden"} lg:block`}>
          <nav className={`anim-rise overflow-hidden rounded-3xl border p-3 ${panelBg} shadow-[0_16px_40px_rgba(20,52,43,0.08)]`} aria-label="Navigasi utama">
            {NAV.map((n, i) => {
              const active = view === n.key;
              return (
                <button
                  key={n.key}
                  onClick={() => { setView(n.key); setMenuOpen(false); }}
                  aria-current={active ? "page" : undefined}
                  className={`nav-item mb-1.5 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left ${active ? "bg-pine text-cream shadow-md" : dark ? "hover:bg-cream/10 text-cream/80" : "hover:bg-cream text-pine/75 hover:text-pine"}`}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[16px] transition-transform ${active ? "bg-brand text-white scale-105" : dark ? "bg-cream/10" : "bg-cream border border-line"}`}>
                    {n.icon}
                  </span>
                  <span className="leading-tight">
                    <span className="block text-[13.5px] font-extrabold">{n.label}</span>
                    <span className={`block text-[11px] font-medium ${active ? "text-cream/65" : dark ? "text-cream/50" : "text-pine/50"}`}>{n.desc}</span>
                  </span>
                  {active && <span className="ml-auto text-brand-soft">▸</span>}
                </button>
              );
            })}

            {/* kartu tips */}
            <div className="relative mt-2 overflow-hidden rounded-2xl bg-pine p-4 text-cream">
              <div className="dot-grid absolute inset-0" aria-hidden />
              <p className="relative text-[12px] font-extrabold">🔥 Sore ini 96 papan</p>
              <p className="relative mt-1 text-[11.5px] leading-4 text-cream/65">Sisa 6 papan belum masak — kejar sebelum 17.00.</p>
              <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-cream/15">
                <div className="h-full w-[88%] rounded-full bg-brand" />
              </div>
              <button onClick={() => { setView("input"); setMenuOpen(false); }} className="btn-press relative mt-3 h-9 w-full rounded-xl bg-brand text-[12px] font-bold text-white hover:bg-brand-deep">
                Lanjut input ▸
              </button>
            </div>
            <p className={`mt-3 px-2 text-center text-[10.5px] font-semibold ${dark ? "text-cream/40" : "text-pine/40"}`}>v2.4 • frontend lokal • backend utuh</p>
          </nav>
        </aside>

        {/* ===== konten ===== */}
        <main className="min-w-0">
          <div className="anim-rise mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="text-[21px] font-extrabold tracking-tight sm:text-[24px]">{TITLES[view].t}</h1>
              <p className={`text-[12.5px] font-medium ${dark ? "text-cream/60" : "text-pine/60"}`}>{TITLES[view].s}</p>
            </div>
            {view === "dashboard" && (
              <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[11.5px] font-bold ${dark ? "border-cream/15 bg-pine" : "border-line bg-white"}`}>
                <span className="h-2 w-2 rounded-full bg-emerald-500" style={{ animation: "tmj-pulse-dot 1.6s infinite" }} />
                Data diperbarui 2 mnt lalu
              </div>
            )}
          </div>

          {view === "dashboard" && (
            <div className="anim-view" key="dash">
              <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
                <StatCard label="Cetakan hari ini" value={214} suffix="papan" delta="▲ 12% vs kemarin" icon="▦" delay={0} accent />
                <StatCard label="Sudah masak" value={188} suffix="papan" delta="88% selesai" icon="♨" delay={80} />
                <StatCard label="Antre masak" value={26} suffix="papan" delta="2 batch" icon="◷" delay={160} />
                <StatCard label="Estimasi omzet" value={1120} suffix="rb" delta="Rp 1,12 jt" icon="Rp" delay={240} />
              </div>
              <DashboardView onToast={onToast} />
            </div>
          )}
          {view === "input" && (
            <div className="anim-view" key="input">
              <InputView onToast={onToast} />
            </div>
          )}
          {view === "ai" && (
            <div className="anim-view" key="ai">
              <AiView onToast={onToast} />
            </div>
          )}
          {view === "pengaturan" && (
            <div className="anim-view" key="set">
              <SettingsView onToast={onToast} dark={dark} setDark={setDark} />
            </div>
          )}

          <footer className={`mt-6 flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-[11px] font-medium ${dark ? "border-cream/10 text-cream/45" : "border-line text-pine/45"}`}>
            <p>© 2026 Pabrik Tahu Maju Jaya — dicatat rapi, dijual berkah.</p>
            <p className="flex gap-3">
              <a href="/api-doc" className="font-bold hover:underline">API Doc</a>
              <a href="/login" className="font-bold hover:underline">Login</a>
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
            <button onClick={() => setToast(null)} aria-label="Tutup notifikasi" className="text-cream/60 hover:text-cream">×</button>
          </div>
        </div>
      )}
    </div>
  );
}
