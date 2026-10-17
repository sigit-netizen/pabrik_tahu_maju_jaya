-- =============================================================================
-- MIGRASI SUPABASE — Pabrik Tahu Maju Jaya
-- Dibuat: 17 Oktober 2026
--
-- CARA PAKAI:
--   1. Buka Supabase Dashboard > SQL Editor > New query
--   2. Tempel seluruh isi file ini
--   3. Klik Run. Script ini idempotent (aman dijalankan berkali-kali).
--
-- STATUS SAAT INI (diverifikasi 17 Okt 2026 lewat PostgREST):
--   admin                    -> ADA, 6 kolom lengkap
--   harga_cetak              -> ADA, 3 kolom lengkap
--   product_harian           -> ADA, 5 kolom lengkap
--   rincian_product_harian   -> ADA, 6 kolom lengkap
--   prediksi                 -> BELUM ADA  <-- dibuat oleh migrasi ini
--   test_koneksi             -> BELUM ADA  <-- dibuat oleh migrasi ini
--
-- CATATAN: file `supabase_schema.sql` di repo sudah.usang (hanya berisi
-- `produksi` + `prediksi`, sedangkan `produksi` tidak pernah dipakai kode).
-- Gunakan file migrasi ini sebagai acuan yang benar.
-- =============================================================================


-- =============================================================================
-- BAGIAN 1 — TABEL YANG DIPERLUKAN KODE
-- Kolom disalin persis dariSELECT yang dipakai route backend, supaya tidak
-- ada nama kolom yang meleset.
-- =============================================================================

-- 1.1 prediksi — dipakai app/(backend)/api/ai/prediksi/route.ts
CREATE TABLE IF NOT EXISTS public.prediksi (
    id                    BIGSERIAL PRIMARY KEY,
    tanggal_prediksi      DATE        NOT NULL DEFAULT CURRENT_DATE,
    periode_mulai         DATE        NOT NULL,
    periode_selesai       DATE        NOT NULL,
    total_cetak_prediksi  INTEGER     NOT NULL DEFAULT 0,
    detail_harian         JSONB,
    mae                   NUMERIC(8, 2),
    mape                  NUMERIC(6, 2),
    model_version         TEXT        NOT NULL DEFAULT 'RandomForestRegressor-v1',
    catatan_model         TEXT,
    id_admin              BIGINT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT prediksi_periode_uniq UNIQUE (periode_mulai, periode_selesai)
);

CREATE INDEX IF NOT EXISTS idx_prediksi_periode ON public.prediksi (periode_mulai DESC);

COMMENT ON TABLE public.prediksi IS
    'Hasil peramalan jumlah cetakan mingguan. Diisi lewat POST /api/ai/prediksi.';


-- 1.2 test_koneksi — hanya dipakai app/(backend)/api/konek_db/route.ts
-- sebagai probe. Isinya tidak pernah dipakai logika bisnis.
CREATE TABLE IF NOT EXISTS public.test_koneksi (
    id         BIGSERIAL PRIMARY KEY,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    note       TEXT
);


-- =============================================================================
-- BAGIAN 2 — KOLOM TAMBAHAN YANG BISA-JADI DIBUTUHKAN
-- =============================================================================
-- Menambahkan kolom id_admin ke rekap produksi supaya ada jejak siapa yang
-- mencatat. Route backend sudah mengirim field `audit.id_admin`, tapi
-- `product_harian` belum punya kolom untuk menyimpannya, jadi jejaknya hilang.
--
-- JANGAN jalankan bagian ini kalau Anda tidak ingin menambah kolom: route
-- produksi tidak bergantung padanya, ini murni untuk jejak audit.

-- ALTER TABLE public.product_harian      ADD COLUMN IF NOT EXISTS id_admin BIGINT;
-- ALTER TABLE public.rincian_product_harian ADD COLUMN IF NOT EXISTS id_admin BIGINT;


-- =============================================================================
-- BAGIAN 3 — KEAMANAN (JANGAN DIJALANKAN DULU, BACA DULU)
-- =============================================================================
--
-- MASALAH: tabel2 di atas sekarang punya RLS NONAKTIF, dan aplikasi
-- memakai SUPABASE_ANON_KEY (kunci publik) untuk semua query. Akibatnya
-- siapa pun yang punya anon key itu — dan anon key ini ikut ada di repo
-- sebagai nilai .env — bisa membaca tabel `admin` INCLUDING kolom `password`
-- (hash bcrypt) lewat /rest/v1/admin?select=password.
--
-- SOLUSI YANG BENAR (2 langkah, harus berurutan):
--
--   LANGKAH A — pindahkan server ke service_role key:
--     1. Tambah SUPABASE_SERVICE_ROLE_KEY=<service_role key> di .env
--        (ambil dari Supabase Dashboard > Project Settings > API Keys.
--         JANGAN pernah commit, JANGAN pernah pakai prefix NEXT_PUBLIC_.)
--     2. Ubah lib/supabase.ts agar memakai key itu.
--        (INI PERUBAHAN BACKEND — belum dikerjakan.)
--
--   LANGKAH B — baru setelah langkah A beres, nyalakan RLS:
--
--     ALTER TABLE public.admin                   ENABLE ROW LEVEL SECURITY;
--     ALTER TABLE public.harga_cetak             ENABLE ROW LEVEL SECURITY;
--     ALTER TABLE public.product_harian          ENABLE ROW LEVEL SECURITY;
--     ALTER TABLE public.rincian_product_harian  ENABLE ROW LEVEL SECURITY;
--     ALTER TABLE public.prediksi                ENABLE ROW LEVEL SECURITY;
--
--     -- service_role otomatis melewati RLS, jadi tidak perlu policy apa pun.
--     -- Kalau langkah A belum dilakukan, JANGAKAN nyalakan RLS:
--     -- seluruh query aplikasi akan langsung gagal.
--
-- VERIFIKASI SETELAH LANGKAH B:
--     curl -s "<SUPABASE_URL>/rest/v1/admin?select=password" \
--          -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
--     Harusnya: error permission denied, BUKAN data admin.
--
-- Jangan hanya `DISABLE ROW LEVEL SECURITY` seperti saran yang muncul di
-- pesan error 403 route harga — itu justru memperburuk: aplikasi memakai
-- anon key, jadi mematikan RLS berarti tabel bisa ditulis dari mana saja.


-- =============================================================================
-- BAGIAN 4 — DATA AWAL MINIMAL (opsional)
-- =============================================================================
-- Tanpa harga aktif, route `/api/produksi/input` membalas 404 dan pencatatan
-- tidak bisa dihitung. Set satu harga dasar dulu:

-- INSERT INTO public.harga_cetak (harga, created_at)
-- VALUES (2000, NOW())
-- ON CONFLICT DO NOTHING;
