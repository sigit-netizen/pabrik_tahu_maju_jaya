import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  children: ReactNode;
  badge?: string;
  title: string;
  subtitle: string;
};

export default function AuthShell({ children, title, subtitle }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-cream text-pine dot-grid-dark">
      {/* Header minimal — clean */}
      <header className="sticky top-0 z-20 border-b border-line bg-cream/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[64px] w-full max-w-[1120px] items-center px-5 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pine text-cream shadow-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="3.5" y="7.5" width="12.5" height="12.5" rx="2.6" fill="currentColor" />
                <rect x="12.5" y="3.5" width="8" height="8" rx="1.9" fill="#D97706" />
              </svg>
            </span>
            <span className="leading-tight">
              <span className="block text-[14.5px] font-bold tracking-tight">Tahu Maju Jaya</span>
              <span className="block text-[11px] font-medium tracking-wide text-pine/55">
                PENCATATAN PABRIK TAHU
              </span>
            </span>
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1120px] flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-10 lg:py-12">
        <div className="grid w-full overflow-hidden rounded-[28px] border border-line bg-white shadow-[0_24px_64px_rgba(20,52,43,0.12),0_2px_8px_rgba(20,52,43,0.06)] lg:grid-cols-[1.05fr_1.15fr]">
          {/* Left — brand panel */}
          <div className="relative hidden flex-col justify-between overflow-hidden bg-pine p-10 text-cream lg:flex">
            <div className="dot-grid absolute inset-0 opacity-100" aria-hidden />
            {/* subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] via-transparent to-black/10" aria-hidden />

            <div className="relative">
              <h2 className="max-w-[14ch] text-[32px] font-[800] leading-[1.05] tracking-tight">
                Pagi mencatat,
                <br />
                <span className="text-cream/90">sore panen</span>
                <br />
                <span className="text-brand-soft">berkah.</span>
              </h2>
              <p className="mt-4 max-w-[32ch] text-[13.5px] leading-6 text-cream/65">
                Setiap papan tahu tercatat — dari rendaman kedelai, penggilingan, pencetakan,
                hingga terjual ke pelanggan. Sistem dibuat untuk nyaman dilihat di area produksi.
              </p>
            </div>

            <div className="relative mt-10">
              <ul className="space-y-3">
                {[
                  ["Kontras lembut", "Nyaman dibaca pagi hingga sore di area produksi"],
                  ["Terverifikasi admin", "Setiap akun disetujui sebelum bisa mencatat"],
                  ["Terhubung API", "Data langsung tersimpan ke sistem pabrik"],
                ].map(([k, v]) => (
                  <li
                    key={k}
                    className="flex gap-3 rounded-2xl border border-cream/10 bg-cream/[0.06] px-4 py-3.5 backdrop-blur"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">
                      ✓
                    </span>
                    <span className="leading-tight">
                      <span className="block text-[13px] font-bold text-cream">{k}</span>
                      <span className="block text-[12px] leading-4 text-cream/60">{v}</span>
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex items-center gap-3 border-t border-cream/10 pt-6">
                <div className="flex -space-x-2">
                  <span className="h-8 w-8 rounded-full border-2 border-pine bg-cream" />
                  <span className="h-8 w-8 rounded-full border-2 border-pine bg-brand" />
                  <span className="h-8 w-8 rounded-full border-2 border-pine bg-cream-dark" />
                </div>
                <p className="text-[12px] leading-4 text-cream/60">
                  Dipercaya tim produksi
                  <br />
                  <span className="font-semibold text-cream">shift pagi &amp; sore</span>
                </p>
              </div>
            </div>
          </div>

          {/* Right — form */}
          <div className="flex flex-col bg-white p-6 sm:p-9 lg:p-10">
            <div className="mb-7">
              <h1 className="text-[22px] font-extrabold tracking-tight text-pine sm:text-[24px]">
                {title}
              </h1>
              <p className="mt-2 text-[13.5px] leading-5 text-pine/60">{subtitle}</p>
            </div>

            <div className="flex-1">{children}</div>

            <p className="mt-8 border-t border-line pt-4 text-center text-[11px] font-medium tracking-wide text-pine/45">
              © {new Date().getFullYear()} Pabrik Tahu Maju Jaya — dicatat rapi, dijual berkah
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
