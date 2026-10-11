"use client";

import { useEffect, useState } from "react";

export default function SettingsView({ onToast, dark, setDark }: { onToast: (m: string) => void; dark: boolean; setDark: (v: boolean) => void }) {
  const [nama, setNama] = useState("Pak Jaya — Kepala Produksi");
  const [sandi, setSandi] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tmj_settings");
      if (raw) {
        const j = JSON.parse(raw) as { nama?: string; dark?: boolean };
        if (j.nama) setNama(j.nama);
        if (typeof j.dark === "boolean") setDark(j.dark);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function apply() {
    if (!nama.trim()) {
      onToast("Nama tidak boleh kosong.");
      return;
    }
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      try {
        localStorage.setItem("tmj_settings", JSON.stringify({ nama: nama.trim(), dark }));
      } catch {}
      onToast(`Pengaturan disimpan — halo, ${nama.trim().split(" ")[0]}!`);
      setSandi("");
    }, 700);
  }

  return (
    <section className="anim-rise mx-auto w-full max-w-[560px] overflow-hidden rounded-3xl border border-line bg-white shadow-[0_20px_50px_rgba(20,52,43,0.08)]">
      <div className="bg-pine px-6 py-4 text-center text-cream">
        <p className="text-[12px] font-extrabold tracking-[0.22em] uppercase">Pengaturan</p>
        <p className="mt-0.5 text-[11.5px] text-cream/60">Profil pencatat & tampilan area produksi</p>
      </div>

      <div className="space-y-4 p-6">
        <div>
          <label htmlFor="set-nama" className="mb-1.5 block text-[11px] font-bold tracking-widest text-pine/60 uppercase">Nama</label>
          <div className="flex gap-2">
            <input
              id="set-nama"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              maxLength={60}
              className="auth-input h-11 flex-1 rounded-xl border border-line-strong bg-white px-4 text-[13.5px] font-semibold"
              placeholder="Nama penanggung jawab"
            />
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cream text-[17px]" aria-hidden>👤</span>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="set-sandi" className="text-[11px] font-bold tracking-widest text-pine/60 uppercase">Kata sandi</label>
            <button onClick={() => setShow((v) => !v)} className="text-[11px] font-bold text-pine/50 hover:text-brand-deep">
              {show ? "Sembunyi" : "Lihat"}
            </button>
          </div>
          <div className="flex gap-2">
            <input
              id="set-sandi"
              type={show ? "text" : "password"}
              value={sandi}
              onChange={(e) => setSandi(e.target.value)}
              maxLength={128}
              placeholder="Kosongkan jika tidak diganti"
              autoComplete="new-password"
              className="auth-input h-11 flex-1 rounded-xl border border-line-strong bg-white px-4 text-[13.5px] font-semibold"
            />
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cream text-[17px]" aria-hidden>🔑</span>
          </div>
          {/* strength */}
          <div className="mt-2 flex gap-1.5" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${sandi.length > i * 3 && sandi.length > 0 ? (sandi.length >= 8 ? "bg-emerald-600" : "bg-brand") : "bg-cream-dark"}`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-line bg-cream/60 px-4 py-3.5">
          <div>
            <p className="text-[13px] font-extrabold">Mode tampilan</p>
            <p className="text-[11.5px] font-medium text-pine/55">{dark ? "Kedai gelap — nyaman malam hari" : "Terang kedelai — nyaman area produksi"}</p>
          </div>
          <button
            role="switch"
            aria-checked={dark}
            aria-label="Mode gelap"
            onClick={() => setDark(!dark)}
            className={`relative h-8 w-[58px] shrink-0 rounded-full p-1 transition-colors duration-300 ${dark ? "bg-pine" : "bg-cream-dark border border-line-strong"}`}
          >
            <span
              className={`grid h-6 w-6 place-items-center rounded-full bg-white text-[13px] shadow transition-transform duration-300 ${dark ? "translate-x-[26px]" : "translate-x-0"}`}
            >
              {dark ? "🌙" : "☀️"}
            </span>
          </button>
        </div>

        <button
          onClick={apply}
          disabled={saving}
          className="btn-press h-11 w-full rounded-xl bg-brand text-[13.5px] font-bold text-white shadow-[0_10px_24px_rgba(217,119,6,0.3)] hover:bg-brand-deep disabled:opacity-70"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Menyimpan…
            </span>
          ) : (
            "Apply ✓"
          )}
        </button>

        <p className="text-center text-[11px] font-medium text-pine/45">Perubahan nama & mode tersimpan lokal di perangkat ini.</p>
      </div>
    </section>
  );
}
