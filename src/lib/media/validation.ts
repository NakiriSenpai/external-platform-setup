import { MEDIA_EXTENSIONS, MEDIA_LABEL, MEDIA_SIZE_LIMIT } from "./constants";
import { formatFileSize, getFileExtension, getMediaType, isGenericMime } from "./utils";
import type { MediaKind, MediaValidationResult } from "@/types/media";

/**
 * Validasi tipe, format, dan ukuran file media.
 * Toleran terhadap file picker Android yang mengirim MIME generik
 * (application/octet-stream) atau nama file tanpa ekstensi.
 * Semua pesan error dalam Bahasa Indonesia.
 */
export function validateMediaFile(
  file: File,
  allowed: MediaKind | MediaKind[] = ["image", "audio"],
): MediaValidationResult {
  const allowedKinds = Array.isArray(allowed) ? allowed : [allowed];
  const expected = allowedKinds.length === 1 ? (allowedKinds[0] as MediaKind) : null;
  const kind = getMediaType(file, expected);

  if (!kind || !allowedKinds.includes(kind)) {
    const label = allowedKinds.map((item) => MEDIA_LABEL[item].toLowerCase()).join(" atau ");
    return {
      valid: false,
      message: `Tipe file tidak didukung (${file.type || "tanpa MIME"}). Unggah file ${label} saja.`,
    };
  }

  // Percayai MIME bila cocok; ekstensi hanya menolak bila MIME jelas & tak cocok.
  const mime = (file.type || "").toLowerCase();
  const mimeTrusted = mime.startsWith(`${kind}/`) || isGenericMime(mime);
  const ext = getFileExtension(file.name);
  if (!mimeTrusted && ext && !MEDIA_EXTENSIONS[kind].includes(ext)) {
    return {
      valid: false,
      message: `Format .${ext} tidak didukung. Gunakan ${MEDIA_EXTENSIONS[kind]
        .map((item) => `.${item}`)
        .join(", ")}.`,
    };
  }

  if (file.size <= 0) {
    return { valid: false, message: "File kosong atau tidak dapat dibaca." };
  }

  const limit = MEDIA_SIZE_LIMIT[kind];
  if (file.size > limit) {
    return {
      valid: false,
      message: `Ukuran file ${formatFileSize(file.size)} melebihi batas ${formatFileSize(limit)}.`,
    };
  }

  return { valid: true };
}
