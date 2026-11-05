"use client";

import { useEffect, useState } from "react";

import {
  IconAlert,
  IconCheck,
  IconDisplay,
  IconLock,
  IconMoon,
  IconSun,
  IconTag,
  IconUser,
} from "./icons";
import { skin } from "./theme";

type HargaCetak = {
  id: number;
  harga: number;
  harga_rupiah?: string;
  created_at?: string;
  berlaku_sejak?: string;
  waktu_wib?: string;
};

const PANJANG_MIN = 6;

function formatRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

/** Baca profil tersimpan tanpa efek — dipakai sebagai initializer state,
 *  supaya tidak ada setState sinkron di dalam useEffect. */
function bacaNama(): string {
  try {
    const j = JSON.parse(localStorage.getItem("tmj_settings") || "{}") as { nama?: string };
    return typeof j.nama === "string" ? j.nama : "";
  } catch {
    return "";
  }
}

export default function SettingsView({ onToast, dark, setDark }: { onToast: (m: string) => void; dark: boolean; setDark: (v: boolean) => void }) {
  const [nama, setNama] = useState(bacaNama);
  const [saving, setSaving] = useState(false);

  // Ubah sandi
  const [sandiLama, setSandiLama] = useState("");
  const [sandiBaru, setSandiBaru] = useState("");
  const [sandiUlang, setSandiUlang] = useState("");
  const [lihatLama, setLihatLama] = useState(false);
  const [lihatBaru, setLihatBaru] = useState(false);
  const [gantiSandi, setGantiSandi] = useState(false);
  const [errorSandi, setErrorSandi] = useState<string | null>(null);

  // Harga cetak tahu — lewat API, bukan localStorage.
  const [hargaAktif, setHargaAktif] = useState<HargaCetak | null>(null);
  const [riwayatHarga, setRiwayatHarga] = useState<HargaCetak[]>([]);
  const [inputHarga, setInputHarga] = useState("");
  const [memuatHarga, setMemuatHarga] = useState(true);
  const [simpanHarga, setSimpanHarga] = useState(false);
  const [errorHarga, setErrorHarga] = useState<string | null>(null);

  /* Muat harga cetak saat komponen hidup. IIFE async + guard pembatalan,
     sehingga tidak ada setState sinkron di body effect. */
  useEffect(() => {
    let batal = false;
    (async () => {
      try {
        const res = await fetch("/api/pengaturan/harga", { credentials: "include", cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (batal) return;
        if (!res.ok || !json || json.status !== "success") {
          setErrorHarga(json?.message ?? `Gagal memuat harga cetak (HTTP ${res.status}).`);
          return;
        }
        setHargaAktif(json.data?.harga_aktif ?? null);
        setRiwayatHarga(Array.isArray(json.data?.riwayat_harga) ? json.data.riwayat_harga : []);
      } catch {
        if (!batal) setErrorHarga("Tidak dapat terhubung ke server saat memuat harga.");
      } finally {
        if (!batal) setMemuatHarga(false);
      }
    })();
    return () => {
      batal = true;
    };
  }, []);

  const s = skin(dark);
  const tingkat =
    sandiBaru.length === 0 ? 0 : sandiBaru.length < PANJANG_MIN ? 1 : sandiBaru.length < 10 ? 2 : 3;

  const nominal = Number(inputHarga);
  const nominalValid = Number.isFinite(nominal) && nominal > 0;

  function apply() {
    if (!nama.trim()) {
      onToast("Nama tidak boleh kosong.");
      return;
    }
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      try {
        const raw = localStorage.getItem("tmj_settings");
        const j = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        localStorage.setItem("tmj_settings", JSON.stringify({ ...j, nama: nama.trim(), dark }));
      } catch (e) {
        console.warn("[pengaturan] localStorage tidak bisa ditulis:", e);
        onToast("Pengaturan tampil, tapi gagal disimpan di perangkat ini.");
      }
      onToast(`Pengaturan disimpan — halo, ${nama.trim().split(" ")[0]}!`);
    }, 400);
  }

  async function simpanSandi() {
    const pesan = validasiSandi();
    if (pesan) {
      setErrorSandi(pesan);
      onToast(pesan);
      return;
    }
    setGantiSandi(true);
    setErrorSandi(null);
    try {
      const res = await fetch("/api/pengaturan/password", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password_lama: sandiLama, password_baru: sandiBaru }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json || json.status !== "success") {
        const p = json?.message || `Gagal mengganti sandi (HTTP ${res.status}).`;
        setErrorSandi(p);
        onToast(p);
        return;
      }
      setSandiLama("");
      setSandiBaru("");
      setSandiUlang("");
      onToast(json.message || "Kata sandi berhasil diganti.");
    } catch {
      setErrorSandi("Tidak dapat terhubung ke server.");
      onToast("Tidak dapat terhubung ke server.");
    } finally {
      setGantiSandi(false);
    }
  }

  function validasiSandi(): string | null {
    if (!sandiLama) return "Isi kata sandi saat ini dulu.";
    if (!sandiBaru) return "Isi kata sandi baru.";
    if (sandiBaru.length < PANJANG_MIN) return `Kata sandi baru minimal ${PANJANG_MIN} karakter.`;
    if (sandiBaru !== sandiUlang) return "Konfirmasi kata sandi tidak sama.";
    if (sandiBaru === sandiLama) return "Kata sandi baru harus berbeda dari yang lama.";
    return null;
  }

  async function simpanHargaCetak() {
    if (!nominalValid) {
      const pesan = "Nominal harga harus angka lebih dari 0.";
      setErrorHarga(pesan);
      onToast(pesan);
      return;
    }
    setSimpanHarga(true);
    setErrorHarga(null);
    try {
      const res = await fetch("/api/pengaturan/harga", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ harga: nominal }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json || json.status !== "success") {
        const pesan = json?.message ?? `Gagal menyimpan harga cetak (HTTP ${res.status}).`;
        setErrorHarga(pesan);
        onToast(pesan);
        return;
      }
      const baru: HargaCetak = json.data;
      setHargaAktif(baru);
      setRiwayatHarga((lama) => [baru, ...lama.filter((h) => h.id !== baru.id)]);
      setInputHarga("");
      onToast(json.message ?? "Harga cetak berhasil disimpan.");
    } catch {
      setErrorHarga("Tidak dapat terhubung ke server.");
      onToast("Tidak dapat terhubung ke server.");
    } finally {
      setSimpanHarga(false);
    }
  }

  const LABEL_SANDI = ["Belum diisi", "Lemah", "Cukup", "Kuat"];

  return (
    <div className="anim-rise mx-auto w-full max-w-[600px] space-y-6">
      {/* ============ Profil & tampilan ============ */}
      <section className="overflow-hidden rounded-3xl border">
        <div className="flex items-center gap-3 border-b px-5 py-4 sm:px-6">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${s.lencana}`}>
            <IconUser className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-extrabold tracking-tight">Profil pencatat</h2>
            <p className="mt-0.5 text-[12px] font-medium">Siapa yang mencatat dan tampilan yang dipakai</p>
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div>
            <label htmlFor="set-nama" className="mb-1.5 block text-[11px] font-bold tracking-[0.12em] uppercase">
              Nama penanggung jawab
            </label>
            <div className="relative">
              <IconUser className={`pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 ${s.ikon}`} />
              <input
                id="set-nama"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                maxLength={60}
                className={`auth-input h-11 w-full rounded-xl border pl-10 text-[13.5px] font-semibold px-4`}
                placeholder="Nama penanggung jawab"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border px-4 py-4">
            <div className="flex items-center gap-3">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${s.chip} ${s.ikon}`}>
                <IconDisplay className="h-[18px] w-[18px]" />
              </span>
              <div>
                <p className="text-[13px] font-extrabold tracking-tight">Mode tampilan</p>
                <p className="text-[11.5px] font-medium">
                  {dark ? "Kedai gelap — nyaman malam hari" : "Terang kedelai — nyaman area produksi"}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={dark}
              aria-label="Mode gelap"
              onClick={() => setDark(!dark)}
              className={`relative h-8 w-[58px] shrink-0 rounded-full p-1 transition-colors duration-300 ${dark ? "bg-pine-deep ring-1 ring-cream/20" : "border border-line-strong bg-cream-dark"}`}
            >
              <span
                className={`mx-auto grid h-6 w-6 place-items-center rounded-full bg-white shadow-sm transition-transform duration-300 ${dark ? "translate-x-[26px]" : "translate-x-0"}`}
              >
                {dark ? <IconMoon className="h-[13px] w-[13px] text-pine" /> : <IconSun className="h-[13px] w-[13px] text-brand-deep" />}
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
            <p className="text-[11.5px] font-medium">Nama & mode disimpan di perangkat ini.</p>
            <button
              onClick={apply}
              disabled={saving}
              className="btn-press inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-6 text-[13px] font-bold text-white shadow-[0_6px_16px_rgba(217,119,6,0.28)] transition hover:bg-brand-deep disabled:opacity-70"
            >
              {saving ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Menyimpan…
                </>
              ) : (
                <>
                  <IconCheck className="h-4 w-4" />
                  Simpan
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* ============ Keamanan / ganti sandi ============ */}
      <section className="overflow-hidden rounded-3xl border">
        <div className="flex items-center gap-3 border-b px-5 py-4 sm:px-6">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${s.lencana}`}>
            <IconLock className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-extrabold tracking-tight">Ganti kata sandi</h2>
            <p className="mt-0.5 text-[12px] font-medium">Masuk dengan akun admin, sandi lama tetap wajib</p>
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          {errorSandi && (
            <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-300/60 bg-red-50/70 px-4 py-3">
              <IconAlert className="mt-px h-4 w-4 shrink-0 text-red-600" />
              <p className="text-[12.5px] leading-5 font-medium text-red-800">{errorSandi}</p>
            </div>
          )}

          <div>
            <label htmlFor="set-sandi-lama" className="mb-1.5 block text-[11px] font-bold tracking-[0.12em] uppercase">
              Kata sandi saat ini
            </label>
            <div className="relative">
              <IconLock className={`pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 ${s.ikon}`} />
              <input
                id="set-sandi-lama"
                type={lihatLama ? "text" : "password"}
                value={sandiLama}
                onChange={(e) => setSandiLama(e.target.value)}
                maxLength={128}
                autoComplete="current-password"
                placeholder="Sandi yang dipakai sekarang"
                className={`auth-input h-11 w-full rounded-xl border pr-20 text-[13.5px] font-semibold`}
              />
              <button
                type="button"
                onClick={() => setLihatLama((v) => !v)}
                className={`absolute top-1/2 right-2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold transition ${s.hantu}`}
              >
                {lihatLama ? "Sembunyi" : "Lihat"}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="set-sandi-baru" className="mb-1.5 block text-[11px] font-bold tracking-[0.12em] uppercase">
              Kata sandi baru
            </label>
            <div className="relative">
              <IconLock className={`pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 ${s.ikon}`} />
              <input
                id="set-sandi-baru"
                type={lihatBaru ? "text" : "password"}
                value={sandiBaru}
                onChange={(e) => setSandiBaru(e.target.value)}
                maxLength={128}
                autoComplete="new-password"
                placeholder={`Minimal ${PANJANG_MIN} karakter`}
                className={`auth-input h-11 w-full rounded-xl border pr-20 text-[13.5px] font-semibold`}
              />
              <button
                type="button"
                onClick={() => setLihatBaru((v) => !v)}
                className={`absolute top-1/2 right-2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold transition ${s.hantu}`}
              >
                {lihatBaru ? "Sembunyi" : "Lihat"}
              </button>
            </div>
            <div className="mt-2.5 flex items-center gap-3" role="status" aria-live="polite">
              <div className="flex flex-1 gap-1.5" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i < tingkat ? s.barIsi[tingkat as 1 | 2 | 3] : s.barKosong}`}
                  />
                ))}
              </div>
              <span className={`w-[74px] shrink-0 text-right text-[11px] font-bold ${s.labelKuat[tingkat]}`}>
                {LABEL_SANDI[tingkat]}
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="set-sandi-ulang" className="mb-1.5 block text-[11px] font-bold tracking-[0.12em] uppercase">
              Ulangi kata sandi baru
            </label>
            <div className="relative">
              <IconCheck className={`pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 ${s.ikon}`} />
              <input
                id="set-sandi-ulang"
                type={lihatBaru ? "text" : "password"}
                value={sandiUlang}
                onChange={(e) => setSandiUlang(e.target.value)}
                maxLength={128}
                autoComplete="new-password"
                placeholder="Ketik ulang sandi baru"
                className={`auth-input h-11 w-full rounded-xl border pl-10 text-[13.5px] font-semibold`}
                aria-invalid={sandiUlang.length > 0 && sandiUlang !== sandiBaru}
              />
            </div>
            {sandiUlang.length > 0 && sandiUlang !== sandiBaru && (
              <p className="mt-1.5 text-[11.5px] font-medium text-red-700">Konfirmasi tidak sama dengan sandi baru.</p>
            )}
          </div>

          <div className="flex justify-end border-t pt-5">
            <button
              onClick={simpanSandi}
              disabled={gantiSandi}
              className={`btn-press inline-flex h-11 items-center gap-2 rounded-xl px-6 text-[13px] font-bold transition disabled:opacity-70 ${s.tombolGelap}`}
            >
              {gantiSandi ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-t-current opacity-40" />
                  Mengganti…
                </>
              ) : (
                <>
                  <IconCheck className="h-4 w-4" />
                  Ganti sandi
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* ============ Harga tahu per cetak ============ */}
      <section className="overflow-hidden rounded-3xl border">
        <div className="flex items-center gap-3 border-b px-5 py-4 sm:px-6">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${s.lencana}`}>
            <IconTag className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-extrabold tracking-tight">Harga tahu per cetak</h2>
            <p className="mt-0.5 text-[12px] font-medium">Tarif yang dipakai menghitung pendapatan produksi</p>
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          {memuatHarga ? (
            <div className="rounded-2xl border px-4 py-4" role="status" aria-label="Memuat harga saat ini">
              <p className="text-[10.5px] font-bold tracking-[0.14em] uppercase">Harga saat ini</p>
              <div className="shimmer-wrap mt-2 h-7 w-44 rounded-lg" aria-hidden />
              <div className="shimmer-wrap mt-2 h-3 w-56 rounded-lg" aria-hidden />
              <p className="mt-2 text-[12px] font-medium">Memuat…</p>
            </div>
          ) : (
            <div className="rounded-2xl border px-4 py-4">
              <p className="text-[10.5px] font-bold tracking-[0.14em] uppercase">Harga saat ini</p>
              {hargaAktif ? (
                <>
                  <p className="mt-1.5 text-[28px] leading-none font-extrabold tracking-tight">
                    {hargaAktif.harga_rupiah ?? formatRupiah(hargaAktif.harga)}
                  </p>
                  <p className="mt-1.5 text-[11.5px] font-medium">
                    Berlaku sejak {hargaAktif.waktu_wib ?? hargaAktif.berlaku_sejak ?? "-"}
                  </p>
                </>
              ) : errorHarga ? (
                <p className="mt-1.5 text-[13px] font-semibold">
                  Harga tidak dapat dimuat. Masuk terlebih dahulu, lalu buka ulang halaman ini.
                </p>
              ) : (
                <p className="mt-1.5 text-[13px] font-semibold">
                  Belum ada harga. Tetapkan harga pertama agar pencatatan bisa dihitung.
                </p>
              )}
            </div>
          )}

          {errorHarga && (
            <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-300/60 bg-red-50/70 px-4 py-3">
              <IconAlert className="mt-px h-4 w-4 shrink-0 text-red-600" />
              <p className="text-[12.5px] leading-5 font-medium text-red-800">{errorHarga}</p>
            </div>
          )}

          <div>
            <label htmlFor="set-harga" className="mb-1.5 block text-[11px] font-bold tracking-[0.12em] uppercase">
              Harga baru per cetak (Rp)
            </label>
            <div className="relative">
              <IconTag className={`pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 ${s.ikon}`} />
              <input
                id="set-harga"
                type="number"
                inputMode="numeric"
                min={1}
                step={100}
                value={inputHarga}
                onChange={(e) => setInputHarga(e.target.value)}
                placeholder="Contoh: 2500"
                className={`auth-input h-11 w-full rounded-xl border pl-10 text-[13.5px] font-semibold`}
                aria-describedby="set-harga-bantuan"
              />
            </div>
            <p id="set-harga-bantuan" className="mt-2 text-[11.5px] font-medium">
              {nominalValid ? (
                <>
                  Perkiraan: 50 cetak ={" "}
                  <span className="font-bold">{formatRupiah(nominal * 50)}</span>
                  · 100 cetak ={" "}
                  <span className="font-bold">{formatRupiah(nominal * 100)}</span>
                </>
              ) : (
                "Harga terbaru langsung dipakai pencatatan berikutnya. Harga lama tetap tersimpan sebagai riwayat."
              )}
            </p>
          </div>

          <div className="flex justify-end border-t pt-5">
            <button
              onClick={simpanHargaCetak}
              disabled={simpanHarga || memuatHarga}
              className={`btn-press inline-flex h-11 items-center gap-2 rounded-xl px-6 text-[13px] font-bold transition disabled:opacity-70 ${s.tombolGelap}`}
            >
              {simpanHarga ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-t-current opacity-40" />
                  Menyimpan…
                </>
              ) : (
                <>
                  <IconCheck className="h-4 w-4" />
                  Simpan harga
                </>
              )}
            </button>
          </div>

          {riwayatHarga.length > 0 && (
            <div>
              <div className="mb-2.5 flex items-center gap-2">
                <p className="text-[11px] font-bold tracking-[0.14em] uppercase">Riwayat harga</p>
              </div>
              <ul className="divide-y overflow-hidden rounded-2xl border">
                {riwayatHarga.slice(0, 5).map((h, idx) => (
                  <li key={h.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${idx === 0 ? s.chipAktif : s.chip}`}>
                    <span className="flex items-center gap-2.5">
                      <span className={`text-[13px] font-bold ${idx === 0 ? s.badgeHarga : s.judul}`}>
                        {h.harga_rupiah ?? formatRupiah(h.harga)}
                      </span>
                      {idx === 0 && (
                        <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold tracking-widest uppercase ${s.badgeAktif}`}>
                          Aktif
                        </span>
                      )}
                    </span>
                    <span className={`shrink-0 text-[11px] font-medium`}>{h.waktu_wib ?? h.berlaku_sejak ?? "-"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}