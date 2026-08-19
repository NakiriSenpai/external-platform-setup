import { useEffect, useRef } from "react";
import { Bold, Italic, List, ListOrdered, Strikethrough, Underline } from "lucide-react";

import { sanitizeRichText } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Tinggi minimum area tulis (auto-grow ke bawah). */
  minRows?: number;
  id?: string;
  ariaLabel?: string;
  className?: string;
};

const COMMANDS = [
  { cmd: "bold", label: "Tebal", Icon: Bold },
  { cmd: "italic", label: "Miring", Icon: Italic },
  { cmd: "underline", label: "Garis bawah", Icon: Underline },
  { cmd: "strikeThrough", label: "Coret", Icon: Strikethrough },
  { cmd: "insertUnorderedList", label: "Daftar poin", Icon: List },
  { cmd: "insertOrderedList", label: "Daftar nomor", Icon: ListOrdered },
] as const;

/**
 * Editor rich text ringan berbasis contentEditable (auto-grow).
 * Nilai keluar selalu HTML yang sudah disanitasi.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minRows = 3,
  id,
  ariaLabel,
  className,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  // Sinkronisasi hanya bila nilai eksternal berbeda dari isi editor,
  // supaya caret tidak melompat saat mengetik.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const next = value ?? "";
    if (node.innerHTML !== next) node.innerHTML = next;
  }, [value]);

  const exec = (command: string) => {
    ref.current?.focus();
    document.execCommand(command);
    if (ref.current) onChange(sanitizeRichText(ref.current.innerHTML));
  };

  return (
    <div
      className={cn(
        "min-w-0 rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-1.5 py-1">
        {COMMANDS.map(({ cmd, label, Icon }) => (
          <button
            key={cmd}
            type="button"
            aria-label={label}
            title={label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(cmd)}
            className="grid size-7 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Icon className="size-3.5" />
          </button>
        ))}
      </div>
      <div
        id={id}
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel ?? placeholder ?? "Editor teks"}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder ?? ""}
        onInput={(e) => onChange(sanitizeRichText(e.currentTarget.innerHTML))}
        onBlur={(e) => onChange(sanitizeRichText(e.currentTarget.innerHTML))}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
        }}
        className="rich-text w-full break-words px-3 py-2 text-sm outline-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
        style={{ minHeight: `${Math.max(1, minRows) * 1.5 + 1}rem` }}
      />
    </div>
  );
}
