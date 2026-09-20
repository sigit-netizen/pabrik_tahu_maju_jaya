import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * @swagger
 * /api/konek_db:
 *   get:
 *     summary: Mengecek koneksi ke database Supabase
 *     description: Endpoint ini melakukan query ringan ke Supabase untuk memastikan URL dan Key valid.
 *     responses:
 *       200:
 *         description: Berhasil terhubung ke Supabase
 *       400:
 *         description: Gagal terhubung atau kredensial salah
 */
export async function GET() {
  try {
    // Karena Supabase berbasis API (bukan koneksi konvensional seperti MySQL),
    // kita tidak memiliki fungsi "ping". Sebagai gantinya, kita coba melakukan
    // request sederhana untuk mengecek apakah API URL dan Key Anda sudah benar.
    
    // Di sini kita mencoba mengambil data dari tabel (yang mungkin belum ada),
    // hanya untuk memancing respons (berhasil / error) dari Supabase.
    const { data, error } = await supabase.from('test_koneksi').select('*').limit(1);

    // Jika errornya karena tabel tidak ada, BERARTI KONEKSI SEBENARNYA BERHASIL!
    // Itu artinya Supabase menerima URL & Key Anda, dan merespons bahwa tabelnya saja yang tidak ada.
    if (error) {
      // Kode 42P01 di PostgreSQL atau pesan "Could not find the table" 
      // berarti koneksi berhasil namun tabel belum dibuat.
      if (error.code === '42P01' || error.message.includes('Could not find the table')) {
         return NextResponse.json({ 
           status: 'success', 
           message: 'Mantap! BERHASIL terhubung ke Supabase! (Tabel "test_koneksi" belum ada, tapi koneksinya sudah 100% tembus)',
         });
      }

      return NextResponse.json({ 
        status: 'error', 
        message: 'Gagal! Cek apakah URL dan Key di .env.local sudah benar.',
        details: error.message 
      }, { status: 400 });
    }

    // Jika tidak ada error sama sekali
    return NextResponse.json({ 
      status: 'success', 
      message: 'Berhasil terhubung ke Supabase dan mengambil data!',
      data: data
    });

  } catch (err) {
    return NextResponse.json({ 
      status: 'error', 
      message: 'Terjadi kesalahan sistem',
      details: String(err)
    }, { status: 500 });
  }
}
