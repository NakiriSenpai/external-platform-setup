import { cloudinaryConfig } from "@/lib/cloudinary/client";
import { getMediaType } from "@/lib/media/utils";
import { validateMediaFile } from "@/lib/media/validation";
import type { MediaAsset, MediaKind, MediaUploadOptions } from "@/types/media";

/** Cloudinary menyimpan audio pada resource type `video`. */
function resourceTypeFor(kind: MediaKind): "image" | "video" | "raw" {
  return kind === "audio" ? "video" : "image";
}

function toAsset(data: Record<string, unknown>, kind: MediaKind): MediaAsset {
  return {
    url: String(data["secure_url"] ?? data["url"] ?? ""),
    public_id: String(data["public_id"] ?? ""),
    ...(typeof data["width"] === "number" ? { width: data["width"] } : {}),
    ...(typeof data["height"] === "number" ? { height: data["height"] } : {}),
    ...(typeof data["duration"] === "number" ? { duration: data["duration"] } : {}),
    format: String(data["format"] ?? ""),
    resource_type: String(data["resource_type"] ?? resourceTypeFor(kind)),
    bytes: Number(data["bytes"] ?? 0),
    created_at: String(data["created_at"] ?? new Date().toISOString()),
    ...(typeof data["original_filename"] === "string"
      ? { original_filename: data["original_filename"] }
      : {}),
    kind,
  };
}

/**
 * Upload media (gambar/audio) ke Cloudinary dengan progress dan cancel.
 * Satu-satunya jalur upload media di aplikasi.
 */
export function uploadMedia(file: File, options: MediaUploadOptions = {}): Promise<MediaAsset> {
  const kind = options.kind ?? getMediaType(file);
  if (!kind) {
    return Promise.reject(new Error("Tipe file tidak didukung."));
  }

  const validation = validateMediaFile(file, kind);
  if (!validation.valid) {
    return Promise.reject(new Error(validation.message));
  }

  return new Promise<MediaAsset>((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", cloudinaryConfig.uploadPreset);
    if (options.folder) form.append("folder", options.folder);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", cloudinaryConfig.uploadUrl(resourceTypeFor(kind)));

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        options.onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          options.onProgress?.(100);
          resolve(toAsset(JSON.parse(xhr.responseText) as Record<string, unknown>, kind));
        } catch {
          reject(new Error("Respons Cloudinary tidak dapat dibaca."));
        }
        return;
      }
      reject(new Error(`Gagal mengunggah media (kode ${xhr.status}). Silakan coba lagi.`));
    };

    xhr.onerror = () => reject(new Error("Koneksi terputus saat mengunggah media."));
    xhr.onabort = () => reject(new DOMException("Unggahan dibatalkan.", "AbortError"));

    if (options.signal) {
      if (options.signal.aborted) {
        xhr.abort();
        return;
      }
      options.signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(form);
  });
}
