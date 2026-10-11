import type { Metadata } from "next";
import DashboardApp from "./_components/dashboard/DashboardApp";

export const metadata: Metadata = {
  title: "Tahu Maju Jaya | Dashboard Pencatatan Pabrik",
  description:
    "Dashboard pencatatan Pabrik Tahu Maju Jaya — grafik produksi harian/mingguan/bulanan, input cetakan realtime, AI prediksi, dan pengaturan.",
};

export default function Home() {
  return <DashboardApp />;
}
