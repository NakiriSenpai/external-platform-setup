import { useCallback, useRef, useState } from "react";

import { uploadMedia } from "@/services/media";
import { validateMediaFile } from "@/lib/media/validation";
import { getMediaType } from "@/lib/media/utils";
import { audioDebug } from "@/lib/media/audio-debug";
import type { MediaAsset, MediaKind, UploadStatus } from "@/types/media";

type Options = {
  folder?: string;
  allowed?: MediaKind[];
  onSuccess?: (asset: MediaAsset) => void;
};

/** State + aksi upload media: progress, cancel, retry. */
export function useMediaUpload(options: Options = {}) {
  const { folder, allowed = ["image", "audio"], onSuccess } = options;

  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [asset, setAsset] = useState<MediaAsset | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const controllerRef = useRef<AbortController | null>(null);

  const run = useCallback(
    async (target: File) => {
      const expected: MediaKind | null = allowed.length === 1 ? (allowed[0] as MediaKind) : null;
      const validation = validateMediaFile(target, allowed);
      if (!validation.valid) {
        audioDebug("06 VALIDATION_FAIL", validation.message);
        console.error("[AUDIO DEBUG] validation=FAIL", {
          name: target.name,
          type: target.type,
          size: target.size,
          message: validation.message,
        });
        setStatus("error");
        setError(validation.message);
        return null;
      }
      audioDebug("06 VALIDATION_PASS", "File diterima validator");

      const controller = new AbortController();
      controllerRef.current = controller;
      setStatus("uploading");
      setProgress(0);
      setError(null);

      try {
        const kind = (getMediaType(target, expected) ?? expected ?? "image") as MediaKind;
        audioDebug("05 MEDIA_DETECTION", `kind=${kind}; expected=${expected ?? "auto"}`);
        audioDebug("07 UPLOAD_CALLED", "uploadMedia dipanggil");
        const result = await uploadMedia(target, {
          ...(folder ? { folder } : {}),
          kind,
          onProgress: setProgress,
          signal: controller.signal,
        });
        setAsset(result);
        setStatus("success");
        audioDebug("09 CLOUDINARY_SUCCESS", "Cloudinary mengembalikan secure URL");
        onSuccess?.(result);
        audioDebug("10 UPLOAD_STATE", "Hook upload berstatus success");
        return result;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setStatus("canceled");
          setError("Unggahan dibatalkan.");
          return null;
        }
        audioDebug("09 UPLOAD_FAIL", err instanceof Error ? err.message : "Upload gagal");
        setStatus("error");
        setError(err instanceof Error ? err.message : "Gagal mengunggah media.");
        return null;
      } finally {
        controllerRef.current = null;
      }
    },
    [allowed, folder, onSuccess],
  );

  const upload = useCallback(
    async (target: File) => {
      setFile(target);
      return run(target);
    },
    [run],
  );

  const retry = useCallback(async () => (file ? run(file) : null), [file, run]);

  const cancel = useCallback(() => controllerRef.current?.abort(), []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setStatus("idle");
    setProgress(0);
    setError(null);
    setAsset(null);
    setFile(null);
  }, []);

  return {
    status,
    progress,
    error,
    asset,
    file,
    isUploading: status === "uploading",
    upload,
    retry,
    cancel,
    reset,
  };
}
