import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-cream text-pine">
      {/* Navbar */}
      <header className="sticky top-0 z-10 border-b border-pine/10 bg-cream/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
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
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-sm font-semibold text-pine transition hover:bg-pine/5"
            >
              Masuk
            </Link>
            <Link
              href="/register"
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-deep"
            >
              Daftar
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="dot-grid-dark">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-20">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight text-balance sm:text-5xl lg:text-[3.4rem] lg:leading-[1.05]">
                Catat produksi tahu{" "}
                <span className="text-brand">rapi &amp; tenang</span> setiap
                hari.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-pine/70 sm:text-lg sm:leading-8">
                Website pencatatan untuk Pabrik Tahu Maju Jaya — bantu tim
                mencatat hasil produksi, stok, dan penjualan dalam satu tempat
                yang modern dan nyaman dilihat.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-pine px-7 text-sm font-bold text-cream shadow-md transition hover:bg-pine-deep"
                >
                  Buat akun pencatat
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-pine/20 bg-white/80 px-7 text-sm font-bold text-pine transition hover:border-brand hover:text-brand-deep"
                >
                  Masuk ke akun
                </Link>
              </div>
              <p className="mt-4 text-[13px] leading-5 text-pine/60">
                Akun baru perlu disetujui administrator sebelum bisa masuk.
                Hubungi admin pabrik setelah mendaftar.
              </p>
            </div>

            {/* Kartu ringkasan */}
            <div>
              <div className="overflow-hidden rounded-3xl bg-pine text-cream shadow-xl">
                <div className="dot-grid p-7 sm:p-8">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold tracking-widest text-cream/60 uppercase">
                      Hari ini di pabrik
                    </p>
                    <span className="rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">
                      Live
                    </span>
                  </div>
                  <p className="mt-4 text-4xl font-extrabold tracking-tight">
                    1.250 <span className="text-lg font-semibold text-cream/70">papan tahu</span>
                  </p>
                  <p className="mt-1 text-sm text-cream/70">
                    Target produksi tercapai 96% — kedelai 180 kg.
                  </p>
                  <div className="mt-6 grid grid-cols-3 gap-3">
                    {[
                      { label: "Stok siap", value: "320" },
                      { label: "Terjual", value: "930" },
                      { label: "Retur", value: "12" },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="rounded-2xl bg-cream/10 p-3 text-center backdrop-blur-sm"
                      >
                        <p className="text-xl font-extrabold">{s.value}</p>
                        <p className="mt-0.5 text-[11px] font-semibold text-cream/70">
                          {s.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 bg-pine-deep px-7 py-4 text-[13px]">
                  <span className="font-semibold text-cream/80">
                    Shift pagi · 04.00 – 10.00
                  </span>
                  <span className="font-bold text-brand-soft">
                    +8% vs kemarin
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Fitur */}
        <section className="mx-auto w-full max-w-6xl px-5 py-14">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Semua catatan dalam satu dasbor kerja
          </h2>
          <p className="mt-2 max-w-2xl text-[15px] leading-6 text-pine/65">
            Dirancang agar nyaman dibaca pagi hari di pabrik — kontras lembut,
            tombol besar, dan bahasa sederhana.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Produksi harian",
                desc: "Catat tanggal, jumlah cetakan, bahan kedelai, dan petugas shift dengan cepat.",
                icon: (
                  <path d="M4 10h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9Zm2-6h12a2 2 0 0 1 2 2v2H4V6a2 2 0 0 1 2-2Zm5 9v4" strokeWidth={1.8} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                ),
              },
              {
                title: "Stok & persediaan",
                desc: "Pantau tahu siap jual, tahu setengah jadi, dan sisa bahan baku secara real-time.",
                icon: (
                  <path d="M4 7 12 3l8 4-8 4-8-4Zm0 5 8 4 8-4M4 17l8 4 8-4" strokeWidth={1.8} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                ),
              },
              {
                title: "Penjualan & laporan",
                desc: "Rekap penjualan ke pasar, warung, dan pelanggan tetap — siap direkap mingguan.",
                icon: (
                  <path d="M4 20V10m6 10V4m6 16v-7m4 7H2" strokeWidth={1.8} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                ),
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-3xl border border-pine/10 bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/12 text-brand-deep">
                  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                    {f.icon}
                  </svg>
                </span>
                <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-pine/65">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Alur */}
        <section className="border-y border-pine/10 bg-white/60">
          <div className="mx-auto w-full max-w-6xl px-5 py-12">
            <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">
              Alur masuk akun
            </h2>
            <ol className="mt-6 grid gap-3 sm:grid-cols-4">
              {[
                { n: "1", t: "Daftar akun", d: "Isi username, email, password." },
                { n: "2", t: "Tunggu persetujuan", d: "Admin verifikasi akun Anda." },
                { n: "3", t: "Masuk", d: "Login dengan email & password." },
                { n: "4", t: "Mulai mencatat", d: "Catat produksi setiap shift." },
              ].map((s) => (
                <li
                  key={s.n}
                  className="rounded-2xl border border-pine/10 bg-cream p-5"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pine text-sm font-extrabold text-cream">
                    {s.n}
                  </span>
                  <p className="mt-3 text-sm font-bold">{s.t}</p>
                  <p className="mt-1 text-[13px] leading-5 text-pine/65">{s.d}</p>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand px-6 text-sm font-bold text-white transition hover:bg-brand-deep"
              >
                Ke halaman masuk
              </Link>
              <Link
                href="/register"
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-pine/20 px-6 text-sm font-bold transition hover:border-brand"
              >
                Ke halaman daftar
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-pine text-cream">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="font-bold">Pabrik Tahu Maju Jaya</p>
          <p className="text-cream/60">
            Tahu segar setiap pagi · Dicatat rapi, dijual berkah.
          </p>
        </div>
      </footer>
    </div>
  );
}
