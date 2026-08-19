/**
 * Utilitas gambar avatar (client-side).
 * Crop -> resize 512x512 -> kompresi WebP/JPEG (kualitas 80-85%, target <= 300KB).
 * Tidak ada upload di sini: file hasil olahan dikembalikan sebagai File.
 */

export const AVATAR_OUTPUT_SIZE = 512;
export const AVATAR_MAX_BYTES = 300 * 1024;
export const AVATAR_MAX_INPUT_BYTES = 10 * 1024 * 1024;
export const AVATAR_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type CropTransform = {
  /** Ukuran kotak preview (px) tempat gambar ditampilkan. */
  viewport: number;
  /** Skala dasar agar gambar menutup viewport (cover). */
  baseScale: number;
  /** Zoom tambahan dari pengguna. */
  zoom: number;
  /** Geser horizontal relatif pusat viewport (px). */
  offsetX: number;
  /** Geser vertikal relatif pusat viewport (px). */
  offsetY: number;
};

export function validateAvatarFile(file: File): { valid: boolean; message?: string } {
  if (!(AVATAR_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return { valid: false, message: "Format foto harus JPG, PNG, atau WebP." };
  }
  if (file.size > AVATAR_MAX_INPUT_BYTES) {
    return { valid: false, message: "Ukuran foto maksimal 10MB." };
  }
  return { valid: true };
}

/** Muat file menjadi HTMLImageElement (object URL dibersihkan otomatis). */
export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Foto tidak dapat dibaca."));
    };
    image.src = url;
  });
}

/** Skala minimum agar gambar menutup penuh viewport (cover). */
export function coverScale(image: HTMLImageElement, viewport: number): number {
  return Math.max(viewport / image.naturalWidth, viewport / image.naturalHeight);
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Gagal memproses foto."))),
      type,
      quality,
    );
  });
}

/**
 * Render hasil crop ke kanvas 512x512, lalu kompresi sampai <= 300KB.
 * Urutan kualitas: 0.85 -> 0.8 -> 0.72 -> 0.65 (WebP, fallback JPEG).
 */
export async function buildAvatarFile(
  image: HTMLImageElement,
  transform: CropTransform,
): Promise<File> {
  const size = AVATAR_OUTPUT_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Peramban tidak mendukung pemrosesan gambar.");

  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, size, size);

  const k = size / transform.viewport;
  const scale = transform.baseScale * transform.zoom * k;
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;

  ctx.save();
  ctx.translate(size / 2 + transform.offsetX * k, size / 2 + transform.offsetY * k);
  ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();

  const supportsWebp = canvas.toDataURL("image/webp").startsWith("data:image/webp");
  const type = supportsWebp ? "image/webp" : "image/jpeg";
  const extension = supportsWebp ? "webp" : "jpg";

  let blob = await canvasToBlob(canvas, type, 0.85);
  for (const quality of [0.8, 0.72, 0.65]) {
    if (blob.size <= AVATAR_MAX_BYTES) break;
    blob = await canvasToBlob(canvas, type, quality);
  }

  if (blob.size > AVATAR_MAX_BYTES) {
    throw new Error("Foto masih terlalu besar setelah kompresi. Coba foto lain.");
  }

  return new File([blob], `avatar.${extension}`, { type });
}
