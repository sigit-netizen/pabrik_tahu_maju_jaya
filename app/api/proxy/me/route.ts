import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';

/**
 * @swagger
 * /api/proxy/me:
 *   get:
 *     summary: Mengecek identitas pengguna yang sedang login berdasarkan cookie httpOnly (Proxy Endpoint)
 *     tags:
 *       - Proxy Auth
 *     responses:
 *       200:
 *         description: Pengguna terautentikasi
 *       401:
 *         description: Belum login atau sesi telah kadaluarsa
 */
export async function GET(request: Request) {
  const sessionUser = getSessionFromRequest(request);

  if (!sessionUser) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Unauthorized: Sesi tidak ditemukan atau telah kadaluarsa. Silakan login kembali.',
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    status: 'success',
    data: sessionUser,
  });
}
