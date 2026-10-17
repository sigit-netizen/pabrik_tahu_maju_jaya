# 📘 Panduan Integrasi API: Menu Produksi & Menu Pengaturan
**Sistem Manajemen Produksi Pabrik Tahu Maju Jaya**  
*Ditujukan untuk: Frontend Developer (TIM SAR 7 GOKIL)*

---

## 🔐 1. Aturan Keamanan & Otentikasi (PENTING)

Semua endpoint di bawah ini berada di area **sesudah login** dan dilindungi oleh sistem keamanan ganda:

1. **Cookie Sesi (`httpOnly`)**:
   - Diberi nama `ptmj_session`.
   - Otomatis diset oleh browser saat login berhasil melalui `/api/auth/login`.
   - **FE Wajib**: Jika menggunakan `fetch` dari browser, sertakan opsi `credentials: 'include'`. Jika menggunakan `axios`, set `withCredentials: true`.
2. **Kunci API Aplikasi (`API_APP_KEY`)**:
   - Jika dites via **Postman / Swagger**, sertakan header:
     ```http
     x-api-key: rahasia-sesudah-login-app999
     ```
   - Jika dipanggil dari komponen Next.js/Browser aplikasi sendiri (same-origin), header ini bersifat otomatis ditoleransi.

---

## 🏭 2. MENU PRODUKSI

Menu Produksi menangani pencatatan pesanan harian pelanggan, perhitungan tagihan per orang secara real-time, penyimpanan rekap harian, dan riwayat transaksi.

### 2.1 Alur Logika Input Produksi di Frontend

```
1. [Halaman Form Dibuka]
      │
      ▼
   FE panggil: GET /api/produksi/hitung
   -> Dapatkan harga aktif hari ini (misal: Rp 2.000 / cetak)

2. [Admin Mengetik Pesanan Pelanggan]
   Admin input: Nama "Bu Sari", Cetak 50, Masak 5
      │
      ▼
   FE panggil live: POST /api/produksi/hitung
   Body: { "jumlah_cetak": 50 }
   -> Respon: { "total": 100000, "total_rupiah": "Rp 100.000" }
   -> Tampilkan di UI: "Tagihan Bu Sari: Rp 100.000"

3. [Admin Menambah Pelanggan Lain (Baris ke-2)]
   Admin input: Nama "Pak Budi", Cetak 30, Masak 3
   -> Tagihan Pak Budi: Rp 60.000

4. [Klik Tombol "Simpan Produksi Hari Ini"]
      │
      ▼
   FE panggil: POST /api/produksi/input
   Kirim semua baris sekaligus.
   -> API otomatis menyimpan detail tiap orang ke tabel `rincian_product_harian`
   -> API otomatis menghitung total agregat dan menyimpan ke tabel `product_harian`
```

---

### 2.2 Endpoint Menu Produksi

#### A. Cek Harga Cetak Aktif
- **URL**: `GET /api/produksi/hitung`
- **Fungsi**: Digunakan saat form dibuka pertama kali untuk menampilkan tarif acuan.
- **Respon Sukses (200)**:
```json
{
  "status": "success",
  "data": {
    "id": 1,
    "harga_per_cetak": 2000,
    "berlaku_sejak": "2026-10-17T07:00:00.000Z"
  }
}
```

---

#### B. Hitung Tagihan Live (Per Baris Pelanggan)
- **URL**: `POST /api/produksi/hitung`
- **Fungsi**: Menghitung nominal rupiah yang harus dibayar seorang pelanggan begitu admin selesai mengetik `jumlah_cetak`.
- **Request Body**:
```json
{
  "jumlah_cetak": 50
}
```
- **Respon Sukses (200)**:
```json
{
  "status": "success",
  "data": {
    "jumlah_cetak": 50,
    "harga_per_cetak": 2000,
    "total": 100000,
    "total_rupiah": "Rp 100.000"
  }
}
```

---

#### C. Simpan Form Produksi Harian (Batch Input)
- **URL**: `POST /api/produksi/input`
- **Fungsi**: Menerima 1 form harian berisi daftar pelanggan. API memecah dan memetakan ke tabel `rincian_product_harian` dan `product_harian`.
- **Request Body**:
```json
{
  "tanggal": "2026-10-17",
  "rincian": [
    {
      "nama": "Bu Sari",
      "jumlah_cetak": 50,
      "jumlah_masak": 5,
      "total": 100000
    },
    {
      "nama": "Pak Budi",
      "jumlah_cetak": 30,
      "jumlah_masak": 3,
      "total": 60000
    }
  ]
}
```
> *Catatan Field:*
> - `tanggal` (opsional): Format `YYYY-MM-DD` (contoh: `"2026-10-17"`). Jika tidak dikirim oleh FE, API otomatis menggunakan tanggal hari ini dalam zona waktu **WIB (Asia/Jakarta, UTC+7)**.
> - `total` (opsional): Jika FE sudah menghitung via `/api/produksi/hitung`, kirimkan di sini. Jika tidak dikirim, API akan menghitung sendiri secara otomatis.

- **Respon Sukses (201)**:
```json
{
  "status": "success",
  "message": "Data produksi harian berhasil disimpan! 2 pelanggan dicatat.",
  "data": {
    "header": {
      "id": 1,
      "created_at": "2026-10-17T07:23:08.372Z",
      "jumlah_cetak": 80,
      "jumlah_masak": 8,
      "jumlah_pendapatan": 160000
    },
    "rincian": [
      { "id": 10, "nama": "Bu Sari", "jumlah_cetak": 50, "jumlah_masak": 5, "total": 100000 },
      { "id": 11, "nama": "Pak Budi", "jumlah_cetak": 30, "jumlah_masak": 3, "total": 60000 }
    ],
    "ringkasan": {
      "total_pelanggan": 2,
      "total_cetak": 80,
      "total_masak": 8,
      "total_pendapatan_rp": 160000,
      "harga_digunakan": 2000,
      "sumber_total": "dari_fe"
    }
  }
}
```

---

#### D. Ambil Riwayat Rekap Harian
- **URL**: `GET /api/produksi?page=1&limit=10&start_date=2026-10-01&end_date=2026-10-17`
- **Fungsi**: Menampilkan tabel riwayat produksi harian dengan paginasi dan filter tanggal.
- **Respon Sukses (200)**:
```json
{
  "status": "success",
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "total_pages": 3
  },
  "data": [
    {
      "id": 1,
      "tanggal": "2026-10-17",
      "created_at": "2026-10-17T07:23:08.372Z",
      "jumlah_cetak": 80,
      "jumlah_masak": 8,
      "jumlah_pendapatan": 160000,
      "jumlah_pendapatan_rupiah": "Rp 160.000"
    }
  ]
}
```

---

#### E. Detail 1 Hari Produksi (+ Daftar Tagihan Pelanggan)
- **URL**: `GET /api/produksi/{id}`
- **Fungsi**: Saat baris riwayat di-klik, modal/halaman detail menampilkan rekap harian dan **siapa saja yang memesan serta berapa yang harus dibayar masing-masing orang**.
- **Respon Sukses (200)**:
```json
{
  "status": "success",
  "data": {
    "rekap_harian": {
      "id": 1,
      "tanggal": "2026-10-17",
      "total_cetak": 80,
      "total_masak": 8,
      "total_pendapatan": 160000,
      "total_pendapatan_rupiah": "Rp 160.000"
    },
    "ringkasan_pelanggan": {
      "jumlah_pelanggan": 2,
      "pelanggan": [
        {
          "id": 10,
          "nama": "Bu Sari",
          "jumlah_cetak": 50,
          "jumlah_masak": 5,
          "total_bayar": 100000,
          "total_bayar_rupiah": "Rp 100.000",
          "waktu_pesan": "2026-10-17T07:23:07.944Z"
        },
        {
          "id": 11,
          "nama": "Pak Budi",
          "jumlah_cetak": 30,
          "jumlah_masak": 3,
          "total_bayar": 60000,
          "total_bayar_rupiah": "Rp 60.000",
          "waktu_pesan": "2026-10-17T07:23:07.944Z"
        }
      ]
    }
  }
}
```

---

#### F. Edit / Hapus Rekap Harian
- **Edit Rekap**: `PUT /api/produksi/{id}`
  - Body: `{ "jumlah_cetak": 85, "jumlah_masak": 8, "jumlah_pendapatan": 170000 }`
- **Hapus Rekap**: `DELETE /api/produksi/{id}`

---

#### G. Edit / Hapus Rincian Pesanan Pelanggan Tertentu
- **Edit Pesanan Pelanggan**: `PUT /api/produksi/rincian/{id}`
  - Body: `{ "nama": "Bu Sari (Revisi)", "jumlah_cetak": 55, "total": 110000 }`
- **Hapus Pesanan Pelanggan**: `DELETE /api/produksi/rincian/{id}`

---

## ⚙️ 3. MENU PENGATURAN

Menu Pengaturan mencakup 3 sub-modul utama:
1. **Kelola Harga Cetak** (`harga_cetak`)
2. **Kelola Profil Pribadi & Password**
3. **Kelola Akun Admin / Staf Pabrik** (`admin` CRUD)

---

### 3.1 Sub-Modul: Kelola Harga Cetak

Admin dapat melihat tarif yang berlaku, menaikkan/menurunkan tarif, mengoreksi, atau menghapus riwayat tarif.

#### A. Ambil Tarif Aktif & Riwayat Tarif
- **URL**: `GET /api/pengaturan/harga`
- **Respon Sukses (200)**:
```json
{
  "status": "success",
  "data": {
    "harga_aktif": {
      "id": 2,
      "harga": 2500,
      "harga_rupiah": "Rp 2.500",
      "dibuat_pada": "2026-10-17T07:30:00.000Z"
    },
    "total_riwayat": 2,
    "riwayat_harga": [
      { "id": 2, "harga": 2500, "harga_rupiah": "Rp 2.500", "dibuat_pada": "2026-10-17T07:30:00.000Z" },
      { "id": 1, "harga": 2000, "harga_rupiah": "Rp 2.000", "dibuat_pada": "2026-10-01T07:00:00.000Z" }
    ]
  }
}
```

#### B. Tetapkan Harga Cetak Baru
- **URL**: `POST /api/pengaturan/harga`
- **Request Body**:
```json
{
  "harga": 2500
}
```
- **Respon Sukses (201)**:
```json
{
  "status": "success",
  "message": "Harga cetak berhasil diperbarui menjadi Rp 2.500 per cetakan!",
  "data": {
    "id": 3,
    "harga": 2500,
    "harga_rupiah": "Rp 2.500",
    "berlaku_sejak": "2026-10-17T07:45:00.000Z"
  }
}
```

#### C. Koreksi atau Hapus Baris Harga
- **Koreksi**: `PUT /api/pengaturan/harga/{id}`
  - Body: `{ "harga": 2400 }`
- **Hapus**: `DELETE /api/pengaturan/harga/{id}`

---

### 3.2 Sub-Modul: Profil Pribadi & Password

#### A. Ambil Profil Admin yang Sedang Login
- **URL**: `GET /api/pengaturan/profile`
- **Respon Sukses (200)**:
```json
{
  "status": "success",
  "data": {
    "id": 2,
    "username": "sigitnetizen",
    "email": "sigit@example.com",
    "status": 1,
    "created_at": "2026-09-20T08:56:26.813Z"
  }
}
```

#### B. Update Profil Pribadi
- **URL**: `PUT /api/pengaturan/profile`
- **Request Body**:
```json
{
  "username": "sigit_admin",
  "email": "sigit_baru@pabriktahu.com"
}
```

#### C. Ganti Password Pribadi
- **URL**: `PUT /api/pengaturan/password`
- **Request Body**:
```json
{
  "password_lama": "rahasia123",
  "password_baru": "baruPass999"
}
```
- **Respon Sukses (200)**:
```json
{
  "status": "success",
  "message": "Password admin berhasil diubah! Silakan gunakan password baru untuk login berikutnya."
}
```

---

### 3.3 Sub-Modul: CRUD Akun Admin

Digunakan untuk menambah staf baru, melihat siapa saja yang memiliki akses sistem, mengubah status staf (aktif/nonaktif), atau menghapus akun staf.

#### A. Daftar Semua Admin
- **URL**: `GET /api/pengaturan/admin`
- **Respon Sukses (200)**:
```json
{
  "status": "success",
  "total": 2,
  "data": [
    {
      "id": 2,
      "username": "sigitnetizen",
      "email": "sigit@example.com",
      "status": 1,
      "status_label": "Aktif",
      "created_at": "2026-09-20T08:56:26.813Z"
    },
    {
      "id": 3,
      "username": "budi_mandor",
      "email": "budi@pabriktahu.com",
      "status": 1,
      "status_label": "Aktif",
      "created_at": "2026-10-17T07:10:00.000Z"
    }
  ]
}
```

#### B. Tambah Admin Baru
- **URL**: `POST /api/pengaturan/admin`
- **Request Body**:
```json
{
  "username": "staf_baru",
  "email": "staf@pabriktahu.com",
  "password": "stafPassword123",
  "status": 1
}
```
> *Password otomatis di-hash menggunakan algoritma bcrypt (salt rounds 10).*

#### C. Detail Satu Akun Admin
- **URL**: `GET /api/pengaturan/admin/{id}`

#### D. Edit Data Admin / Ubah Status / Reset Password
- **URL**: `PUT /api/pengaturan/admin/{id}`
- **Request Body**:
```json
{
  "username": "staf_revisi",
  "email": "staf_revisi@pabriktahu.com",
  "status": 0,
  "password_baru": "resetPass456"
}
```

#### E. Hapus Akun Admin
- **URL**: `DELETE /api/pengaturan/admin/{id}`
> **Keamanan Tambahan**: Sistem otomatis menolak jika admin mencoba menghapus akunnya sendiri yang sedang aktif login.

---

## 💡 4. Contoh Kode Pemanggilan di Frontend (Fetch API)

```javascript
// Contoh: Mengirim Form Produksi dari FE
async function submitProduksi(daftarPelanggan) {
  try {
    const response = await fetch('/api/produksi/input', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // WAJIB untuk menyertakan cookie httpOnly
      body: JSON.stringify({
        rincian: daftarPelanggan, // Array: [{ nama, jumlah_cetak, jumlah_masak, total }]
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      alert(`Gagal: ${result.message}`);
      return;
    }

    alert('Berhasil! ' + result.message);
    console.log('Data tersimpan:', result.data);
  } catch (err) {
    console.error('Error koneksi:', err);
  }
}
```

---

## 📖 5. Dokumentasi Interaktif (Swagger UI)

Frontend Developer juga dapat menguji coba langsung seluruh endpoint di atas melalui antarmuka Swagger pada browser:
👉 **URL**: `http://localhost:3000/api-doc`

---

## 📋 6. CATATAN AUDIT: Standar Tanggal, Waktu WIB, & Jejak Audit (Audit Trail)

### 6.1 Mengapa Menggunakan Kolom `created_at` (timestamptz)?
Di database Supabase/PostgreSQL, tabel `product_harian` dan `rincian_product_harian` tidak menggunakan kolom teks biasa bernama `tanggal`, melainkan kolom standar industri **`created_at`** bertipe **`timestamptz`** *(timestamp with time zone)*. Kolom ini menyimpan informasi tanggal kalender sekaligus jam presisi hingga milidetik.

### 6.2 Mitigasi Zona Waktu (UTC vs WIB / UTC+7)
Server database Supabase berjalan dalam zona waktu standar **UTC (GMT+0)**. Wilayah operasional pabrik (Kediri, Jawa Timur) berada di zona **WIB (UTC+7)** dengan selisih **+7 jam**.
- **Bahaya jika tidak dimitigasi**: Jika data diinput pada pukul 02:00 dini hari WIB tanggal 17 Oktober, server UTC masih berada di pukul 19:00 tanggal 16 Oktober (hari kemarin), sehingga tanggal bisa bergeser mundur.
- **Solusi yang diterapkan API**:
  1. Input `POST /api/produksi/input` menerima field opsional `tanggal` (format `YYYY-MM-DD`).
  2. API mengikat input tanggal tersebut dengan offset resmi `+07:00` (WIB) melalui [`lib/date-helper.ts`](file:///d:/semester7/capstone/my-app/lib/date-helper.ts).
  3. Saat query filter atau GET, API selalu mengonversi timestamp UTC kembali ke kalender resmi Indonesia (`Asia/Jakarta`).

### 6.3 Metadata Audit Trail pada Respon API
Setiap request penyimpanan atau pengambilan data produksi kini menyertakan objek **`audit`** untuk transparansi dan akuntabilitas:

```json
{
  "audit": {
    "tanggal_wib": "2026-10-17",
    "waktu_input_wib": "17 Okt 2026, 14:35 WIB",
    "zona_waktu": "Asia/Jakarta (WIB - UTC+7)",
    "diinput_oleh": "sigitnetizen",
    "id_admin": 2
  }
}
```

**Rekomendasi Tampilan UI di Frontend**:
Frontend dapat menggunakan data `audit` ini untuk menampilkan jejak audit di bawah tabel atau di dalam modal detail:
> *"Data dicatat oleh **sigitnetizen** pada **17 Okt 2026, 14:35 WIB**"*

