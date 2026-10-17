import { NextResponse } from 'next/server';
import { getSessionFromRequest, SessionUser } from './session';

/**
 * LAPIS 1: Verifikasi Kunci Rahasia Internal SESUDAH LOGIN (API_APP_KEY)
 * Menolak request luar yang mencoba membajak/mengakses backend langsung.
 * Kunci ini berbeda dengan kunci sebelum login (API_AUTH_KEY).
 */
export function verifyApiKey(request: Request): NextResponse | null {
  const apiKey = request.headers.get('x-api-key');
  const secretKey = process.env.API_APP_KEY || 'rahasia-sesudah-login-app999';

  // Kunci rahasia sesudah login cocok
  if (apiKey && apiKey === secretKey) {
    return null;
  }

  // Request berasal dari frontend internal kita sendiri
  const secFetchSite = request.headers.get('sec-fetch-site');
  if (secFetchSite === 'same-origin') {
    return null;
  }

  // Di mode development untuk mempermudah testing tim
  if (process.env.NODE_ENV === 'development') {
    return null;
  }

  return NextResponse.json(
    {
      status: 'error',
      message: 'Akses Ditolak: API Key sesudah login (API_APP_KEY) tidak valid atau tidak ditemukan!',
    },
    { status: 401 }
  );
}

/**
 * LAPIS 2: Verifikasi Sesi Pengguna Login (Cookie httpOnly)
 * Memastikan pengguna benar-benar sudah login dan cookie tidak dipalsukan.
 */
export function verifySession(request: Request): {
  error: NextResponse | null;
  user: SessionUser | null;
} {
  const sessionUser = getSessionFromRequest(request);

  if (!sessionUser) {
    // Toleransi mode development / testing Postman dengan API Key sesudah login langsung
    const apiKey = request.headers.get('x-api-key');
    const secretKey = process.env.API_APP_KEY || 'rahasia-sesudah-login-app999';

    if (process.env.NODE_ENV === 'development' && apiKey === secretKey) {
      // Mock session untuk mempermudah Sigit saat menguji via Postman / Swagger
      return {
        error: null,
        user: { id: 2, username: 'sigit_dev', email: 'sigit@example.com', status: 1 },
      };
    }

    return {
      error: NextResponse.json(
        {
          status: 'error',
          message: 'Akses Ditolak: Anda belum login atau sesi telah berakhir. Silakan login terlebih dahulu.',
        },
        { status: 401 }
      ),
      user: null,
    };
  }

  return { error: null, user: sessionUser };
}

/**
 * KEAMANAN GANDA (DUAL-LAYER PROTECTION):
 * 1. Harus melewati validasi API Key internal (atau origin internal).
 * 2. DAN harus memiliki Cookie httpOnly yang sah dari proses Login.
 * Meskipun hacker login, kalau tidak punya key/melewati web kita -> DITOLAK.
 * Meskipun hacker punya key, kalau belum login -> DITOLAK.
 */
export function verifyDualAuth(request: Request): {
  error: NextResponse | null;
  user: SessionUser | null;
} {
  // Cek Lapis 1: Key
  const keyError = verifyApiKey(request);
  if (keyError) {
    return { error: keyError, user: null };
  }

  // Cek Lapis 2: Session httpOnly
  const sessionResult = verifySession(request);
  if (sessionResult.error) {
    return sessionResult;
  }

  return { error: null, user: sessionResult.user };
}
