"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import "swagger-ui-react/swagger-ui.css";

/*
 * swagger-ui-react hanya bisa jalan di browser (mengakses window saat render),
 * jadi harus dimuat tanpa SSR. Stub dimuat lebih dulu supaya tidak blank.
 */
const SwaggerUI = dynamic(() => import("swagger-ui-react"), {
  ssr: false,
  loading: () => (
    <p className="p-10 text-center text-[13px] font-medium text-pine/60">Memuat dokumentasi API…</p>
  ),
});

type Status = "memeriksa" | "boleh" | "ditolak";

export default function ApiDocPage() {
  const [status, setStatus] = useState<Status>("memeriksa");

  /*
   * Halaman ini membeberkan seluruh peta endpoint beserta bentuk request dan
   * responsenya. Sebelumnya siapa pun yang tahu URL-nya langsung melihat 18
   * endpoint tanpa perlu masuk sama sekali.
   *
   * Yang dipasang di sini adalah pembatas di sisi tampilan: spesifikasi tidak
   * lagi ditampilkan sebelum sesi terbukti sah. Pembatas yang sesungguhnya
   * tetap harus dipasang di app/api/swagger/route.ts — memanggil endpoint itu
   * langsung masih mengembalikan spesifikasi penuh. Catatan itu sudah masuk
   * PANDUAN_PERBAIKAN_BACKEND.md.
   */
  useEffect(() => {
    let batal = false;
    void (async () => {
      try {
        const res = await fetch("/api/proxy/me", { credentials: "include", cache: "no-store" });
        if (!batal) setStatus(res.ok ? "boleh" : "ditolak");
      } catch {
        if (!batal) setStatus("ditolak");
      }
    })();
    return () => {
      batal = true;
    };
  }, []);

  if (status === "memeriksa") {
    return (
      <section className="container mx-auto p-4">
        <p
          className="p-10 text-center text-[13px] font-medium text-pine/60"
          role="status"
          aria-live="polite"
        >
          Memeriksa hak akses…
        </p>
      </section>
    );
  }

  if (status === "ditolak") {
    return (
      <section className="container mx-auto p-4">
        <div className="mx-auto max-w-md rounded-2xl border border-line-strong bg-white p-6 text-center shadow-sm">
          <h1 className="mb-2 text-lg font-bold text-pine">Dokumentasi API terbatas</h1>
          <p className="mb-5 text-[13px] leading-5 text-pine/70">
            Halaman ini menampilkan seluruh peta endpoint aplikasi, jadi hanya bisa dibuka oleh
            pengguna yang sudah masuk.
          </p>
          <Link
            href="/"
            className="inline-flex h-[42px] items-center justify-center rounded-xl bg-pine px-5 text-[13px] font-bold text-cream transition hover:bg-pine-deep"
          >
            Masuk terlebih dahulu
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="container mx-auto p-4">
      <h1 className="mb-4 text-2xl font-bold">API Documentation</h1>
      <div className="rounded bg-white p-4 shadow">
        <SwaggerUI url="/api/swagger" />
      </div>
    </section>
  );
}
