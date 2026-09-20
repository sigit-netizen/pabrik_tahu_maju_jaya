"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type Session = {
  name?: string;
  email?: string;
  role?: string;
  at?: string;
};

type Order = {
  id: string;
  nama: string;
  jumlah: number;
  total: number;
  tanggal: string; // YYYY-MM-DD
  createdAt: number;
};

const ROLE_LABEL: Record<string, string> = {
  kasir: "Kasir",
  owner: "Owner",
};

const ORDERS_KEY = "maju-jaya-orders";

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
});

function todayStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatTanggal(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function seedOrders(): Order[] {
  const now = Date.now();
  return [
    { id: "seed-1", nama: "Warung Bu Siti", jumlah: 50, total: 75000, tanggal: todayStr(0), createdAt: now - 3000 },
    { id: "seed-2", nama: "Pakde Karno · Pasar Pagi", jumlah: 120, total: 180000, tanggal: todayStr(0), createdAt: now - 2000 },
    { id: "seed-3", nama: "Kantin SD 2", jumlah: 30, total: 45000, tanggal: todayStr(-1), createdAt: now - 1000 },
  ];
}

function loadOrders(): Order[] {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) {
      const seed = seedOrders();
      localStorage.setItem(ORDERS_KEY, JSON.stringify(seed));
      return seed;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return seedOrders();
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [query, setQuery] = useState("");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ nama?: string; jumlah?: string; total?: string; tanggal?: string }>({});

  useEffect(() => {
    const raw =
      localStorage.getItem("maju-jaya-session") ??
      sessionStorage.getItem("maju-jaya-session");
    if (!raw) {
      router.replace("/login");
      return;
    }
    try {
      setSession(JSON.parse(raw));
    } catch {
      router.replace("/login");
      return;
    }
    setOrders(loadOrders());
    setReady(true);
  }, [router]);

  function persist(next: Order[]) {
    setOrders(next);
    try {
      localStorage.setItem(ORDERS_KEY, JSON.stringify(next));
    } catch {
      setFormError("Gagal menyimpan ke perangkat (penyimpanan penuh / mode privat).");
    }
  }

  function onAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    const data = new FormData(e.currentTarget);
    const nama = String(data.get("nama") ?? "").trim();
    const jumlah = Number(data.get("jumlah"));
    const total = Number(data.get("total"));
    const tanggal = String(data.get("tanggal") ?? "");

    const errs: typeof fieldErrors = {};
    if (nama.length < 3) errs.nama = "Nama pemesan minimal 3 huruf.";
    if (!Number.isFinite(jumlah) || jumlah < 1 || !Number.isInteger(jumlah))
      errs.jumlah = "Jumlah harus bilangan bulat, minimal 1 papan.";
    if (!Number.isFinite(total) || total <= 0)
      errs.total = "Total harga harus lebih dari Rp 0.";
    if (!tanggal) errs.tanggal = "Tanggal pesanan wajib diisi.";
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const order: Order = {
      id: `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
      nama,
      jumlah,
      total,
      tanggal,
      createdAt: Date.now(),
    };
    persist([order, ...orders]);
    e.currentTarget.reset();
    (
      e.currentTarget.querySelector('input[name="tanggal"]') as HTMLInputElement | null
    )?.setAttribute("value", todayStr(0));
    setQuery("");
  }

  function onDelete(id: string, nama: string) {
    if (!window.confirm(`Hapus pesanan dari "${nama}"?`)) return;
    persist(orders.filter((o) => o.id !== id));
  }

  function logout() {
    localStorage.removeItem("maju-jaya-session");
    sessionStorage.removeItem("maju-jaya-session");
    router.push("/login");
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? orders.filter((o) => o.nama.toLowerCase().includes(q))
      : orders;
    return [...list].sort((a, b) =>
      a.tanggal === b.tanggal
        ? b.createdAt - a.createdAt
        : b.tanggal.localeCompare(a.tanggal),
    );
  }, [orders, query]);

  const totalPesanan = orders.length;
  const totalPapan = orders.reduce((s, o) => s + o.jumlah, 0);
  const totalOmzet = orders.reduce((s, o) => s + o.total, 0);

  if (!ready) {
    return (
      <div className="paper-texture grid min-h-svh place-items-center p-6">
        <p className="text-sm font-medium text-muted">Membuka buku penjualan…</p>
      </div>
    );
  }

  const displayName =
    session?.name ?? session?.email?.split("@")[0] ?? "Pengguna";

  return (
    <div className="paper-texture min-h-svh">
      <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-pine-900 px-5 py-4 text-white shadow-[0_12px_32px_rgba(20,52,43,0.3)] sm:px-6">
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
              <p className="text-[15px] font-bold">Buku Penjualan · Maju Jaya</p>
              <p className="text-xs text-emerald-100/70">
                Halo, {displayName}
                {session?.role && ROLE_LABEL[session.role]
                  ? ` · ${ROLE_LABEL[session.role]}`
                  : ""}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="btn-primary border border-white/20 bg-white/10 px-4 text-sm text-white hover:bg-white/15"
          >
            Keluar
          </button>
        </header>

        <main className="mt-5 space-y-4">
          {/* Ringkasan */}
          <section
            className="grid grid-cols-3 gap-3"
            aria-label="Ringkasan penjualan"
          >
            {[
              { v: String(totalPesanan), l: "Total pesanan" },
              { v: totalPapan.toLocaleString("id-ID"), l: "Papan terjual" },
              { v: rupiah.format(totalOmzet), l: "Total omzet" },
            ].map((s) => (
              <div
                key={s.l}
                className="rounded-[20px] bg-card p-4 ring-1 ring-line sm:p-5"
              >
                <p className="truncate text-lg font-bold tracking-tight text-ink sm:text-2xl" title={s.v}>
                  {s.v}
                </p>
                <p className="mt-1 text-xs font-medium text-muted">{s.l}</p>
              </div>
            ))}
          </section>

          {/* Form tambah pesanan */}
          <section
            className="rounded-[20px] bg-card p-6 ring-1 ring-line sm:p-7"
            aria-labelledby="tambah"
          >
            <h1
              id="tambah"
              className="text-xl font-semibold tracking-tight text-ink sm:text-2xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Catat pesanan baru
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Isi empat data ini setiap ada pesanan masuk.
            </p>

            {formError && (
              <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                {formError}
              </div>
            )}

            <form onSubmit={onAdd} noValidate className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="nama" className="mb-1.5 block text-sm font-semibold text-ink">
                  Nama pemesan
                </label>
                <input
                  id="nama"
                  name="nama"
                  type="text"
                  autoComplete="off"
                  placeholder="mis. Warung Bu Siti"
                  aria-invalid={Boolean(fieldErrors.nama)}
                  className="field-input"
                />
                {fieldErrors.nama && (
                  <p role="alert" className="mt-1.5 text-[13px] font-medium text-red-700">{fieldErrors.nama}</p>
                )}
              </div>
              <div>
                <label htmlFor="jumlah" className="mb-1.5 block text-sm font-semibold text-ink">
                  Jumlah pesanan <span className="font-normal text-muted">(papan)</span>
                </label>
                <input
                  id="jumlah"
                  name="jumlah"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  placeholder="mis. 50"
                  aria-invalid={Boolean(fieldErrors.jumlah)}
                  className="field-input"
                />
                {fieldErrors.jumlah && (
                  <p role="alert" className="mt-1.5 text-[13px] font-medium text-red-700">{fieldErrors.jumlah}</p>
                )}
              </div>
              <div>
                <label htmlFor="total" className="mb-1.5 block text-sm font-semibold text-ink">
                  Total harga <span className="font-normal text-muted">(Rp)</span>
                </label>
                <input
                  id="total"
                  name="total"
                  type="number"
                  min={1}
                  step={500}
                  inputMode="numeric"
                  placeholder="mis. 75000"
                  aria-invalid={Boolean(fieldErrors.total)}
                  className="field-input"
                />
                {fieldErrors.total && (
                  <p role="alert" className="mt-1.5 text-[13px] font-medium text-red-700">{fieldErrors.total}</p>
                )}
              </div>
              <div>
                <label htmlFor="tanggal" className="mb-1.5 block text-sm font-semibold text-ink">
                  Tanggal pesanan masuk
                </label>
                <input
                  id="tanggal"
                  name="tanggal"
                  type="date"
                  defaultValue={todayStr(0)}
                  aria-invalid={Boolean(fieldErrors.tanggal)}
                  className="field-input"
                />
                {fieldErrors.tanggal && (
                  <p role="alert" className="mt-1.5 text-[13px] font-medium text-red-700">{fieldErrors.tanggal}</p>
                )}
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="btn-primary w-full bg-pine-900 text-white shadow-[0_8px_20px_rgba(20,52,43,0.28)] hover:bg-pine-800"
                >
                  Simpan pesanan
                </button>
              </div>
            </form>
          </section>

          {/* Daftar pesanan */}
          <section
            className="rounded-[20px] bg-card p-6 ring-1 ring-line sm:p-7"
            aria-labelledby="daftar"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="daftar" className="text-lg font-bold tracking-tight text-ink">
                  Daftar pesanan
                </h2>
                <p className="mt-0.5 text-[13px] text-muted">
                  {visible.length} dari {orders.length} pesanan
                  {query.trim() && <> · saringan: “{query.trim()}”</>}
                </p>
              </div>
              <div className="w-full sm:w-64">
                <label htmlFor="cari" className="sr-only">
                  Cari nama pemesan
                </label>
                <input
                  id="cari"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari nama pemesan…"
                  className="field-input h-11"
                />
              </div>
            </div>

            {visible.length === 0 ? (
              <div role="status" className="mt-5 rounded-2xl bg-paper px-5 py-10 text-center ring-1 ring-line">
                <p className="text-[15px] font-bold text-ink">
                  {orders.length === 0 ? "Belum ada pesanan" : "Tidak ketemu"}
                </p>
                <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted">
                  {orders.length === 0
                    ? "Catat pesanan pertama lewat form di atas — akan muncul di sini."
                    : "Coba kata kunci lain, mis. nama warung atau pasar."}
                </p>
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto rounded-2xl ring-1 ring-line">
                <table className="w-full min-w-[640px] border-collapse bg-card text-left text-sm">
                  <thead>
                    <tr className="bg-paper text-xs uppercase tracking-wide text-muted">
                      <th scope="col" className="px-4 py-3 font-bold">Tanggal</th>
                      <th scope="col" className="px-4 py-3 font-bold">Nama pemesan</th>
                      <th scope="col" className="px-4 py-3 text-right font-bold">Jumlah</th>
                      <th scope="col" className="px-4 py-3 text-right font-bold">Total harga</th>
                      <th scope="col" className="px-4 py-3 text-right font-bold">
                        <span className="sr-only">Aksi</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((o) => (
                      <tr key={o.id} className="border-t border-line hover:bg-soy-50/60">
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-ink">
                          {formatTanggal(o.tanggal)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-ink">{o.nama}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-stone-600">
                          {o.jumlah.toLocaleString("id-ID")} papan
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-pine-900">
                          {rupiah.format(o.total)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => onDelete(o.id, o.nama)}
                            aria-label={`Hapus pesanan dari ${o.nama}`}
                            className="inline-grid h-9 w-9 place-items-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-red-500"
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                              <path d="M2.5 4h11M6.5 4V2.8c0-.44.36-.8.8-.8h1.4c.44 0 .8.36.8.8V4M4 4l.7 9.2c.04.44.4.8.84.8h3.92c.44 0 .8-.36.84-.8L11 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
