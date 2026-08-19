import { cloudinaryConfig } from "@/lib/cloudinary/client";

export type AvatarUploadResult = { url: string; publicId: string };

/**
 * Upload avatar ke Cloudinary (unsigned preset).
 * Folder mengikuti isolasi tenant: profile/{tenantId}/{userId}/avatar.
 */
export async function uploadAvatar(
  file: File,
  params: { tenantId: string | null; userId: string },
  onProgress?: (percent: number) => void,
): Promise<AvatarUploadResult> {
  const folder = `profile/${params.tenantId ?? "platform"}/${params.userId}`;

  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", cloudinaryConfig.uploadPreset);
  form.append("folder", folder);
  form.append("public_id", `avatar_${Date.now()}`);

  return new Promise<AvatarUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", cloudinaryConfig.uploadUrl("image"));

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Gagal mengunggah foto (kode ${xhr.status}).`));
        return;
      }
      try {
        const data = JSON.parse(xhr.responseText) as Record<string, unknown>;
        onProgress?.(100);
        resolve({
          url: String(data["secure_url"] ?? data["url"] ?? ""),
          publicId: String(data["public_id"] ?? ""),
        });
      } catch {
        reject(new Error("Respons unggahan tidak dapat dibaca."));
      }
    };

    xhr.onerror = () => reject(new Error("Koneksi terputus saat mengunggah foto."));
    xhr.send(form);
  });
}
