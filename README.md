# Pabrik Tahu Maju Jaya

Sistem pencatatan produksi dan omzet pabrik tahu. Operator mencatat cetakan
dan masak per pelanggan, dashboard menampilkan rekap, dan tarif per cetak
bisa diatur dari menu Pengaturan.

Capstone project — Teknik Informatika, Universitas Noble Kediri.

---

## Tumpukan teknologi

| Bagian | Teknologi |
|---|---|
| Framework | Next.js 16.3.5 (App Router, Turbopack) |
| UI | React 19.2.8, Tailwind CSS v4 |
| Bahasa | TypeScript 5 (mode `strict`) |
| Database | Supabase (PostgreSQL + PostgREST) |
| Autentikasi | Cookie `httpOnly` bertanda tangan HMAC-SHA256 |
| Dokumentasi API | Swagger UI (`next-swagger-doc` + `swagger-ui-react`) |

> Proyek ini memakai Next.js 16, yang memakai `proxy.ts` (bukan `middleware.ts`)
> dan membuat berkas agen otomatis. Baca `node_modules/next/dist/docs/`
> sebelum mengubah kode karena beberapa API berbeda dari versi lama.

---

## Menjalankan di komputer sendiri

```bash
npm install

# Salin berkas contoh lalu isi dengan kredensial aslimu
Copy-Item .env.example .env      # Windows PowerShell
cp .env.example .env             # macOS / Linux

npm run dev
```

Buka <http://localhost:3000>. Halaman tersebut adalah halaman masuk; setelah
berhasil masuk kamu diarahkan ke `/dashboard`.

### Persiapan database

Tabel `prediksi` dan `test_koneksi` belum ada di database proyek ini.
Jalankan `supabase_migration.sql` di **Supabase Dashboard > SQL Editor**,
lalu klik Run. Skripnya aman dijalankan berulang kali.

Tanpa langkah itu, fitur estimasi produksi akan menampilkan data contoh dari
server (aplikasi akan memberi tahu lewat banner di layar).

### Perintah lain

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | Server pengembangan |
| `npm run build` | Build produksi |
| `npm run start` | Menjalankan hasil build |
| `npm run lint` | Pemeriksaan lint (ESLint, Termux Next) |

---

## Susunan folder

```
app/
├── (frontend)/          Halaman yang dilihat pengguna
│   ├── page.tsx             /            -> halaman masuk
│   ├── dashboard/page.tsx   /dashboard   -> aplikasi dashboard
│   ├── login/  (dihapus)    dulu /login, kini menyatu ke /
│   ├── register/            /register    -> pendaftaran akun
│   ├── api-doc/             /api-doc     -> Swagger UI
│   ├── _components/
│   │   ├── AuthShell.tsx        Kerangka halaman auth
│   │   ├── LoginForm.tsx        Formulir masuk
│   │   └── dashboard/
│   │       ├── DashboardApp.tsx  Kerangka + navigasi + penjaga sesi
│   │       ├── DashboardView.tsx Grafik, tabel rekap, modal cetak
│   │       ├── InputView.tsx     Formulir pencatatan produksi
│   │       ├── AiView.tsx        Estimasi jumlah cetakan
│   │       ├── SettingsView.tsx  Profil, ganti sandi, harga cetak
│   │       ├── data.ts           Tipe respons API + helper
│   │       ├── theme.ts          Fungsi skin() untuk terang/gelap
│   │       └── icons.tsx         Ikon SVG
│   └── globals.css         Token warna & sistem animasi
│
├── (backend)/api/        Route API (butuh autentikasi)
├── api/                  Proxy: auth/*, proxy/*, swagger
└── favicon.ico
lib/                     session, auth-check, rate-limit, supabase, swagger, date-helper
proxy.ts                 Pembatas laju + batas ukuran body
```

> Route group `(frontend)` dan `(backend)` **tidak** memengaruhi URL. Keduanya
> hanya pengelompokan berkas; URL sebenarnya tetap `/api/...`.

---

## Cara kerja autentikasi

Tiga lapis,dirangkai berurutan:

1. **Proxy** (`app/api/auth/login`) menerima email + password dari browser,
   menyuntikkan kunci internal dari sisi server, lalu meneruskannya ke
   `/api/login`. Rahasia tidak pernah masuk ke bundel JavaScript.
2. **Backend** (`app/(backend)/api/login`) memeriksa kunci, membandingkan
   password dengan bcrypt, dan memeriksa status akun.
3. **Sesi** — bila berhasil, proxy memasang cookie `ptmj_session` yang berisi
   payload + tanda tangan HMAC-SHA256, berlaku 24 jam, `httpOnly`.

Setiap route produksi memanggil `verifyDualAuth()` yang memeriksa kunci API
**dan** cookie sesi sekaligus.

### Gate di sisi klien

`/dashboard` memanggil `GET /api/proxy/me` sebelum menampilkan apa pun.
Kalau tidak ada sesi yang sah, pengguna langsung diarahkan ke halaman masuk.
Tombol **Keluar** memanggil `POST /api/proxy/logout` sehingga cookie benar-benar
dicabut di server.

---

## Isi halaman dashboard

| Menu | Isi |
|---|---|
| **Dashboard** | Grafik produksi (harian/mingguan/bulanan), rekap per hari, ekspor cetak |
| **Input** | Mencatat cetakan & masak per pelanggan, dikirim ke `POST /api/produksi/input` |
| **AI** | Estimasi jumlah cetakan untuk pekan depan |
| **Pengaturan** | Nama penanggung jawab, ganti kata sandi, harga per cetak |

---

## Endpoint API

Ringkasan endpoint ada di **`DOKUMENTASI_API_PRODUKSI_DAN_PENGATURAN.md`**.
Dokumentasi interaktif yang otomatis dibangun dari anotasi di kode tersedia di
<http://localhost:3000/api-doc>.

Semua endpoint produksi memerlukan dua hal sekaligus: cookie sesi yang sah
**dan** kunci API internal.

---

## Catatan penting untuk siapa saja yang lanjut mengerjakan

1. **Jangan pakai varian `dark:` dari Tailwind di proyek ini.** Tidak ada
   `@custom-variant` dan tidak ada kelas `.dark` di elemen `<html>`, sehingga
   `dark:` akan mengikuti preferensi sistem operasi, bukan tombol mode gelap
   di aplikasi. Gunakan `skin(dark)` dari `_components/dashboard/theme.ts`.

2. **`app/(backend)/api/` dan `lib/` sedang tidak boleh diubah.** Semua
   perbaikan yang masih tertunda di sana sudah ditulis satu per satu, lengkap
   dengan kode pengganti dan nomor baris, di
   **`PANDUAN_PERBAIKAN_BACKEND.md`**. Baca file itu sebelum menyentuh
   backend.

3. **Jangan pernah mengubah `supabase_schema.sql`.** Isinya sudah usang — hanya memuat dua tabel, salah satunya (`produksi`) tidak pernah dipakai kode. Gunakan `supabase_migration.sql`.
   hanya memuat dua tabel, salah satunya (`produksi`) tidak pernah dipakai kode.
   Gunakan `supabase_migration.sql`.

4. **Angka di layar harus berasal dari API.** Kalau belum ada data, tampilkan
   keadaan kosong yang jujur beserta alasannya — jangan menampilkan angka contoh
   seolah-olah itu hasil pencatatan. Backend mengirim penanda `is_mock_data`
   ketika isinya masih data contoh, dan penanda itu sudah ditampilkan sebagai
   peringatan di layar.

---

## Lisensi

Proyek capstone untuk keperluan akademik.
