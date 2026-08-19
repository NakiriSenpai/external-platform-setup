import { env } from "@/lib/env";

export const cloudinaryConfig = {
  cloudName: env.cloudinaryCloudName,
  uploadPreset: env.cloudinaryUploadPreset,
  uploadUrl: (resourceType: "image" | "video" | "raw" | "auto" = "auto") =>
    `https://api.cloudinary.com/v1_1/${env.cloudinaryCloudName}/${resourceType}/upload`,
  deliveryUrl: (publicId: string, transform = "f_auto,q_auto") =>
    `https://res.cloudinary.com/${env.cloudinaryCloudName}/image/upload/${transform}/${publicId}`,
} as const;
