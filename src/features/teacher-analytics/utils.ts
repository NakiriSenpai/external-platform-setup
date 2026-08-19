/** Helper format analitik pengajar. */
export function formatDurasiDetik(total: number): string {
  const menit = Math.floor(total / 60);
  const detik = total % 60;
  return `${menit}m ${String(detik).padStart(2, "0")}d`;
}

export function formatTanggal(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}
