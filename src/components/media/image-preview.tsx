import { formatFileSize } from "@/lib/media/utils";

type Props = {
  src: string;
  alt?: string;
  bytes?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
};

/** Pratinjau gambar dengan info dimensi dan ukuran. */
export function ImagePreview({ src, alt = "Pratinjau gambar", bytes, width, height }: Props) {
  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-card">
      <img src={src} alt={alt} loading="lazy" className="max-h-64 w-full bg-muted object-contain" />
      <figcaption className="flex flex-wrap gap-x-3 gap-y-1 px-3 py-2 text-xs text-muted-foreground">
        {width && height ? <span>{`${width} × ${height} px`}</span> : null}
        {typeof bytes === "number" ? <span>{formatFileSize(bytes)}</span> : null}
      </figcaption>
    </figure>
  );
}
