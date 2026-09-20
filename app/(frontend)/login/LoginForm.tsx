'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ApiResult = {
  status: string;
  message: string;
  data?: Record<string, unknown>;
};

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim() || !password) {
      setError("Email dan password wajib diisi.");
      return;
    }

    setLoading(true);
    try {
      // Panggil proxy server-side /api/auth/login — secret API_SECRET_KEY
      // disuntikkan di server (app/api/auth/login/route.ts), TIDAK di browser.
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim(), password }),
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
        } else if (res.status === 403) {
          setError(
            json.message ||
              "Akun Anda belum disetujui administrator. Silakan hubungi admin pabrik."
          );
        } else if (res.status === 401) {
          setError("Akses ditolak: API Key tidak valid. Hubungi administrator.");
        } else if (res.status === 429) {
          setError("Terlalu banyak percobaan. Tunggu 1 menit lalu coba lagi.");
        } else {
          setError(json.message || "Email atau password salah.");
        }
        return;
      }

      setSuccess(json?.message || "Login berhasil! Selamat datang.");
      // Hapus password dari memori segera setelah berhasil.
      setPassword("");
      if (json?.data) {
        try {
          // sessionStorage (bukan localStorage): data sesi otomatis hilang
          // saat tab ditutup — penting karena PC pabrik bisa dipakai bergantian.
          sessionStorage.setItem("ptmj_user", JSON.stringify(json.data));
        } catch {
          // abaikan jika sessionStorage tidak tersedia
        }
      }
      setTimeout(() => router.push("/"), 1200);
    } catch {
      setError("Tidak dapat terhubung ke server. Periksa koneksi internet Anda.");
    } finally {
      setLoading(false);
    }
  }

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
          className="auth-input h-12 w-full rounded-2xl border border-pine/20 bg-cream/60 px-4 text-[15px] transition placeholder:text-pine/35"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-bold">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            maxLength={128}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input h-12 w-full rounded-2xl border border-pine/20 bg-cream/60 px-4 pr-16 text-[15px] transition placeholder:text-pine/35"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full px-3 py-1.5 text-xs font-bold text-pine/60 transition hover:bg-pine/5 hover:text-pine"
          >
            {showPassword ? "Sembunyi" : "Lihat"}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="flex h-12 w-full items-center justify-center rounded-2xl bg-pine text-sm font-bold text-cream shadow-md transition hover:bg-pine-deep disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-cream/40 border-t-cream" />
            Memeriksa akun…
          </span>
        ) : (
          "Masuk ke pencatatan"
        )}
      </button>

      <p className="pt-1 text-center text-sm text-pine/65">
        Belum punya akun?{" "}
        <Link href="/register" className="font-bold text-brand-deep hover:underline">
          Daftar di sini
        </Link>
      </p>
    </form>
  );
}
