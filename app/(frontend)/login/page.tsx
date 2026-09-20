"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { AuthShell, FieldError } from "../components/auth";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  function validate(email: string, password: string) {
    const next: typeof errors = {};
    if (!email.trim()) next.email = "Email atau nama pengguna wajib diisi.";
    else if (email.includes("@") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = "Format email sepertinya belum tepat.";
    if (!password) next.password = "Kata sandi wajib diisi.";
    else if (password.length < 6) next.password = "Kata sandi minimal 6 karakter.";
    return next;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");

    const next = validate(email, password);
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    // Simulasi autentikasi — ganti dengan fetch ke API saat backend siap.
    await new Promise((r) => setTimeout(r, 900));
    try {
      const payload = { email: email.trim(), remember, at: new Date().toISOString() };
      const store = remember ? localStorage : sessionStorage;
      store.setItem("maju-jaya-session", JSON.stringify(payload));
      router.push("/dashboard");
    } catch {
      setFormError("Browser menolak penyimpanan sesi. Coba matikan mode privat.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Selamat datang kembali"
      title="Masuk ke buku penjualan"
      subtitle="Catat pesanan tahu dalam hitungan detik — nama pemesan, jumlah, harga, dan tanggal langsung tersimpan rapi."
      footer={
        <>
          Belum punya akun?{" "}          <Link
            href="/register"
            className="font-semibold text-pine-800 underline decoration-soy-500 decoration-2 underline-offset-4 hover:text-pine-700 focus-visible:outline-2 focus-visible:outline-soy-500 focus-visible:outline-offset-2"
          >
            Daftar akun
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {formError && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-relaxed text-red-800"
          >
            {formError}
          </div>
        )}

        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-ink">
            Email atau nama pengguna
          </label>
          <input
            id="email"
            name="email"
            type="text"
            autoComplete="username"
            placeholder="mis. budi@majujaya.id"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
            className="field-input"
          />
          <FieldError id="email-error" message={errors.email} />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-semibold text-ink">
              Kata sandi
            </label>
            <Link
              href="/login"
              className="text-[13px] font-semibold text-soy-600 hover:text-soy-600/80 focus-visible:outline-2 focus-visible:outline-soy-500 focus-visible:outline-offset-2"
            >
              Lupa kata sandi?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Minimal 6 karakter"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "password-error" : undefined}
              className="field-input pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
              aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
              className="absolute inset-y-0 right-1 grid w-11 place-items-center rounded-lg text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-soy-500"
            >
              {showPassword ? (
                <svg width="19" height="19" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M3 3l14 14M9.9 4.2c4.4.4 7.1 3.4 7.6 5.8-.3 1.4-1.4 2.9-3 4M6 6C4 7.2 2.9 8.9 2.5 10c.6 2.8 4.4 6 7.5 6 1 0 2-.3 2.8-.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="19" height="19" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M2.5 10S5.5 4.5 10 4.5 17.5 10 17.5 10 14.5 15.5 10 15.5 2.5 10 2.5 10Z" stroke="currentColor" strokeWidth="1.7" />
                  <circle cx="10" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.7" />
                </svg>
              )}
            </button>
          </div>
          <FieldError id="password-error" message={errors.password} />
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-[18px] w-[18px] cursor-pointer accent-[#14342B]"
          />
          Ingat saya di perangkat ini
        </label>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary flex w-full items-center justify-center gap-2 bg-pine-900 text-white shadow-[0_8px_20px_rgba(20,52,43,0.28)] hover:bg-pine-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? (
            <>
              <span
                aria-hidden="true"
                className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-white/40 border-t-white"
              />
              Memeriksa akun…
            </>
          ) : (
            <>
              Masuk ke dashboard
              <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M3 9h11M9.5 4.5 14 9l-4.5 4.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </>
          )}
        </button>

      </form>
    </AuthShell>
  );
}
