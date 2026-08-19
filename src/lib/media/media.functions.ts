import { createServerFn } from "@tanstack/react-start";

/**
 * Hapus media di Cloudinary (signed destroy).
 * Disiapkan untuk sprint berikutnya — tidak dipanggil otomatis di mana pun.
 */
export const deleteMediaAsset = createServerFn({ method: "POST" })
  .inputValidator((input: { publicId: string; resourceType?: "image" | "video" | "raw" }) => {
    if (!input?.publicId) throw new Error("public_id media wajib diisi.");
    return input;
  })
  .handler(async ({ data }) => {
    const cloudName =
      process.env["CLOUDINARY_CLOUD_NAME"] ?? process.env["VITE_CLOUDINARY_CLOUD_NAME"];
    const apiKey = process.env["CLOUDINARY_API_KEY"];
    const apiSecret = process.env["CLOUDINARY_API_SECRET"];

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error(
        "Konfigurasi hapus media belum lengkap: CLOUDINARY_API_KEY dan CLOUDINARY_API_SECRET belum tersedia.",
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const toSign = `public_id=${data.publicId}&timestamp=${timestamp}${apiSecret}`;
    const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(toSign));
    const signature = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    const body = new URLSearchParams({
      public_id: data.publicId,
      timestamp: String(timestamp),
      api_key: apiKey,
      signature,
    });

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${data.resourceType ?? "image"}/destroy`,
      { method: "POST", body },
    );

    if (!response.ok) {
      throw new Error(`Gagal menghapus media (kode ${response.status}).`);
    }

    const result = (await response.json()) as { result?: string };
    return { result: result.result ?? "unknown" };
  });
