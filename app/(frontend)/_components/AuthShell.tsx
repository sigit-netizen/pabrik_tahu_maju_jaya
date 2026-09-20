import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  children: ReactNode;
  badge: string;
  title: string;
  subtitle: string;
};

export default function AuthShell({ children, badge, title, subtitle }: AuthShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-cream text-pine">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pine text-cream">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="3" y="7" width="13" height="13" rx="2.5" fill="currentColor" opacity="0.95" />
              <rect x="12" y="3" width="9" height="9" rx="2" fill="#D97706" />
            </svg>
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-bold tracking-tight">
              Tahu Maju Jaya
            </span>
            <span className="block text-xs font-medium text-pine/60">
              Pencatatan Pabrik Tahu
            </span>
          </span>
        </Link>
        <Link
          href="/"
          className="rounded-full border border-pine/15 bg-white/70 px-4 py-2 text-[13px] font-bold transition hover:border-brand hover:text-brand-deep"
        >
          ← Beranda
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-5 pb-14 pt-4">
        <div className="grid w-full overflow-hidden rounded-3xl border border-pine/10 bg-white shadow-xl lg:grid-cols-[0.95fr_1.05fr]">
          {/* Panel brand */}
          <div className="dot-grid relative hidden flex-col justify-between bg-pine p-9 text-cream lg:flex">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-cream/10 px-4 py-1.5 text-[11px] font-bold tracking-widest uppercase">
                <span className="h-2 w-2 rounded-full bg-brand" />
                {badge}
              </p>
              <h2 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight">
                Pagi mencatat,
                <br />
                sore panen berkah.
              </h2>
              <p className="mt-3 max-w-sm text-sm leading-6 text-cream/70">
                Setiap papan tahu tercatat — dari rendaman kedelai, penggilingan,
                pencetakan, hingga terjual ke pelanggan.
              </p>
            </div>
            <ul className="mt-8 space-y-3 text-sm">
              {[
                "Kontras lembut, nyaman dibaca di area produksi",
                "Akun diverifikasi admin demi keamanan data",
                "Terhubung langsung ke API pencatatan pabrik",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-cream/85">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-extrabold text-white">
                    ✓
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-8 border-t border-cream/15 pt-5 text-[13px] text-cream/60">
              Shift pagi 04.00 · Shift sore 14.00 · Libur Jumat siang
            </p>
          </div>

          {/* Panel form */}
          <div className="p-6 sm:p-10">
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-[1.7rem]">
              {title}
            </h1>
            <p className="mt-1.5 text-sm leading-6 text-pine/65">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
