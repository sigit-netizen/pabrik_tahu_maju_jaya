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
  title: "Pabrik Tahu Maju Jaya | Pencatatan Produksi & Penjualan",
  description:
    "Website pencatatan Pabrik Tahu Maju Jaya — kelola produksi, stok, dan penjualan tahu harian dengan nyaman.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#F6F1E7] text-[#14342B]">
        {children}
      </body>
    </html>
  );
}
