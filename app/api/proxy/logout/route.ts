import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/session';

/**
 * @swagger
 * /api/proxy/logout:
 *   post:
 *     summary: Logout dan menghapus cookie sesi httpOnly (Proxy Endpoint)
 *     tags:
 *       - Proxy Auth
 *     responses:
 *       200:
 *         description: Berhasil logout
 */
export async function POST() {
  const response = NextResponse.json({
    status: 'success',
    message: 'Logout berhasil. Sesi Anda telah diakhiri dengan aman.',
  });

  // Hapus cookie sesi httpOnly
  clearSessionCookie(response);
  return response;
}
