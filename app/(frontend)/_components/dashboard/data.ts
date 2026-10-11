"use client";

export type ViewKey = "dashboard" | "input" | "ai" | "pengaturan";

export type RekapRow = {
  id: string;
  tanggal: string;
  cetak: number;
  masak: number;
  status: "Tercatat" | "Proses" | "Selesai";
};

export type InputRow = {
  id: number;
  cetak: number;
  masak: number;
  done: boolean;
};

const HARIAN_LABEL = ["06.00", "08.00", "10.00", "12.00", "14.00", "16.00", "18.00"];
const HARIAN_VAL = [42, 30, 55, 62, 58, 96, 118];

const MINGGUAN_LABEL = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const MINGGUAN_VAL = [320, 410, 380, 520, 610, 740, 690];

const BULANAN_LABEL = ["Mg 1", "Mg 2", "Mg 3", "Mg 4"];
const BULANAN_VAL = [2100, 2650, 2480, 3120];

export function getSeries(mode: "harian" | "mingguan" | "bulanan") {
  if (mode === "harian") return { labels: HARIAN_LABEL, values: HARIAN_VAL };
  if (mode === "mingguan") return { labels: MINGGUAN_LABEL, values: MINGGUAN_VAL };
  return { labels: BULANAN_LABEL, values: BULANAN_VAL };
}

export const REKAP_AWAL: RekapRow[] = [
  { id: "R-101", tanggal: "11 Okt 2026 — Pagi", cetak: 120, masak: 118, status: "Selesai" },
  { id: "R-102", tanggal: "11 Okt 2026 — Sore", cetak: 96, masak: 90, status: "Proses" },
  { id: "R-103", tanggal: "10 Okt 2026 — Pagi", cetak: 132, masak: 130, status: "Selesai" },
  { id: "R-104", tanggal: "10 Okt 2026 — Sore", cetak: 88, masak: 84, status: "Selesai" },
  { id: "R-105", tanggal: "09 Okt 2026 — Pagi", cetak: 140, masak: 126, status: "Tercatat" },
  { id: "R-106", tanggal: "09 Okt 2026 — Sore", cetak: 104, masak: 101, status: "Selesai" },
  { id: "R-107", tanggal: "08 Okt 2026 — Pagi", cetak: 118, masak: 115, status: "Selesai" },
];

export const INPUT_AWAL: InputRow[] = [
  { id: 1, cetak: 24, masak: 22, done: true },
  { id: 2, cetak: 30, masak: 28, done: true },
  { id: 3, cetak: 18, masak: 0, done: false },
  { id: 4, cetak: 0, masak: 0, done: false },
  { id: 5, cetak: 0, masak: 0, done: false },
];

export function formatRibuan(n: number) {
  return n.toLocaleString("id-ID");
}

export function hariIniLabel() {
  try {
    return new Date().toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "Hari ini";
  }
}
