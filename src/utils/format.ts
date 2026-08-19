/** Utilitas format berbahasa Indonesia. */
export const formatTanggal = (value: Date | string): string =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(value));

export const formatAngka = (value: number): string => new Intl.NumberFormat("id-ID").format(value);
