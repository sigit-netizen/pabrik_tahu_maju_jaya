import type { Metadata } from "next";
import AuthShell from "../_components/AuthShell";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Masuk | Pabrik Tahu Maju Jaya",
  description: "Masuk ke website pencatatan Pabrik Tahu Maju Jaya.",
  // Halaman auth internal — jangan diindeks mesin pencari.
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <AuthShell
      badge="Akses pencatat pabrik"
      title="Selamat pagi, selamat datang kembali."
      subtitle="Masuk dengan email dan password yang sudah disetujui administrator."
    >
      <LoginForm />
    </AuthShell>
  );
}
