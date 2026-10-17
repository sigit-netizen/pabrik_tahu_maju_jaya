/**
 * Helper Zona Waktu Indonesia Barat (WIB - UTC+7)
 * Memastikan tanggal dan jam konsisten sesuai waktu operasional pabrik di Kediri / Jawa Timur,
 * meskipun server database Supabase berjalan dalam zona waktu UTC.
 */

const TIMEZONE_WIB = 'Asia/Jakarta';

/**
 * Mendapatkan string tanggal hari ini dalam format YYYY-MM-DD (WIB)
 * Contoh: "2026-10-17"
 */
export function getWibTodayDate(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: TIMEZONE_WIB,
  }).format(new Date());
}

/**
 * Mendapatkan string jam saat ini dalam format HH:mm:ss (WIB)
 * Contoh: "14:35:20"
 */
export function getWibCurrentTime(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE_WIB,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const hour = parts.find((p) => p.type === 'hour')?.value || '12';
  const minute = parts.find((p) => p.type === 'minute')?.value || '00';
  const second = parts.find((p) => p.type === 'second')?.value || '00';

  return `${hour}:${minute}:${second}`;
}

/**
 * Mengubah input tanggal dari FE (YYYY-MM-DD) atau waktu sekarang menjadi ISO string dengan offset +07:00 (WIB)
 * Contoh input: "2026-10-17" -> Output: "2026-10-17T14:35:20+07:00"
 */
export function toWibTimestamp(inputDate?: string): string {
  const time = getWibCurrentTime();
  if (inputDate && /^\d{4}-\d{2}-\d{2}$/.test(inputDate.trim())) {
    return `${inputDate.trim()}T${time}+07:00`;
  }
  const today = getWibTodayDate();
  return `${today}T${time}+07:00`;
}

/**
 * Mengubah timestamp UTC dari database menjadi string tanggal YYYY-MM-DD sesuai zona WIB
 * Mencegah kesalahan tanggal bergeser ke hari kemarin karena perbedaan UTC vs WIB (+7 jam).
 */
export function formatToWibDate(utcTimestamp: string | null | undefined): string {
  if (!utcTimestamp) return getWibTodayDate();
  try {
    const d = new Date(utcTimestamp);
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: TIMEZONE_WIB,
    }).format(d);
  } catch {
    return String(utcTimestamp).split('T')[0] || getWibTodayDate();
  }
}

/**
 * Mengubah timestamp UTC menjadi format teks ramah pengguna (contoh: "17 Okt 2026, 14:35 WIB")
 */
export function formatToWibDisplay(utcTimestamp: string | null | undefined): string {
  if (!utcTimestamp) return '-';
  try {
    const d = new Date(utcTimestamp);
    const datePart = new Intl.DateTimeFormat('id-ID', {
      timeZone: TIMEZONE_WIB,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);

    const timePart = new Intl.DateTimeFormat('id-ID', {
      timeZone: TIMEZONE_WIB,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d).replace('.', ':');

    return `${datePart}, ${timePart} WIB`;
  } catch {
    return String(utcTimestamp);
  }
}

/**
 * Mendapatkan rentang filter query (start & end) untuk 1 hari penuh dalam WIB
 * Untuk digunakan pada filter .gte('created_at', start) dan .lte('created_at', end)
 */
export function getWibDayRange(dateStr: string): { startWib: string; endWib: string } {
  const cleanDate = dateStr.trim();
  return {
    startWib: `${cleanDate}T00:00:00+07:00`,
    endWib: `${cleanDate}T23:59:59.999+07:00`,
  };
}
