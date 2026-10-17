"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

/*
 * swagger-ui-react hanya bisa jalan di browser (mengakses window saat render),
 * jadi harus dimuat tanpa SSR.Stub dimuat lebih dulu supaya tidak blank.
 */
const SwaggerUI = dynamic(() => import("swagger-ui-react"), {
  ssr: false,
  loading: () => (
    <p className="p-10 text-center text-[13px] font-medium text-pine/60">Memuat dokumentasi API…</p>
  ),
});

export default function ApiDocPage() {
  return (
    <section className="container mx-auto p-4">
      <h1 className="mb-4 text-2xl font-bold">API Documentation</h1>
      <div className="rounded bg-white p-4 shadow">
        <SwaggerUI url="/api/swagger" />
      </div>
    </section>
  );
}