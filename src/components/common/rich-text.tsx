import { useMemo } from "react";

import { renderRichText } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

type Props = {
  html: string | null | undefined;
  className?: string;
  as?: "div" | "p" | "span";
};

/**
 * Renderer rich text read-only. HTML selalu dibersihkan ke subset tag aman
 * dan sintaks markdown inline (**bold**, __underline__, *italic*, ~~strike~~)
 * dikonversi otomatis sebelum dirender.
 */
export function RichText({ html, className, as: Tag = "div" }: Props) {
  const clean = useMemo(() => renderRichText(html), [html]);
  if (!clean) return null;
  return (
    <Tag
      className={cn("rich-text whitespace-pre-wrap break-words", className)}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
