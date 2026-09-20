import { createClient } from '@supabase/supabase-js'

// Mengambil konfigurasi dari file .env.local (Tanpa NEXT_PUBLIC_ agar tidak bocor ke browser)
const supabaseUrl = process.env.SUPABASE_URL!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!

// Membuat koneksi (client) ke database Supabase Anda
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
