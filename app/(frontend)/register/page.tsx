import type { Metadata } from "next";
import AuthShell from "../_components/AuthShell";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = {
  title: "Daftar | Pabrik Tahu Maju Jaya",
  description: "Daftar akun pencatat untuk website Pabrik Tahu Maju Jaya.",
  // Halaman auth internal — jangan diindeks mesin pencari.
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <AuthShell
      badge="Pendaftaran pencatat"
      title="Gabung tim pencatatan pabrik."
      subtitle="Isi data di bawah. Setelah daftar, akun Anda akan diverifikasi administrator."
    >
      <RegisterForm />
    </AuthShell>
  );
}
