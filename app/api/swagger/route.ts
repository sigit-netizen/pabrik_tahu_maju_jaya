import { NextResponse } from 'next/server';
import { getApiDocs } from '@/lib/swagger';

export async function GET() {
  // ── KUNCI PRODUCTION: Jika di lingkungan produksi (Vercel), Swagger dikunci 404 ──
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { status: 'error', message: 'Dokumentasi API dinonaktifkan di lingkungan produksi.' },
      { status: 404 }
    );
  }

  const spec = await getApiDocs();
  return NextResponse.json(spec);
}
