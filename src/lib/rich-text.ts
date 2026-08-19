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

/** Versi teks polos — dipakai untuk validasi panjang dan pencarian. */
export function richTextToPlain(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>(\s*)/gi, " ")
    .replace(/<\/(p|div|li)>/gi, " ")
    .replace(/<[^>]+>/g, "")
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
