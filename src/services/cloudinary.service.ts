import { cloudinaryConfig } from "@/lib/cloudinary/client";
import type { CloudinaryUploadResult, ConnectionStatus } from "@/types/common";

export type UploadOptions = {
  folder?: string;
  resourceType?: "image" | "video" | "raw" | "auto";
};

/**
 * Helper upload unsigned ke Cloudinary. Sprint 0: belum digunakan.
 */
export async function uploadToCloudinary(
  file: File,
  options: UploadOptions = {},
): Promise<CloudinaryUploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", cloudinaryConfig.uploadPreset);
  if (options.folder) formData.append("folder", options.folder);

  const response = await fetch(cloudinaryConfig.uploadUrl(options.resourceType ?? "auto"), {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gagal mengunggah ke Cloudinary [${response.status}]: ${detail}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  return {
    publicId: String(data["public_id"]),
    url: String(data["url"]),
    secureUrl: String(data["secure_url"]),
    format: String(data["format"] ?? ""),
    bytes: Number(data["bytes"] ?? 0),
    ...(typeof data["width"] === "number" ? { width: data["width"] } : {}),
    ...(typeof data["height"] === "number" ? { height: data["height"] } : {}),
    resourceType: String(data["resource_type"] ?? "image"),
  };
}

/**
 * Cek konektivitas Cloudinary lewat endpoint delivery publik.
 */
export async function checkCloudinaryConnection(): Promise<ConnectionStatus> {
  try {
    const response = await fetch(
      `https://res.cloudinary.com/${cloudinaryConfig.cloudName}/image/upload/sample.jpg`,
      { method: "HEAD" },
    );
    return response.ok
      ? { connected: true, message: "Cloudinary terhubung" }
      : { connected: false, message: `Cloudinary gagal (${response.status})` };
  } catch (error) {
    return {
      connected: false,
      message: error instanceof Error ? error.message : "Cloudinary tidak dapat dijangkau",
    };
  }
}
