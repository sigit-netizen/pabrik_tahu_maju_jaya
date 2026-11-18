import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/*
 * Content Security Policy ketat. Sumber daya hanya boleh dari origin sendiri.
 *
 * Sudah diverifikasi bahwa frontend memang tidak memuat apa pun dari luar:
 *   - next/font/google men-self-host fontnya (11 berkas .woff2 di _next/static/media),
 *     jadi fonts.googleapis.com / fonts.gstatic.com TIDAK diperlukan saat runtime.
 *   - Tidak ada <img>/<iframe>/<object>/<embed>/<script> eksternal di app/(frontend).
 *   - Semua 13 panggilan fetch() menuju /api/* di origin yang sama.
 *
 * 'unsafe-eval':
 *   Hanya dipakai saat development (React Refresh / HMR) dan DI SATU RUTE,
 *   yaitu /api-doc. Swagger UI meng-compile skema JSON memakai Ajv, dan Ajv
 *   membangun validator dengan new Function - sudah dicek langsung di
 *   node_modules/swagger-ui-react/swagger-ui-bundle.js dan chunk kliennya.
 *   Rute itu sudah dibatasi hanya untuk pengguna yang sudah masuk, jadi
 *   kelemahannya terkurung di satu halaman admin, bukan di seluruh situs.
 *
 * 'unsafe-inline' pada script-src:
 *   App Router menyisipkan skrip inline untuk payload RSC, dan menghapusnya
 *   butuh 'nonce' yang harus dipasang di proxy.ts. Jadi CSP ini TIDAK menahan
 *   XSS inline. Yang menahannya adalah tidak adanya sink innerHTML /
 *   dangerouslySetInnerHTML / eval / new Function di app/(frontend) - sudah
 *   diperiksa, 0 temuan.
 *
 * connect-src sengaja hanya 'self'. Frontend tidak pernah menghubungi Supabase
 * dari browser, jadi kalau suatu saat ada XSS, tidak ada jalur mengirim data
 * keluar. ws:/wss: hanya di development, untuk WebSocket HMR milik Next.
 */
const dasar = [
  "default-src 'self'",
  // 'unsafe-eval' di development dipakai React Refresh/HMR. Di produksi tidak
  // ada, kecuali di /api-doc (lihat di bawah).
  isDev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "media-src 'self'",
  isDev ? "connect-src 'self' ws: wss:" : "connect-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  /*
   * SENGAJA TIDAK ADA "upgrade-insecure-requests" - jangan ditambahkan kembali.
   *
   * Directive itu menaikkan SEMUA permintaan http:// milik situs sendiri ke
   * https://, termasuk berkas _next/static/*, dan menurut dokumentasi MDN kalau
   * sumbernya tidak tersedia lewat HTTPS maka permintaan itu GAGAL tanpa
   * fallback ke HTTP. Jadi begitu halaman dibuka lewat HTTP biasa - misalnya
   * http://192.168.0.183:3000 waktu menjalankan `npm start` dan diakses dari HP
   * satu WiFi - seluruh CSS dan JS akan gagal dimuat dan aplikasinya rusak.
   *
   * Manfaatnya di sini juga nol: script-src 'self', img-src 'self' data: blob:,
   * dan connect-src 'self' sudah memblokir semua sumber luar, jadi tidak ada
   * permintaan http:// ke domain lain yang perlu dinaikkan. Yang melindungi
   * pengunjung dari downgrade HTTPS adalah Strict-Transport-Security di bawah.
   */
];

/** Sama seperti `dasar`, hanya menambah 'unsafe-eval' agar Swagger UI hidup. */
const untukApiDoc = dasar.map((d) =>
  d.startsWith("script-src") ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : d
);

const csp = dasar.join("; ");
const cspApiDoc = untukApiDoc.join("; ");

const headerBersama = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), serial=(), midi=()",
  },
  // HSTS hanya berguna di HTTPS; Vercel otomatis HTTPS.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["onnxruntime-node"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...headerBersama, { key: "Content-Security-Policy", value: csp }],
      },
      // HARUS diletakkan setelah /:path* . Sudah diuji: Next memakai aturan
      // TERAKHIR yang cocok, bukan yang pertama, jadi urutan ini menentukan.
      {
        source: "/api-doc",
        headers: [...headerBersama, { key: "Content-Security-Policy", value: cspApiDoc }],
      },
    ];
  },
};

export default nextConfig;
