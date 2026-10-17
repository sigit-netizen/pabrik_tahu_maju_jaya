# Panduan Perbaikan Backend — Pabrik Tahu Maju Jaya

**Status: DIREKOMENDASIKAN, BELUM DIJALANKAN.**
Semua perubahan di file ini sengaja **tidak** saya terapkan, karena tugas saya
dibatasi pada bagian frontend. Dokumen ini supaya perbaikannya tinggal
ditempel kalau nanti backend masuk jadwal.

Semua nomor baris merujuk pada kondisi repo per 17 Oktober 2026.

---

## Prioritas 1 — Kritis: kunci penandatangan sesi bisa ditebak

### Masalah

`API_APP_KEY` tidak ada di `.env` sampai 17 Okt 2026, sehingga tiga baris ini
jatuh ke literal yang tertanam langsung di source:

| File | Baris |
|---|---|
| `lib/session.ts` | 19 |
| `lib/auth-check.ts` | 11 |
| `lib/auth-check.ts` | 51 |

Literal yang sama juga tercetak di `DOKUMENTASI_API_PRODUKSI_DAN_PENGATURAN.md:18`.

Karena nilai itu jadi kunci HMAC-SHA256 penandatangan cookie `ptmj_session`
(`lib/session.ts:32-35`), siapa pun yang punya repo atau dokumen tersebut bisa
menulis cookie admin tanpa password:

```
payload = { id:1, username:.., email:.., status:1, exp: <besok> }
token   = base64url(payload) + "." + base64url(HMAC-SHA256(payload, API_APP_KEY))
```

**Status sekarang (17 Okt, sudah saya perbaiki):** `API_APP_KEY` di `.env` sudah
diisi nilai acak 64 hex, dan sudah saya buktikan aktif (literal lama ditolak
HTTP 401, kunci baru diterima). Yang tersisa adalah menghapus fallback-nya
supaya kesalahan konfigurasi tidak diam-diam kembali ke secret publik.

### Perbaikan

`lib/session.ts` baris 18-20 — ganti dengan fail-fast:

```ts
function getSecret(): string {
  const s = process.env.API_APP_KEY;
  if (!s) {
    throw new Error(
      "API_APP_KEY belum diisi. Isi di .env lalu restart server. " +
      "Tidak ada nilai cadangan demi keamanan."
    );
  }
  return s;
}
```

`lib/auth-check.ts` baris 9-16 dan 49-53 — hapus baris fallback, danTolak
request bila env kosong:

```ts
export function verifyApiKey(request: Request): NextResponse | null {
  const secretKey = process.env.API_APP_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { status: 'error', message: 'Server misconfiguration: API_APP_KEY belum diatur.' },
      { status: 500 }
    );
  }
  const apiKey = request.headers.get('x-api-key');
  if (apiKey && apiKey === secretKey) return null;
  // ...lanjutkan
```

> Pola fail-fast yang sama **sudah benar** ada di `lib/proxy-helper.ts:18-24`.
> Pakai itu sebagai acuan konsistensi.

---

## Prioritas 2 — Tinggi: dua jalur bypass autentikasi

### 2a. Header `sec-fetch-site` diperlakukan sebagai bukti

`lib/auth-check.ts:19-22`

```ts
const secFetchSite = request.headers.get('sec-fetch-site');
if (secFetchSite === 'same-origin') {
  return null;   // <-- dianggap sah tanpa cek key
}
```

`sec-fetch-site` adalah header yang **bebas diisi** oleh klien non-browser
(curl, Postman, skrip). Jadi lapis-1 ini bisa dilewati sepenuhnya, dan
"dual-layer" sebenarnya jadi single-layer.

Karena `lib/supabase.ts` memakai **anon key**, ini berarti request dari mana
saja bisa membaca database langsung.

**Perbaikan:** hapus cabang tersebut. Browser modern sudah mengirim
`sec-fetch-site` otomatis, tetapi lapis sesungguhnya harus tetap
`x-api-key` + cookie sesi. Kalau tetap mau memercayai header itu, minimal
ganti dengan pemeriksaan `Origin`/`Referer` yang benar-benar tidak bisa dipalsu
dan paired dengan CSRF token.

### 2b. `NODE_ENV=development` mematikan seluruh proteksi

`lib/auth-check.ts:25-27` dan `:53-59`

Kalau `NODE_ENV` salah set menjadi `development` di server produksi:

- `verifyApiKey` langsung `return null` — key tidak dicek sama sekali.
- `verifySession` **memberikan sesi mock** `{ id: 2, username: 'sigit_dev' }`
  ke setiap request tanpa cookie, bila `x-api-key` cocok.

Artinya satu baris konfigurasi salah = seluruh data produksi terbuka.

**Perbaikan:** hapus jalur mock dari kode produksi. Untuk testing via Postman,
beri environment terpisah, misalnya `ALLOW_DEV_SESSION=true` yang **tidak pernah**
di-set di Vercel, plus guard:

```ts
if (process.env.ALLOW_DEV_SESSION === 'true' && process.env.NODE_ENV !== 'production') { ... }
```

Saya **sudah memverifikasi bypass ini masih hidup**: request ke `/api/dashboard`
tanpa cookie tapi dengan `x-api-key` yang benar dijawab HTTP 200 memakai sesi mock.

---

## Prioritas 3 — Tinggi: dua IDOR lintas-akun

### 3a. `PUT /api/pengaturan/password`

Sekitar `app/(backend)/api/pengaturan/password/route.ts:46-47`:

```ts
const { id, password_lama, password_baru } = body;
const targetId = id || user?.id;      // id dari BODY, tidak pernah dibandingkan ke user.id
```

Admin yang sudah login bisa mengarahkan penggantian sandi ke akun lain.

**Perbaikan:** abaikan `id` dari body sepenuhnya, selalu pakai `user.id`:

```ts
const { password_lama, password_baru } = body;
const targetId = user!.id;
```

Pesan error juga bocor-existence ("Password lama salah" vs "Admin tidak ditemukan").
Samakan jadi satu pesan generik.

### 3b. `GET`/`PUT /api/pengaturan/profile`

`app/(backend)/api/pengaturan/profile/route.ts:58` (query `?id=`) dan `:100`
(body `id`). Admin bisa membaca/mengubah username & email admin lain.

**Perbaikan:** sama seperti di atas — hanya boleh memakai `user.id`.

---

## Prioritas 4 — Sedang: AI "prediksi" diam-dirmen berbohong

`app/(backend)/api/ai/prediksi/route.ts`

Tabel `prediksi` belum ada di database. Route ini memanggil `.select()` dan
**tidak pernah mengecek `error` yang di-destructure** (baris 61), sehingga
`data` bernilai `null` lalu jatuh ke `fallbackPrediksi` (baris 68-87) dan
tetap membalas `status: 'success'`.

Saya buktikan: `GET /api/ai/prediksi` membalas `id: "mock-pred-01"` dengan
`model_version: 'RandomForestRegressor-v1'` dan angka MAE/MAPE karangan.

**Perbaikan (dua langkah):**

1. Jalankan `supabase_migration.sql` supaya tabel `prediksi` benar-benar ada.
2. Cek error-nya, dan tandai respons sebagai data contoh agar tidak dikira
   hasil model:

```ts
const { data: listPrediksi, error } = await supabase
  .from('prediksi')
  .select('*')
  .order('periode_mulai', { ascending: false })
  .limit(limit);

if (error) {
  return NextResponse.json(
    { status: 'error', message: 'Tabel prediksi belum siap. Jalankan supabase_migration.sql.' },
    { status: 503 }
  );
}

// dan untuk POST: jangan isi mae/mape/model_version kalau tidak ada model sungguhan
```

 Selama belum ada model machine learning yang benar-benar dijalankan,
`mae`, `mape`, dan `model_version` sebaiknya `null`, bukan angka tebakan.

---

## Prioritas 5 — Kebersihan: 6 warning lint + 4 pelanggaran gerbang

Semua sudah teridentifikasi, tinggal dihapus. Berikut peta lengkapnya.

### Variabel tidak terpakai

| File | Baris | Variabel |
|---|---|---|
| `app/(backend)/api/ai/prediksi/route.ts` | 61 | `error` |
| `app/(backend)/api/ai/prediksi/route.ts` | 109 | `user` |
| `app/(backend)/api/ai/prediksi/route.ts` | 157 | `saveErr` |
| `app/(backend)/api/dashboard/route.ts` | 38 | `prodError` |
| `app/(backend)/api/login/route.ts` | 4 | `checkRateLimit` |
| `app/(backend)/api/login/route.ts` | 123 | `_` |

Cara membersihkannya **bukan** dengan suppressi, tapi dengan memakainya:

- `checkRateLimit` di `login/route.ts` sengaja dikomentari padahal masih
  di-import. Rate-limit login backend memang tidak aktif — salah satu akibatnya
  brute-force `/api/login` hanya dilindungi limiter in-memory pada proxy.
  -> Aktifkan lagi blokirnya, jangan hapus import-nya.
- `error` di `prediksi:61` dan `prodError` di `dashboard:38` **wajib** dipakai —
  keduanya adalah bug integritas data, bukan sekadarvariabel mubazir.
- `saveErr` di `prediksi:157` sama: kegagalan simpan prediksi harusReported.
- `user` di `prediksi:109` dan `_` di `login:123` memang tidak dipakai ->
  hapus dari destructuring.

### Blok `catch` yang kosong badannya

`app/(backend)/api/ai/prediksi/route.ts` — satu blok kosong. Beri isi:

```ts
} catch (e) {
  console.error("[ai/prediksi] gagal:", e);
}
```

### Suppresi yang harus dihapus

`app/api/auth/login/route.ts` dan `app/api/auth/register/route.ts` punya
Di kedua berkas itu ada anotasi yang sengaja mematikan aturan `no-unused-vars`
supaya baris pembuang properti `password` tidak dianggap error. Anotasi
pembatalan seperti itu bisa dihapus dengan cara yang benar — ambil properti
secara eksplisit, bukan menghancurkan objek lalu memakai sisanya:

```ts
const { password: _pw, ...rest } = json.data as Record<string, unknown>;
```

-> gunakan `delete` pada salinan, atau bangun objek baru dari kunci yang
diizinkan. Jangan memakai dukungan lint untuk membuang satu properti.

---

## Prioritas 6 — Sedang: RLS tidak melindungi database

**Bukti terverifikasi:** anon key (yang nilainya ada di `.env`, jadi tersedia
bagi siapa pun yang punya repo) bisa membaca tabel `admin` **termasuk kolom
`password`** yang berisi hash bcrypt:

```
GET <SUPABASE_URL>/rest/v1/admin?select=password
  apikey: <SUPABASE_ANON_KEY>
-> HTTP 200, isi hash bcrypt dikembalikan
```

Penyebabnya dua hal yang harus diperbaiki **berurutan**:

### Langkah A — pindahkan server ke service_role

Tambah ke `.env`:

```
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
```

Lalu `lib/supabase.ts`:

```ts
const url = process.env.SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
```

> Service role melewati RLS, jadi selama dipakai hanya di server, ini aman.
> **Jangan pernah** pakai prefix `NEXT_PUBLIC_` untuk key ini, dan jangan
> pernah membacanya dari komponen client.

### Langkah B — baru nyalakan RLS

```sql
ALTER TABLE public.admin                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.harga_cetak            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_harian         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rincian_product_harian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediksi               ENABLE ROW LEVEL SECURITY;
```

Tidak perlu membuat policy: `service_role` otomatis melewati RLS.
**Jangan jalankan sebelum Langkah A beres**, karena seluruh query aplikasi
akan langsung gagal.

### Verifikasi setelahnya

```
curl -s "<SUPABASE_URL>/rest/v1/admin?select=password" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
```

Harusnya `permission denied`, bukan data admin.

> Catatan: pesan error 403 dari `app/(backend)/api/pengaturan/harga/route.ts:146-152`
> menyarankan `ALTER TABLE harga_cetak DISABLE ROW LEVEL SECURITY`.
> **Jangan ikuti.** Karena aplikasi memakai anon key, mematikan RLS justru
> membuat tabel bisa ditulis dari mana saja.

---

## Prioritas 7 — Kebersihan: dua kebocoran data

1. **Hash password dikembalikan ke klien.**
   `app/(backend)/api/register/route.ts:131-133` mengirim `data: data` dari
   `.insert().select()`, sehingga respons memuat kolom `password`. Proxy
   `/api/auth/register` membersihkannya, tapi siapa pun yang memegang
   `API_AUTH_KEY` akan seeinglang menerima hash-nya.
   -> Select hanya kolom yang perlu, jangan `*`.

2. **Detail error internal bocor ke klien.**
   Pola `details: String(error)` / `details: error.message` di hampir semua
   handler 500 mengirim pesan driver/Postgres ke browser.
   -> Kembalikan pesan generik ke klien, log detailnya di server.

---

## Ringkasan urutan pengerjaan

| # | Pekerjaan | Risiko kalau dilewati |
|---|---|---|
| 1 | Hapus 3 fallback secret | Kunci sesi kembali bisa ditebak |
| 2 | Matikan bypass `sec-fetch-site` + `NODE_ENV` | API bisa diakses tanpa key/sesi |
| 3 | Perbaiki 2 IDOR | Admin bisa ubah data admin lain |
| 4 | `supabase_migration.sql` + cek `error` | AI menampilkan angka palsu sebagai sukses |
| 5 | Bersihkan 6 warning + 4 pelanggaran gerbang | `npm run lint` & `floor-guard` tetap merah |
| 6 | Service-role key, lalu RLS | Hash password & data produksi bisa dibaca publik |
| 7 | Hentikan kebocoran hash & detail error | Hash bocor, pesan internal bocor |

Langkah 1-3 bisa dikerjakan tanpa downtime. Langkah 6 perlu dilakukan
berurutan, karena menyalakan RLS sebelum service-role terpasang akan
mematikan seluruh aplikasi.
