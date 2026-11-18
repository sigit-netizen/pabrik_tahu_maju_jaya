'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ApiResult = {
  status: string;
  message: string;
};

/*
 * Aturan panjang & daftar password lemah.
 *
 * PENTING — ini BUKAN batas keamanan. Siapa pun bisa memanggil
 * /api/auth/register langsung dengan curl dan melewati seluruh pemeriksaan di
 * file ini. Backend saat ini hanya mewajibkan 4 karakter
 * (app/(backend)/api/register/route.ts:87), dan itu terlalu lemah untuk akun
 * yang bisa mencatat data produksi. Karena backend di luar lingkup tugas ini,
 * aturan yang lebih ketat dipasang di sini supaya alur normalnya minimal aman;
 * perbaikan yang sesungguhnya ada di PANDUAN_PERBAIKAN_BACKEND.md.
 */
const PANJANG_MIN = 8;
const PANJANG_MAKS = 128;

/** Password yang paling sering dipakai, plus yang menempel di keyboard. */
const PASSWORD_LEMAH = new Set([
  "123456",
  "1234567",
  "12345678",
  "123456789",
  "1234567890",
  "12345",
  "password",
  "password1",
  "password123",
  "passw0rd",
  "qwerty",
  "qwerty123",
  "qwertyuiop",
  "asdfghjkl",
  "zxcvbnm",
  "iloveyou",
  "admin",
  "admin123",
  "administrator",
  "root",
  "toor",
  "letmein",
  "welcome",
  "welcome1",
  "monkey",
  "dragon",
  "sunshine",
  "princess",
  "football",
  "baseball",
  "abc123",
  "abcd1234",
  "a1b2c3d4",
  "111111",
  "000000",
  "654321",
  "tahu",
  "pabrik",
  "pabriktahu",
  "majujaya",
  "tahumajujaya",
  "bismillah",
  "indonesia",
  "jakarta",
  "bandung",
  "surabaya",
  "sayang",
  "cintaku",
  "rahasia",
  "secret",
  "test123",
  "user123",
]);

/** Mengembalikan pesan masalah, atau null kalau password sudah layak. */
function periksaPassword(pw: string): string | null {
  if (pw.length < PANJANG_MIN) return `Password minimal ${PANJANG_MIN} karakter.`;
  if (pw.length > PANJANG_MAKS) return `Password maksimal ${PANJANG_MAKS} karakter.`;
  if (PASSWORD_LEMAH.has(pw.toLowerCase())) {
    return "Password itu terlalu mudah ditebak. Silakan pilih yang lain.";
  }
  // "aaaaaaaa" panjang tapi cuma satu karakter berbeda; "12341234" cuma empat.
  if (new Set(pw).size < 4) {
    return "Password terlalu berulang. Pakai variasi karakter yang lebih banyak.";
  }
  return null;
}

export default function RegisterForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!username.trim() || !email.trim() || !password) {
      setError("Username, email, dan password wajib diisi.");
      return;
    }
    if (!/^[a-zA-Z0-9._-]{3,50}$/.test(username.trim())) {
      setError("Username 3-50 karakter, hanya huruf, angka, titik, underscore, dash.");
      return;
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!emailOk) {
      setError("Format email tidak valid.");
      return;
    }
    const masalahPassword = periksaPassword(password);
    if (masalahPassword) {
      setError(masalahPassword);
      return;
    }
    if (password !== confirm) {
      setError("Konfirmasi password tidak sama.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password,
        }),
      });

      const raw = await res.text();
      let json: ApiResult | null = null;
      try {
        json = raw ? (JSON.parse(raw) as ApiResult) : null;
      } catch {
        json = null;
      }

      if (!res.ok) {
        /* Pesan generik — lihat catatan di LoginForm.tsx: menyebut nama
           variabel lingkungan ke pengguna anonim adalah kebocoran informasi. */
        if (res.status === 500 || !json) {
          setError("Server sedang bermasalah. Coba lagi beberapa saat lagi atau hubungi administrator.");
        } else if (res.status === 429) {
          setError("Terlalu banyak percobaan daftar. Tunggu sebentar lalu coba lagi.");
        } else if (res.status === 401) {
          setError("Akses ditolak. Hubungi administrator.");
        } else {
          setError(json.message || "Gagal mendaftar. Coba lagi.");
        }
        return;
      }

      setSuccess("Registrasi berhasil! Akun Anda menunggu persetujuan admin sebelum bisa masuk.");
      setPassword("");
      setConfirm("");
      setTimeout(() => router.push("/"), 1600);
    } catch {
      setError("Tidak dapat terhubung ke server. Periksa koneksi internet Anda.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "auth-input h-[46px] w-full rounded-xl border border-line-strong bg-white px-4 text-[14px] font-medium text-pine shadow-sm placeholder:font-normal";

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-[13px] font-medium leading-5 text-red-800"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-[13px] font-medium leading-5 text-emerald-900"
        >
          {success}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="username" className="mb-2 block text-[11px] font-bold tracking-widest text-pine/70 uppercase">
            Username
          </label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={50}
            placeholder="cth: budi_pabrik"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="email" className="mb-2 block text-[11px] font-bold tracking-widest text-pine/70 uppercase">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={254}
            placeholder="nama@pabriktahu.id"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="password" className="mb-2 block text-[11px] font-bold tracking-widest text-pine/70 uppercase">
              Password
            </label>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              maxLength={PANJANG_MAKS}
              placeholder={`Min. ${PANJANG_MIN} karakter`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="confirm" className="mb-2 block text-[11px] font-bold tracking-widest text-pine/70 uppercase">
              Ulangi password
            </label>
            <input
              id="confirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              maxLength={PANJANG_MAKS}
              placeholder="Sama seperti di samping"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="text-[11px] font-bold tracking-wide text-pine/50 transition hover:text-brand-deep"
        >
          {showPassword ? "Sembunyikan password" : "Tampilkan password"}
        </button>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="flex h-[46px] w-full items-center justify-center rounded-xl bg-brand text-[13.5px] font-bold tracking-wide text-white shadow-[0_8px_20px_rgba(217,119,6,0.22)] transition hover:bg-brand-deep active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Mendaftarkan…
          </span>
        ) : (
          "Daftar akun pencatat"
        )}
      </button>

      <p className="text-center text-[13px] leading-5 text-pine/60">
        Sudah punya akun?{" "}
        <Link href="/" className="font-bold text-brand hover:text-brand-deep hover:underline">
          Masuk di sini
        </Link>
      </p>
    </form>
  );
}
