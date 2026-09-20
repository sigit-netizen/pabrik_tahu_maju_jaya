'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ApiResult = {
  status: string;
  message: string;
};

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
    if (password.length < 4) {
      setError("Password harus terdiri dari minimal 4 karakter.");
      return;
    }
    if (password !== confirm) {
      setError("Konfirmasi password tidak sama.");
      return;
    }

    setLoading(true);
    try {
      // Panggil proxy server-side /api/auth/register — secret API_SECRET_KEY
      // disuntikkan di server (app/api/auth/register/route.ts), TIDAK di browser.
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password,
        }),
      });

      // Baca sebagai teks dulu agar respons kosong (mis. 500 dari server)
      // tidak membuat JSON.parse meledak dan menutupi pesan asli.
      const raw = await res.text();
      let json: ApiResult | null = null;
      try {
        json = raw ? (JSON.parse(raw) as ApiResult) : null;
      } catch {
        json = null;
      }

      if (!res.ok) {
        if (res.status === 500 || !json) {
          setError(
            "Server error (500). Kemungkinan file .env.local belum lengkap — pastikan SUPABASE_URL, SUPABASE_ANON_KEY, dan API_SECRET_KEY sudah diisi, lalu restart dev server."
          );
        } else if (res.status === 429) {
          setError(
            "Terlalu banyak percobaan daftar (maks 3x/menit). Tunggu sebentar lalu coba lagi."
          );
        } else if (res.status === 401) {
          setError("Akses ditolak: API Key tidak valid. Hubungi administrator.");
        } else {
          setError(json.message || "Gagal mendaftar. Coba lagi.");
        }
        return;
      }

      setSuccess(
        "Registrasi berhasil! Akun Anda menunggu persetujuan admin sebelum bisa masuk."
      );
      // Hapus password dari memori segera setelah berhasil.
      setPassword("");
      setConfirm("");
      setTimeout(() => router.push("/login"), 1600);
    } catch {
      setError("Tidak dapat terhubung ke server. Periksa koneksi internet Anda.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "auth-input h-12 w-full rounded-2xl border border-pine/20 bg-cream/60 px-4 text-[15px] transition placeholder:text-pine/35";

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-5 text-red-800"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium leading-5 text-emerald-900"
        >
          {success}
        </div>
      )}

      <div>
        <label htmlFor="username" className="mb-1.5 block text-sm font-bold">
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
        <label htmlFor="email" className="mb-1.5 block text-sm font-bold">
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
          <label htmlFor="password" className="mb-1.5 block text-sm font-bold">
            Password
          </label>
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            maxLength={128}
            placeholder="Min. 4 karakter"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="confirm" className="mb-1.5 block text-sm font-bold">
            Ulangi password
          </label>
          <input
            id="confirm"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            maxLength={128}
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
        className="rounded-full px-3 py-1.5 text-xs font-bold text-pine/60 transition hover:bg-pine/5 hover:text-pine"
      >
        {showPassword ? "Sembunyikan password" : "Tampilkan password"}
      </button>

      <button
        type="submit"
        disabled={loading}
        className="flex h-12 w-full items-center justify-center rounded-2xl bg-brand text-sm font-bold text-white shadow-md transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-60"
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

      <p className="pt-1 text-center text-sm text-pine/65">
        Sudah punya akun?{" "}
        <Link href="/login" className="font-bold text-brand-deep hover:underline">
          Masuk di sini
        </Link>
      </p>
    </form>
  );
}
