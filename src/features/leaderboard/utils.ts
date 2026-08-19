/** Helper tampilan leaderboard. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "S";
}

/** Angka skor gaya Indonesia (24870 -> "24.870"). */
export function formatScore(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}
