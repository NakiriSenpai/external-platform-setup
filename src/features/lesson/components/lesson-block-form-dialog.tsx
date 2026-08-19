import { useEffect, useState, type FormEvent } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MediaPicker } from "@/features/media/components/media-picker";
import {
  BLOCK_NEEDS_TEXT,
  LESSON_BLOCK_LABELS,
  LESSON_BLOCK_TYPES,
} from "@/features/lesson/lesson.constants";
import { useCreateLessonBlock, useUpdateLessonBlock } from "@/hooks/lesson";
import { useGrammarTags } from "@/hooks/question-bank";
import type { LessonBlockRow, LessonBlockType } from "@/types/lesson";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionId: string;
  block?: LessonBlockRow | null;
};

const NO_TAG = "none";

export function LessonBlockFormDialog({ open, onOpenChange, sectionId, block = null }: Props) {
  const [type, setType] = useState<LessonBlockType>("paragraph");
  const [content, setContent] = useState("");
  const [items, setItems] = useState<string[]>([]);
  const [itemDraft, setItemDraft] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [grammarTagId, setGrammarTagId] = useState<string>(NO_TAG);
  const [error, setError] = useState<string | null>(null);

  const grammarQuery = useGrammarTags();
  const createBlock = useCreateLessonBlock();
  const updateBlock = useUpdateLessonBlock();
  const pending = createBlock.isPending || updateBlock.isPending;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setItemDraft("");
    setType(block?.type ?? "paragraph");
    setContent(block?.content ?? "");
    setItems(block?.items ?? []);
    setMediaUrl(block?.media_url ?? null);
    setGrammarTagId(block?.grammar_tag_id ?? NO_TAG);
  }, [open, block]);

  const addItem = () => {
    const value = itemDraft.trim();
    if (!value) return;
    setItems((prev) => [...prev, value]);
    setItemDraft("");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (BLOCK_NEEDS_TEXT.includes(type) && !content.trim()) {
      return setError("Isi teks block wajib diisi.");
    }
    if (type === "bullet_list" && items.length === 0) {
      return setError("Tambahkan minimal satu poin daftar.");
    }
    if ((type === "image" || type === "audio") && !mediaUrl) {
      return setError("Unggah media terlebih dahulu.");
    }

    const input = {
      type,
      content: content.trim(),
      items,
      media_url: mediaUrl,
      grammar_tag_id: grammarTagId === NO_TAG ? null : grammarTagId,
    };

    try {
      if (block) {
        await updateBlock.mutateAsync({ id: block.id, input });
        toast.success("Block diperbarui.");
      } else {
        await createBlock.mutateAsync({ sectionId, input });
        toast.success("Block ditambahkan.");
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{block ? "Ubah Block" : "Tambah Block"}</DialogTitle>
          <DialogDescription>Susun konten materi per block agar mudah dibaca.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label>Tipe Block</Label>
            <Select value={type} onValueChange={(v) => setType(v as LessonBlockType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LESSON_BLOCK_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {LESSON_BLOCK_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {type === "divider" ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              Divider tidak memerlukan isi.
            </p>
          ) : null}

          {BLOCK_NEEDS_TEXT.includes(type) ? (
            <div className="space-y-2">
              <Label htmlFor="block-content">{type === "heading" ? "Judul" : "Isi teks"}</Label>
              <Textarea
                id="block-content"
                rows={type === "heading" ? 2 : 5}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Tulis konten di sini."
              />
            </div>
          ) : null}

          {type === "grammar_highlight" ? (
            <div className="space-y-2">
              <Label>Grammar Tag</Label>
              <Select value={grammarTagId} onValueChange={setGrammarTagId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TAG}>Tanpa tag</SelectItem>
                  {(grammarQuery.data ?? []).map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      {tag.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {type === "bullet_list" ? (
            <div className="space-y-2">
              <Label htmlFor="block-item">Poin daftar</Label>
              <div className="flex gap-2">
                <Input
                  id="block-item"
                  value={itemDraft}
                  onChange={(e) => setItemDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addItem();
                    }
                  }}
                  placeholder="Tulis poin lalu tekan Tambah"
                />
                <Button type="button" variant="outline" onClick={addItem}>
                  Tambah
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {items.map((item, index) => (
                  <Badge key={`${item}-${index}`} variant="secondary" className="gap-1">
                    {item}
                    <button
                      type="button"
                      aria-label={`Hapus poin ${item}`}
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {type === "image" || type === "audio" ? (
            <div className="space-y-2">
              <Label>{type === "image" ? "Gambar" : "Audio"}</Label>
              {mediaUrl ? (
                <div className="flex items-center gap-2 rounded-lg border p-2 text-xs">
                  <span className="min-w-0 flex-1 truncate">{mediaUrl}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setMediaUrl(null)}
                  >
                    Hapus
                  </Button>
                </div>
              ) : (
                <MediaPicker
                  allowed={[type]}
                  folder="lesson"
                  label={`Unggah ${type === "image" ? "gambar" : "audio"}`}
                  onChange={(asset) => setMediaUrl(asset?.url ?? null)}
                />
              )}
              <Textarea
                rows={2}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Keterangan (opsional)"
              />
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending} className="min-h-11">
              {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
