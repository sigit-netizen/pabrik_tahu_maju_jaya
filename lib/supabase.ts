import { createClient } from '@supabase/supabase-js'

// Mengambil konfigurasi dari file .env.local atau Vercel Environment Variables
// Mendukung SUPABASE_URL standar maupun NEXT_PUBLIC_SUPABASE_URL otomatis dari Vercel
const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://zlzdbldfaftflxdkxjmb.supabase.co';

const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_KVZJD149SrcROPDyUn0LYA_mZ2QpG33';

// Membuat koneksi (client) ke database Supabase Anda
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

