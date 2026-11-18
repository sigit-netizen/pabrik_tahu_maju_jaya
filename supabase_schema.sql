-- ==============================================================================
-- SKEMA DATABASE SUPABASE: SISTEM MANAJEMEN PRODUKSI PABRIK TAHU MAJU JAYA
-- Dibuat untuk Capstone Project - Teknik Informatika UNP Kediri
-- Jalankan query ini di Supabase > SQL Editor
-- ==============================================================================

-- 1. TABEL: produksi (Menu Input & Riwayat Produksi Harian)
CREATE TABLE IF NOT EXISTS public.produksi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tanggal DATE NOT NULL UNIQUE,          -- 1 hari hanya 1 catatan produksi
    jumlah_masak INTEGER NOT NULL DEFAULT 0, -- Jumlah kali masak tahu dalam sehari
    jumlah_cetak INTEGER NOT NULL DEFAULT 0, -- Jumlah cetakan/papan tahu yang dihasilkan
    catatan TEXT,                           -- Catatan operasional
    id_admin BIGINT REFERENCES public.admin(id) ON DELETE SET NULL, -- Siapa yang mencatat
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pencarian berdasarkan tanggal & rentang waktu
CREATE INDEX IF NOT EXISTS idx_produksi_tanggal ON public.produksi(tanggal DESC);

-- 2. TABEL: prediksi (Menu AI - Hasil Peramalan Random Forest Mingguan)
CREATE TABLE IF NOT EXISTS public.prediksi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tanggal_prediksi DATE NOT NULL DEFAULT CURRENT_DATE, -- Kapan prediksi dijalankan
    periode_mulai DATE NOT NULL,                         -- Awal minggu prediksi
    periode_selesai DATE NOT NULL,                       -- Akhir minggu prediksi
    total_cetak_prediksi INTEGER NOT NULL,               -- Akumulasi prediksi 1 minggu
    detail_harian JSONB,                                 -- Rincian prediksi per hari [{hari: 'Senin', tanggal: '...', estimasi_cetak: 110}]
    mae NUMERIC(8, 2),                                   -- Evaluasi Mean Absolute Error
    mape NUMERIC(6, 2),                                  -- Evaluasi Mean Absolute Percentage Error (%)
    model_version TEXT DEFAULT 'RandomForest-v1',        -- Versi model ML
    catatan_model TEXT,                                  -- Ringkasan insight model
    id_admin BIGINT REFERENCES public.admin(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pencarian prediksi periode
CREATE INDEX IF NOT EXISTS idx_prediksi_periode ON public.prediksi(periode_mulai DESC);
