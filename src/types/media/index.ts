/** Tipe media yang didukung Sprint 5. */
export type MediaKind = "image" | "audio";

/** Hasil upload media terstruktur (dipakai lintas fitur). */
export type MediaAsset = {
  url: string;
  public_id: string;
  width?: number;
  height?: number;
  duration?: number;
  format: string;
  resource_type: string;
  bytes: number;
  created_at: string;
  original_filename?: string;
  kind: MediaKind;
};

export type MediaValidationResult = { valid: true } | { valid: false; message: string };

export type UploadStatus = "idle" | "uploading" | "success" | "error" | "canceled";

export type MediaUploadOptions = {
  folder?: string;
  kind?: MediaKind;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
};
