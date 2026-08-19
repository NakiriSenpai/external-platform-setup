import { deleteMediaAsset } from "@/lib/media/media.functions";
import type { MediaAsset } from "@/types/media";

/**
 * Service hapus media. Disiapkan, belum dipakai fitur mana pun.
 * Tidak ada penghapusan otomatis.
 */
export async function deleteMedia(
  publicId: string,
  resourceType: "image" | "video" | "raw" = "image",
): Promise<{ result: string }> {
  return deleteMediaAsset({ data: { publicId, resourceType } });
}

/** Varian praktis dari objek MediaAsset. */
export async function deleteMediaByAsset(asset: MediaAsset): Promise<{ result: string }> {
  const resourceType = asset.resource_type === "video" ? "video" : "image";
  return deleteMedia(asset.public_id, resourceType);
}
