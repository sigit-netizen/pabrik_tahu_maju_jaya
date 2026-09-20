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
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

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
            "Server error (500). Pastikan SUPABASE_URL, SUPABASE_ANON_KEY, dan API_SECRET_KEY sudah diisi, lalu restart dev server."
          );
        } else if (res.status === 403) {
          setError(json.message || "Akun Anda belum disetujui administrator. Hubungi admin pabrik.");
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
      setPassword("");
      if (json?.data) {
        try {
          sessionStorage.setItem("ptmj_user", JSON.stringify(json.data));
        } catch {}
      }
      setTimeout(() => router.push("/"), 1200);
    } catch {
      setError("Tidak dapat terhubung ke server. Periksa koneksi internet Anda.");
    } finally {
      setLoading(false);
    }
  }

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
            className="auth-input h-[46px] w-full rounded-xl border border-line-strong bg-white px-4 text-[14px] font-medium text-pine shadow-sm placeholder:font-normal"
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="password" className="text-[11px] font-bold tracking-widest text-pine/70 uppercase">
              Password
            </label>
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="text-[11px] font-bold tracking-wide text-pine/50 transition hover:text-brand-deep"
            >
              {showPassword ? "Sembunyi" : "Lihat"}
            </button>
          </div>
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            maxLength={128}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input h-[46px] w-full rounded-xl border border-line-strong bg-white px-4 text-[14px] font-medium text-pine shadow-sm"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="flex h-[46px] w-full items-center justify-center rounded-xl bg-pine text-[13.5px] font-bold tracking-wide text-cream shadow-[0_8px_20px_rgba(20,52,43,0.18)] transition hover:bg-pine-deep active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-cream/30 border-t-cream" />
            Memeriksa akun…
          </span>
        ) : (
          "Masuk ke pencatatan"
        )}
      </button>

      <p className="text-center text-[13px] leading-5 text-pine/60">
        Belum punya akun?{" "}
        <Link href="/register" className="font-bold text-brand hover:text-brand-deep hover:underline">
          Daftar di sini
        </Link>
      </p>
    </form>
  );
}
