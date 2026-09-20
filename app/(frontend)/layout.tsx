import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Pabrik Tahu Maju Jaya — Buku Penjualan",
    template: "%s · Pabrik Tahu Maju Jaya",
  },
  description:
    "Buku penjualan digital Pabrik Tahu Maju Jaya: catat nama pemesan, jumlah pesanan, total harga, dan tanggal — rapi dalam satu tempat.",
  applicationName: "Pabrik Tahu Maju Jaya",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        {children}
      </body>
    </html>
  );
}
