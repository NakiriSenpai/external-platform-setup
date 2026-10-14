/**
 * Referensi pilihan jawaban terstruktur di dalam pembahasan.
 *
 * Token disimpan sebagai teks `[[pilihan:B]]`, terikat ke `label` pilihan
 * (identitas stabil: label tidak berubah saat soal disimpan ulang, diimpor,
 * disalin, atau pilihan diacak — ID baris jawaban justru dibuat ulang setiap
 * simpan). Saat dirender, token menjadi nomor lingkaran sesuai urutan yang
 * benar-benar tampil (mis. urutan shuffle pada snapshot attempt).
 */

export type ChoiceLabel = "A" | "B" | "C" | "D";
export const CHOICE_LABELS: readonly ChoiceLabel[] = ["A", "B", "C", "D"];

const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"];
const TOKEN_RE = /\[\[pilihan:([A-D])\]\]/g;

export function choiceToken(label: ChoiceLabel): string {
  return `[[pilihan:${label}]]`;
}

export function circledNumber(position: number): string {
  return CIRCLED[position - 1] ?? `(${position})`;
}

/** Fallback aman bila pilihan tidak ditemukan — tidak menebak nomor. */
export const MISSING_CHOICE_TEXT = "(pilihan tidak tersedia)";

export function hasChoiceTokens(text: string | null | undefined): boolean {
  return !!text && /\[\[pilihan:[A-D]\]\]/.test(text);
}

/**
 * Ganti token dengan nomor sesuai urutan tampil.
 * `displayOrder` = label pilihan sesuai urutan tampil (index 0 = nomor ①).
 */
export function resolveChoiceTokens(
  text: string | null | undefined,
  displayOrder: readonly string[],
): string {
  if (!text) return "";
  return text.replace(TOKEN_RE, (_m, label: string) => {
    const index = displayOrder.indexOf(label);
    return index >= 0 ? circledNumber(index + 1) : MISSING_CHOICE_TEXT;
  });
}

// ---------------------------------------------------------------------------
// Migrasi pembahasan lama (nomor lingkaran urutan asli → token)
// ---------------------------------------------------------------------------

export type MigrationAnswer = { label: string; text: string | null };

export type RefIssueKind =
  | "conflict" // nomor & teks setelahnya menunjuk pilihan berbeda
  | "unverified" // tidak ada teks pilihan setelah nomor → tidak dapat dipastikan
  | "out_of_range"; // nomor melebihi jumlah pilihan

export type RefIssue = { kind: RefIssueKind; number: number; excerpt: string; detail: string };

export type FieldMigration = {
  original: string;
  migrated: string;
  mapped: number;
  issues: RefIssue[];
};

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function normalize(value: string): string {
  return stripTags(value).replace(/\s+/g, " ").trim().toLowerCase();
}

/** Teks setelah nomor, tanpa tag/spasi/tanda baca pembuka. */
function followingText(html: string, from: number): string {
  return normalize(html.slice(from, from + 240)).replace(/^[\s.):,\-–—]+/, "");
}

function excerptAround(html: string, at: number): string {
  const plain = stripTags(html.slice(Math.max(0, at - 30), at + 50));
  return plain.replace(/\s+/g, " ").trim();
}

/**
 * Cari pilihan yang teksnya menjadi awal `after`. Teks pilihan terpanjang
 * menang (mis. "가방" vs "가방끈"). Pilihan tanpa teks diabaikan.
 */
function matchChoice(after: string, answers: readonly MigrationAnswer[]): string | null {
  let best: { label: string; len: number } | null = null;
  for (const answer of answers) {
    const text = normalize(answer.text ?? "");
    if (!text) continue;
    if (after.startsWith(text) && (!best || text.length > best.len)) {
      best = { label: answer.label, len: text.length };
    }
  }
  return best?.label ?? null;
}

/**
 * Petakan nomor lingkaran (①–⑨) di luar tag HTML ke token pilihan.
 * Hanya referensi yang TERVERIFIKASI (nomor diikuti teks pilihan yang sama)
 * yang diubah. Angka biasa (1, 2., (3), 4번, tahun, bab) tidak pernah disentuh.
 * Idempoten: token yang sudah ada tidak diproses ulang.
 */
export function migrateExplanationText(
  html: string | null | undefined,
  answers: readonly MigrationAnswer[],
): FieldMigration {
  const original = html ?? "";
  const ordered = [...answers].sort((a, b) => a.label.localeCompare(b.label));
  const issues: RefIssue[] = [];
  let mapped = 0;
  let out = "";
  let inTag = false;

  for (let i = 0; i < original.length; i += 1) {
    const ch = original[i]!;
    if (ch === "<") inTag = true;
    if (inTag) {
      out += ch;
      if (ch === ">") inTag = false;
      continue;
    }
    const n = CIRCLED.indexOf(ch) + 1;
    if (n === 0) {
      out += ch;
      continue;
    }
    const excerpt = excerptAround(original, i);
    if (n > ordered.length) {
      issues.push({
        kind: "out_of_range",
        number: n,
        excerpt,
        detail: `Nomor ${ch} melebihi jumlah pilihan (${ordered.length}).`,
      });
      out += ch;
      continue;
    }
    const expected = ordered[n - 1]!;
    const matched = matchChoice(followingText(original, i + 1), ordered);
    if (matched === expected.label) {
      out += choiceToken(expected.label as ChoiceLabel);
      mapped += 1;
    } else if (matched) {
      const other = ordered.find((a) => a.label === matched);
      issues.push({
        kind: "conflict",
        number: n,
        excerpt,
        detail: `${ch} menurut urutan asli adalah "${stripTags(expected.text ?? "")}", tetapi teks setelahnya adalah "${stripTags(other?.text ?? "")}".`,
      });
      out += ch;
    } else {
      issues.push({
        kind: "unverified",
        number: n,
        excerpt,
        detail: `${ch} tidak diikuti teks pilihan, sehingga tidak dapat dipastikan merujuk pilihan jawaban.`,
      });
      out += ch;
    }
  }

  // Bila ada konflik, field dibiarkan utuh agar tidak ada perubahan setengah benar.
  const hasConflict = issues.some((issue) => issue.kind === "conflict");
  return {
    original,
    migrated: hasConflict ? original : out,
    mapped: hasConflict ? 0 : mapped,
    issues,
  };
}

/**
 * Tampilan pembahasan pada snapshot lama yang belum dimigrasikan:
 * referensi lama yang terverifikasi ditampilkan sesuai urutan tampil attempt,
 * tanpa mengubah isi snapshot. Nomor yang tidak pasti dibiarkan apa adanya.
 */
export function localizeExplanation(
  html: string | null | undefined,
  canonicalAnswers: readonly MigrationAnswer[],
  displayOrder: readonly string[],
): string {
  if (!html) return "";
  const { migrated } = migrateExplanationText(html, canonicalAnswers);
  return resolveChoiceTokens(migrated, displayOrder);
}
