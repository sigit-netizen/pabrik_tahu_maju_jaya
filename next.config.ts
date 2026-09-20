import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Jangan bocorkan fingerprint framework ke hacker (hilangkan header X-Powered-By).
  poweredByHeader: false,

  // Header keamanan untuk semua route (anti clickjacking, anti MIME-sniffing, dll).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
