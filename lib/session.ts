import crypto from 'crypto';
import { NextResponse } from 'next/server';

export interface SessionUser {
  id: number;
  username: string;
  email: string;
  status: number;
}

interface TokenPayload extends SessionUser {
  exp: number; // Expiration timestamp
}

const COOKIE_NAME = 'ptmj_session';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function getSecret(): string {
  return process.env.API_APP_KEY || 'rahasia-sesudah-login-app999';
}

/**
 * Membuat Token Sesi Terenkripsi & Bertanda Tangan (HMAC-SHA256)
 */
export function createSessionToken(user: SessionUser): string {
  const payload: TokenPayload = {
    ...user,
    exp: Date.now() + ONE_DAY_MS,
  };

  const dataStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSecret())
    .update(dataStr)
    .digest('base64url');

  return `${dataStr}.${signature}`;
}

/**
 * Memverifikasi Token Sesi. Mengembalikan data user jika valid, null jika palsu/kadaluarsa.
 */
export function verifySessionToken(token: string): SessionUser | null {
  try {
    const [dataStr, signature] = token.split('.');
    if (!dataStr || !signature) return null;

    const expectedSignature = crypto
      .createHmac('sha256', getSecret())
      .update(dataStr)
      .digest('base64url');

    // Hindari Timing Attack menggunakan timingSafeEqual
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (sigBuffer.length !== expectedBuffer.length) return null;
    if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;

    const payload: TokenPayload = JSON.parse(
      Buffer.from(dataStr, 'base64url').toString('utf-8')
    );

    // Cek kadaluarsa
    if (Date.now() > payload.exp) return null;

    return {
      id: payload.id,
      username: payload.username,
      email: payload.email,
      status: payload.status,
    };
  } catch {
    return null;
  }
}

/**
 * Memasang Cookie httpOnly pada NextResponse
 * Keamanan:
 * - httpOnly: true (JavaScript / XSS TIDAK BISA membaca cookie ini)
 * - secure: true di production (hanya lewat HTTPS)
 * - sameSite: 'lax' (mencegah CSRF dari web lain)
 */
export function setSessionCookie(response: NextResponse, user: SessionUser): void {
  const token = createSessionToken(user);
  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60, // 24 jam
  });
}

/**
 * Menghapus Cookie Sesi (Untuk Logout)
 */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

/**
 * Membaca & Memvalidasi Sesi User dari Request Masuk
 */
export function getSessionFromRequest(request: Request): SessionUser | null {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));

  if (!match) return null;
  const token = match.substring(`${COOKIE_NAME}=`.length);
  return verifySessionToken(token);
}
