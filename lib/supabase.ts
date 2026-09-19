import { createClient } from '@supabase/supabase-js'

// Mengambil konfigurasi dari file .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Membuat koneksi (client) ke database Supabase Anda
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
