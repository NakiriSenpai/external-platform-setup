import { useMemo } from "react";

import { sanitizeRichText } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

type Props = {
  html: string | null | undefined;
  className?: string;
  as?: "div" | "p" | "span";
};

/**
 * Renderer rich text read-only. HTML selalu dibersihkan ke subset tag aman
 * sebelum dirender, sehingga aman dipakai di editor, preview, dan runner ujian.
 */
export function RichText({ html, className, as: Tag = "div" }: Props) {
  const clean = useMemo(() => sanitizeRichText(html), [html]);
  if (!clean) return null;
  return (
    <Tag
      className={cn("rich-text whitespace-pre-wrap break-words", className)}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
