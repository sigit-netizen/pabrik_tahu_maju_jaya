type RateLimitInfo = {
  count: number;
  lastReset: number;
};

// In-Memory store untuk menyimpan data IP pengunjung sementara
const rateLimitMap = new Map<string, RateLimitInfo>();

const WINDOW_MS = 60 * 1000; // Jendela waktu: 1 Menit (dalam milidetik)
const MAX_REQUESTS = 3; // Batas maksimal request per 1 menit

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const info = rateLimitMap.get(ip);

  // Jika IP ini belum pernah melakukan request, izinkan dan catat
  if (!info) {
    rateLimitMap.set(ip, { count: 1, lastReset: now });
    return true; // Boleh lewat
  }

  // Jika IP sudah tercatat, tapi request sebelumnya sudah lebih dari 1 menit yang lalu
  // Maka kita RESET hitungannya kembali ke 1.
  if (now - info.lastReset > WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, lastReset: now });
    return true; // Boleh lewat
  }

  // Jika masih di dalam jendela 1 menit, cek apakah sudah melebihi batas?
  if (info.count >= MAX_REQUESTS) {
    return false; // TOLAK (Spam terdeteksi)
  }

  // Jika belum melebihi batas, tambahkan hitungan
  info.count += 1;
  return true; // Boleh lewat
}
