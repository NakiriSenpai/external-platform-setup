/**
 * Utilitas rich text sederhana (tanpa dependensi eksternal).
 *
 * Format yang didukung disimpan sebagai HTML minimal: bold, italic, underline,
 * strikethrough, list, dan paragraf/baris baru. Semua atribut dibuang sehingga
 * tidak mungkin menyisipkan event handler, href, atau style berbahaya.
 */

const ALLOWED_TAGS = new Set([
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "strike",
  "br",
  "p",
  "div",
  "ul",
  "ol",
  "li",
]);

/**
 * Ubah sintaks markdown inline menjadi tag rich text.
 * Hanya teks di luar tag HTML yang diproses, sehingga aman dipanggil
 * berulang kali (idempoten untuk HTML yang sudah terformat).
 *
 * Didukung: **bold**, __underline__, *italic*, ~~strike~~
 */
export function applyInlineMarkdown(html: string | null | undefined): string {
  if (!html) return "";
  const convert = (text: string) =>
    text
      .replace(/~~(?!\s)([\s\S]+?)(?<!\s)~~/g, "<s>$1</s>")
      .replace(/\*\*(?!\s)([\s\S]+?)(?<!\s)\*\*/g, "<strong>$1</strong>")
      .replace(/__(?!\s)([\s\S]+?)(?<!\s)__/g, "<u>$1</u>")
      .replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)(?<!\s)\*(?!\*)/g, "$1<em>$2</em>");

  // Pisahkan tag dan teks agar markup existing tidak ikut diproses.
  return html
    .split(/(<[^>]+>)/g)
    .map((part) => (part.startsWith("<") && part.endsWith(">") ? part : convert(part)))
    .join("");
}

/** Bersihkan HTML rich text ke subset tag aman tanpa atribut apa pun. */
export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return "";
  const withoutBlocks = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|style|iframe|object|embed)[^>]*>/gi, "");

  return withoutBlocks
    .replace(/<(\/?)([a-zA-Z0-9]+)[^>]*>/g, (_match, slash: string, rawTag: string) => {
      const tag = rawTag.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return "";
      return `<${slash}${tag}>`;
    })
    .trim();
}

/** Sanitasi + konversi markdown inline — dipakai semua renderer/consumer. */
export function renderRichText(html: string | null | undefined): string {
  return applyInlineMarkdown(sanitizeRichText(html));
}


/** Versi teks polos — dipakai untuk validasi panjang dan pencarian. */
export function richTextToPlain(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>(\s*)/gi, " ")
    .replace(/<\/(p|div|li)>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/~~|\*\*|__|\*/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** True bila rich text tidak memiliki konten terlihat. */
export function isRichTextEmpty(html: string | null | undefined): boolean {
  return richTextToPlain(html).length === 0;
}
