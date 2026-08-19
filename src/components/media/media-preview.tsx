import { AudioPreview } from "./audio-preview";
import { ImagePreview } from "./image-preview";
import type { MediaAsset } from "@/types/media";

type Props = {
  asset: MediaAsset;
  fileName?: string | undefined;
};

/** Pratinjau otomatis sesuai jenis media. */
export function MediaPreview({ asset, fileName }: Props) {
  if (asset.kind === "audio") {
    return (
      <AudioPreview
        src={asset.url}
        fileName={fileName ?? asset.original_filename ?? asset.public_id}
        duration={asset.duration}
        bytes={asset.bytes}
      />
    );
  }

  return (
    <ImagePreview
      src={asset.url}
      alt={fileName ?? asset.original_filename ?? "Pratinjau gambar"}
      bytes={asset.bytes}
      width={asset.width}
      height={asset.height}
    />
  );
}
