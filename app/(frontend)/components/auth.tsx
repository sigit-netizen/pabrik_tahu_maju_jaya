import Link from "next/link";
import type { ReactNode } from "react";

export function TahuMark() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-soy-500 focus-visible:outline-offset-4"
      aria-label="Pabrik Tahu Maju Jaya — beranda"
    >
      <span
        aria-hidden="true"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-soy-50 shadow-[0_2px_12px_rgba(0,0,0,0.35)] ring-1 ring-white/20"
      >
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
          <rect x="2.5" y="7" width="15" height="14" rx="3.5" fill="#FEF3C7" />
          <rect x="2.5" y="7" width="15" height="14" rx="3.5" stroke="#B45309" strokeWidth="1.8" />
          <rect x="8.5" y="3" width="15" height="14" rx="3.5" fill="#FBBF24" />
          <rect x="8.5" y="3" width="15" height="14" rx="3.5" stroke="#92400E" strokeWidth="1.8" />
          <circle cx="14" cy="9.5" r="1.3" fill="#92400E" opacity="0.55" />
          <circle cx="18" cy="12" r="1" fill="#92400E" opacity="0.4" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-bold tracking-tight text-white">
          Pabrik Tahu Maju Jaya
        </span>
        <span className="block text-xs font-medium tracking-wide text-emerald-100/70">
          Buku Penjualan Tahu
        </span>
      </span>
    </Link>
  );
}

const checklist = [
  {
    title: "Pesanan tercatat lengkap",
    desc: "Nama pemesan, jumlah, harga, dan tanggal — tidak ada yang tercecer.",
  },
  {
    title: "Omzet langsung kebaca",
    desc: "Total penjualan hari ini otomatis terhitung setiap ada pesanan baru.",
  },
  {
    title: "Riwayat pemesan tersimpan",
    desc: "Cari nama, langsung ketahuan siapa pesan berapa dan kapan.",
  },
];

export function BrandPanel() {
  return (
    <div className="pine-texture relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-12">
      <TahuMark />

      <div className="mt-10 max-w-md">
        <h2
          className="text-balance text-4xl font-semibold leading-[1.12] tracking-tight text-white"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Setiap pesanan tahu tercatat rapi.
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-emerald-50/75">
          Tak perlu lagi buku tulis tercecer atau nota hilang. Nama pemesan,
          jumlah, harga, dan tanggal tersimpan dalam satu buku digital — bisa
          dibuka dari HP.
        </p>

        <ul className="mt-8 space-y-4">
          {checklist.map((item) => (
            <li key={item.title} className="flex gap-3.5">
              <span
                aria-hidden="true"
                className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-400/15 ring-1 ring-amber-200/25"
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3 8.5 6.5 12 13 4.5"
                    stroke="#FCD34D"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span>
                <span className="block text-sm font-semibold text-white">
                  {item.title}
                </span>
                <span className="block text-sm leading-relaxed text-emerald-50/65">
                  {item.desc}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-10 grid grid-cols-3 gap-3" role="list" aria-label="Ringkasan hari ini">
        {[
          { value: "47", label: "Pesanan hari ini" },
          { value: "Rp 1,4 jt", label: "Omzet hari ini" },
          { value: "23", label: "Pemesan aktif" },
        ].map((s) => (
          <div
            key={s.label}
            role="listitem"
            className="rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10"
          >
            <p className="text-xl font-bold tracking-tight text-white">{s.value}</p>
            <p className="mt-1 text-xs font-medium leading-snug text-emerald-50/65">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-8 text-xs leading-relaxed text-emerald-50/45">
        Dipakai kasir dan owner setiap hari — sejak 1998 melayani pasar dengan
        tahu segar setiap pagi.
      </p>
    </div>
  );
}

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="paper-texture flex min-h-svh">
      <div className="mx-auto flex w-full max-w-6xl flex-1 items-stretch gap-0 p-4 sm:p-6 lg:p-8">
        <div className="flex w-full overflow-hidden rounded-[20px] bg-card shadow-[0_16px_48px_rgba(28,25,23,0.14)] ring-1 ring-line">
          <BrandPanel />

          <main className="flex w-full flex-1 flex-col bg-card px-6 py-8 sm:px-10 sm:py-10 lg:max-w-[520px] lg:px-12">
            <div className="lg:hidden">
              <Link
                href="/"
                className="inline-flex items-center gap-2.5 rounded-xl focus-visible:outline-2 focus-visible:outline-soy-500 focus-visible:outline-offset-4"
                aria-label="Pabrik Tahu Maju Jaya — beranda"
              >
                <span
                  aria-hidden="true"
                  className="grid h-10 w-10 place-items-center rounded-xl bg-soy-100 ring-1 ring-soy-600/20"
                >
                  <svg width="22" height="22" viewBox="0 0 26 26" fill="none">
                    <rect x="2.5" y="7" width="15" height="14" rx="3.5" fill="#FEF3C7" />
                    <rect x="2.5" y="7" width="15" height="14" rx="3.5" stroke="#B45309" strokeWidth="1.8" />
                    <rect x="8.5" y="3" width="15" height="14" rx="3.5" fill="#FBBF24" />
                    <rect x="8.5" y="3" width="15" height="14" rx="3.5" stroke="#92400E" strokeWidth="1.8" />
                  </svg>
                </span>
                <span className="leading-tight">
                  <span className="block text-sm font-bold tracking-tight text-ink">
                    Pabrik Tahu Maju Jaya
                  </span>
                  <span className="block text-[11px] font-medium text-muted">
                    Buku Penjualan Tahu
                  </span>
                </span>
              </Link>
            </div>

            <div className="mt-8 lg:mt-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-soy-600">
                {eyebrow}
              </p>
              <h1
                className="mt-2 text-balance text-[28px] font-semibold leading-tight tracking-tight text-ink sm:text-3xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {title}
              </h1>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{subtitle}</p>
            </div>

            <div className="mt-7 flex-1">{children}</div>

            <div className="mt-8 border-t border-line pt-5 text-center text-sm text-muted">
              {footer}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-[13px] font-medium leading-snug text-red-700">
      {message}
    </p>
  );
}
