import Link from "next/link";

export default function Home() {
  return (
    <div className="paper-texture min-h-svh">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col p-4 sm:p-6 lg:p-8">
        <header className="flex items-center justify-between rounded-[20px] bg-pine-900 px-5 py-4 text-white shadow-[0_12px_32px_rgba(20,52,43,0.3)] sm:px-6">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-xl bg-soy-50">
              <svg width="22" height="22" viewBox="0 0 26 26" fill="none">
                <rect x="2.5" y="7" width="15" height="14" rx="3.5" fill="#FEF3C7" />
                <rect x="2.5" y="7" width="15" height="14" rx="3.5" stroke="#B45309" strokeWidth="1.8" />
                <rect x="8.5" y="3" width="15" height="14" rx="3.5" fill="#FBBF24" />
                <rect x="8.5" y="3" width="15" height="14" rx="3.5" stroke="#92400E" strokeWidth="1.8" />
              </svg>
            </span>
            <div className="leading-tight">
              <p className="text-[15px] font-bold tracking-tight">Pabrik Tahu Maju Jaya</p>
              <p className="text-xs text-emerald-100/70">Buku Penjualan Tahu</p>
            </div>
          </div>
          <nav className="flex items-center gap-2" aria-label="Navigasi utama">
            <Link
              href="/login"
              className="btn-primary hidden px-5 text-sm text-emerald-50 hover:bg-white/10 sm:inline-flex sm:items-center"
            >
              Masuk
            </Link>
            <Link
              href="/register"
              className="btn-primary inline-flex items-center bg-amber-400 px-5 text-sm text-stone-900 shadow-[0_6px_16px_rgba(251,191,36,0.35)] hover:bg-amber-300"
            >
              Daftar
            </Link>
          </nav>
        </header>

        <main className="mt-4 grid flex-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="pine-texture flex flex-col justify-between overflow-hidden rounded-[20px] p-8 text-white sm:p-10">
            <div>
              <h1
                className="max-w-lg text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Buku penjualan tahu, rapi setiap hari.
              </h1>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-emerald-50/75">
                Gantikan nota kertas yang mudah hilang dengan satu buku digital:
                nama pemesan, jumlah pesanan, total harga, dan tanggal — tercatat
                rapi dan bisa dibuka dari HP.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="btn-primary inline-flex items-center gap-2 bg-amber-400 px-6 text-stone-900 hover:bg-amber-300"
                >
                  Masuk & catat pesanan
                  <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <path d="M3 9h11M9.5 4.5 14 9l-4.5 4.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
                <Link
                  href="/register"
                  className="btn-primary inline-flex items-center border border-white/25 bg-white/5 px-6 text-white hover:bg-white/10"
                >
                  Buat akun
                </Link>
              </div>
            </div>

            <dl className="mt-10 grid grid-cols-3 gap-3">
              {[
                { v: "47", l: "Pesanan hari ini" },
                { v: "Rp 1,4 jt", l: "Omzet hari ini" },
                { v: "23", l: "Pemesan aktif" },
              ].map((s) => (
                <div key={s.l} className="rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10">
                  <dt className="order-2 mt-1 text-xs font-medium text-emerald-50/65">{s.l}</dt>
                  <dd className="order-1 text-xl font-bold tracking-tight">{s.v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="grid gap-4">
            <section className="rounded-[20px] bg-card p-7 ring-1 ring-line sm:p-8" aria-labelledby="fitur">
              <h2 id="fitur" className="text-lg font-bold tracking-tight text-ink">
                Satu pesanan, empat data
              </h2>
              <ul className="mt-4 space-y-3.5">
                {[
                  { t: "Nama pemesan", d: "Siapa yang memesan: warung, pasar, kantin, atau perorangan." },
                  { t: "Jumlah pesanan", d: "Berapa papan tahu yang dipesan." },
                  { t: "Total harga pesanan", d: "Nilai pesanan dalam rupiah — omzet otomatis terhitung." },
                  { t: "Tanggal pesanan masuk", d: "Kapan pesanan dicatat, gampang direkap per hari." },
                ].map((f, i) => (
                  <li key={f.t} className="flex gap-3.5 rounded-2xl bg-paper px-4 py-3.5 ring-1 ring-line">
                    <span
                      aria-hidden="true"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-pine-900 text-sm font-bold text-amber-300"
                    >
                      {i + 1}
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-ink">{f.t}</span>
                      <span className="block text-[13px] leading-relaxed text-muted">{f.d}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-[20px] bg-card p-7 ring-1 ring-line sm:p-8" aria-labelledby="mulai">
              <h2 id="mulai" className="text-lg font-bold tracking-tight text-ink">
                Mulai dalam 2 menit
              </h2>
              <ol className="mt-3 space-y-2.5 text-sm leading-relaxed text-stone-600">
                <li><strong className="text-ink">1. Buat akun</strong> — sebagai kasir pencatat atau owner.</li>
                <li><strong className="text-ink">2. Masuk & catat pesanan pertama</strong> — nama, jumlah, harga, tanggal.</li>
                <li><strong className="text-ink">3. Pantau omzet</strong> — total penjualan hari ini langsung kebaca.</li>
              </ol>
              <Link
                href="/register"
                className="btn-primary mt-5 flex w-full items-center justify-center bg-pine-900 text-white hover:bg-pine-800"
              >
                Buat akun sekarang
              </Link>
              <p className="mt-3 text-center text-xs text-muted">
                Sudah punya akun?{" "}
                <Link href="/login" className="font-semibold text-soy-600 underline underline-offset-4">
                  Masuk di sini
                </Link>
              </p>
            </section>
          </div>
        </main>

        <footer className="mt-4 rounded-[20px] bg-card px-6 py-4 text-center text-xs leading-relaxed text-muted ring-1 ring-line">
          Pabrik Tahu Maju Jaya · Buku penjualan digital · Data hanya dipakai internal.
        </footer>
      </div>
    </div>
  );
}
