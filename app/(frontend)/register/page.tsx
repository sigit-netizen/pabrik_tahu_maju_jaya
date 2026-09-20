"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { AuthShell, FieldError } from "../components/auth";

const ROLES = [
  { value: "kasir", label: "Kasir — catat & kelola pesanan" },
  { value: "owner", label: "Owner — pantau omzet & semua data" },
] as const;

type Errors = {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  password?: string;
  confirm?: string;
  agree?: string;
};

function passwordStrength(pw: string): { label: string; width: string; tone: string } {
  if (!pw) return { label: "Belum diisi", width: "0%", tone: "bg-stone-200" };
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  if (score <= 2) return { label: "Lemah — tambah panjang & variasi", width: "33%", tone: "bg-red-500" };
  if (score <= 3) return { label: "Cukup — masih bisa dikuatkan", width: "62%", tone: "bg-amber-500" };
  return { label: "Kuat — bagus, lanjutkan", width: "100%", tone: "bg-emerald-600" };
}

export default function RegisterPage() {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const strength = passwordStrength(pw);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();
    const role = String(data.get("role") ?? "");
    const password = String(data.get("password") ?? "");
    const confirm = String(data.get("confirm") ?? "");
    const agree = data.get("agree") === "on";

    const next: Errors = {};
    if (name.length < 3) next.name = "Nama lengkap minimal 3 huruf.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Isi email yang valid, mis. budi@majujaya.id.";
    if (!/^[0-9+\-()\s]{9,16}$/.test(phone)) next.phone = "Nomor WA/HP 9–16 digit angka.";
    if (!role) next.role = "Pilih peran agar hak aksesnya tepat.";
    if (password.length < 8) next.password = "Kata sandi minimal 8 karakter.";
    if (confirm !== password) next.confirm = "Konfirmasi belum sama dengan kata sandi.";
    if (!agree) next.agree = "Centang persetujuan dulu agar akun bisa dibuat.";

    setErrors(next);
    if (Object.keys(next).length > 0) {
      const first = document.querySelector('[aria-invalid="true"]') as HTMLElement | null;
      first?.focus();
      return;
    }

    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    try {
      localStorage.setItem(
        "maju-jaya-session",
        JSON.stringify({ name, email, phone, role, at: new Date().toISOString() }),
      );
      router.push("/dashboard");
    } catch {
      setFormError("Browser menolak penyimpanan sesi. Coba matikan mode privat.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Akun baru"
      title="Daftarkan pengguna baru"
      subtitle="Satu akun per orang — kasir mencatat pesanan harian, owner memantau omzet dan semua data."
      footer={
        <>
          Sudah punya akun?{" "}
          <Link
            href="/login"
            className="font-semibold text-pine-800 underline decoration-soy-500 decoration-2 underline-offset-4 hover:text-pine-700 focus-visible:outline-2 focus-visible:outline-soy-500 focus-visible:outline-offset-2"
          >
            Masuk di sini
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {formError && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            {formError}
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="name" className="mb-1.5 block text-sm font-semibold text-ink">
              Nama lengkap
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="mis. Budi Santoso"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "name-error" : undefined}
              className="field-input"
            />
            <FieldError id="name-error" message={errors.name} />
          </div>

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-ink">
              Email kerja
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="nama@majujaya.id"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
              className="field-input"
            />
            <FieldError id="email-error" message={errors.email} />
          </div>

          <div>
            <label htmlFor="phone" className="mb-1.5 block text-sm font-semibold text-ink">
              No. WA / HP
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="mis. 0812xxxxxxx"
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? "phone-error" : undefined}
              className="field-input"
            />
            <FieldError id="phone-error" message={errors.phone} />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="role" className="mb-1.5 block text-sm font-semibold text-ink">
              Peran pengguna
            </label>
            <select
              id="role"
              name="role"
              defaultValue=""
              aria-invalid={Boolean(errors.role)}
              aria-describedby={errors.role ? "role-error" : undefined}
              className="field-input cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2016%2016%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M4%206l4%204%204-4%22%20stroke%3D%22%2378716C%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_0.8rem_center] bg-no-repeat pr-10"
            >
              <option value="" disabled>
                Pilih peran…
              </option>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <FieldError id="role-error" message={errors.role} />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-ink">
              Kata sandi
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Min. 8 karakter"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "password-error" : "pw-strength"}
                className="field-input pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-pressed={showPw}
                aria-label={showPw ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                className="absolute inset-y-0 right-1 grid w-11 place-items-center rounded-lg text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-soy-500"
              >
                <svg width="19" height="19" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M2.5 10S5.5 4.5 10 4.5 17.5 10 17.5 10 14.5 15.5 10 15.5 2.5 10 2.5 10Z" stroke="currentColor" strokeWidth="1.7" />
                  <circle cx="10" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.7" />
                </svg>
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2.5" aria-live="polite">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200">
                <div className={`h-full rounded-full transition-all ${strength.tone}`} style={{ width: strength.width }} />
              </div>
            </div>
            <p id="pw-strength" className="mt-1 text-xs font-medium text-muted">
              Kekuatan: {strength.label}
            </p>
            <FieldError id="password-error" message={errors.password} />
          </div>

          <div>
            <label htmlFor="confirm" className="mb-1.5 block text-sm font-semibold text-ink">
              Ulangi kata sandi
            </label>
            <div className="relative">
              <input
                id="confirm"
                name="confirm"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Sama seperti di samping"
                aria-invalid={Boolean(errors.confirm)}
                aria-describedby={errors.confirm ? "confirm-error" : undefined}
                className="field-input pr-12"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                aria-pressed={showConfirm}
                aria-label={showConfirm ? "Sembunyikan konfirmasi" : "Tampilkan konfirmasi"}
                className="absolute inset-y-0 right-1 grid w-11 place-items-center rounded-lg text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-soy-500"
              >
                <svg width="19" height="19" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M2.5 10S5.5 4.5 10 4.5 17.5 10 17.5 10 14.5 15.5 10 15.5 2.5 10 2.5 10Z" stroke="currentColor" strokeWidth="1.7" />
                  <circle cx="10" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.7" />
                </svg>
              </button>
            </div>
            <FieldError id="confirm-error" message={errors.confirm} />
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-paper px-4 py-3 ring-1 ring-line">
          <input
            type="checkbox"
            name="agree"
            className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-[#14342B]"
            aria-invalid={Boolean(errors.agree)}
            aria-describedby={errors.agree ? "agree-error" : undefined}
          />
          <span className="text-[13px] leading-relaxed text-stone-600">
            Saya setuju data tim disimpan untuk operasional pabrik dan akan
            menjaga kerahasiaan akun. <span className="font-semibold text-ink">Data hanya dipakai internal.</span>
          </span>
        </label>
        <FieldError id="agree-error" message={errors.agree} />

        <button
          type="submit"
          disabled={loading}
          className="btn-primary flex w-full items-center justify-center gap-2 bg-soy-500 text-white shadow-[0_8px_20px_rgba(217,119,6,0.32)] hover:bg-soy-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? (
            <>
              <span aria-hidden="true" className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Membuat akun…
            </>
          ) : (
            "Buat akun tim"
          )}
        </button>

        <p className="text-center text-xs leading-relaxed text-muted">
          Akun kasir langsung bisa mencatat pesanan setelah masuk. Jaga
          kerahasiaan kata sandi masing-masing.
        </p>
      </form>
    </AuthShell>
  );
}
