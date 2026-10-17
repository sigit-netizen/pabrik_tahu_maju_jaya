/**
 * Tema bersama untuk seluruh view dashboard.
 *
 * PENTING: jangan pakai varian `dark:` Tailwind di project ini.
 * Tidak ada `@custom-variant` dan tidak ada kelas `.dark` di <html>, jadi `dark:`
 * akan jatuh ke `@media (prefers-color-scheme: dark)` — artinya ikut setelan OS,
 * bukan toggle aplikasi. Selalu pakai `skin(dark)`.
 *
 * Token warna: cream #f6f1e7 · pine #14342b · brand #d97706 (lihat globals.css).
 */
export function skin(dark: boolean) {
  return {
    /* permukaan */
    kartu: dark
      ? "border-cream/10 bg-pine shadow-[0_1px_2px_rgba(0,0,0,0.25),0_12px_34px_rgba(0,0,0,0.32)]"
      : "border-line bg-white shadow-[0_1px_2px_rgba(20,52,43,0.04),0_12px_34px_rgba(20,52,43,0.07)]",
    garis: dark ? "border-cream/10" : "border-line",
    garisKuat: dark ? "border-cream/15" : "border-line-strong",
    kepala: dark ? "bg-pine-soft/40" : "bg-cream/50",
    panel: dark ? "border-cream/10 bg-pine-deep/70" : "border-line bg-cream/50",
    chip: dark ? "border-cream/10 bg-pine-deep" : "border-line bg-white",
    baris: dark ? "bg-pine hover:bg-pine-soft/60" : "bg-white hover:bg-brand-soft/60",
    barisZebra: dark ? "border-cream/5" : "border-line",

    /* teks */
    judul: dark ? "text-cream" : "text-pine",
    sub: dark ? "text-cream/60" : "text-pine/60",
    label: dark ? "text-cream/70" : "text-pine/70",
    redup: dark ? "text-cream/50" : "text-pine/55",

    /* kontrol */
    input: dark
      ? "border-cream/15 bg-pine-deep text-cream placeholder:text-cream/35"
      : "border-line-strong bg-white text-pine",
    ikon: dark ? "text-cream/45" : "text-pine/45",
    hantu: dark
      ? "text-cream/55 hover:bg-cream/10 hover:text-brand"
      : "text-pine/60 hover:bg-cream hover:text-brand-deep",

    /* aksen */
    lencana: dark ? "bg-brand/20 text-brand" : "bg-brand-soft text-brand-deep",
    chipAktif: dark ? "bg-brand-soft/12" : "bg-brand-soft",
    badgeAktif: dark ? "bg-brand text-pine-deep" : "bg-brand text-white",
    badgeHarga: dark ? "text-brand" : "text-brand-deep",
    tombolGelap: dark
      ? "bg-brand text-pine-deep hover:bg-brand/90"
      : "bg-pine text-cream hover:bg-pine-deep",

    /* bilah & status */
    barKosong: dark ? "bg-cream/15" : "bg-cream-dark",
    track: dark ? "bg-cream/15" : "bg-cream-dark",
    barIsi: { 1: "bg-red-400", 2: "bg-brand", 3: "bg-emerald-400" },
    labelKuat: dark
      ? { 0: "text-cream/55", 1: "text-red-300", 2: "text-brand", 3: "text-emerald-300" }
      : { 0: "text-pine/60", 1: "text-red-700", 2: "text-brand-deep", 3: "text-emerald-700" },

    /* tabel */
    kepalaTabel: dark ? "bg-pine-soft/60 text-cream" : "bg-pine text-cream",
    tbody: dark ? "border-cream/10" : "border-line",
  };
}

export type Skin = ReturnType<typeof skin>;