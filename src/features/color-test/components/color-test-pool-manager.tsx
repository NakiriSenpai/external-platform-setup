import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { MediaPicker } from "@/features/media";
import { useAuth } from "@/hooks/auth";
import { useColorTestPool, useColorTestPoolMutations } from "@/hooks/color-test";
import type { ColorTestPoolQuestion } from "@/types/color-test";
import type { MediaAsset } from "@/types/media";
import { formatTanggal } from "@/utils/format";

const PAGE_SIZE = 10;

type StatusFilter = "semua" | "aktif" | "nonaktif";

/**
 * Bank Soal Tes Buta Warna (Owner only).
 * Terpisah dari Question Bank ujian, namun memakai design system yang sama.
 * Gambar plate memakai arsitektur upload Cloudinary existing (MediaPicker).
 */
export function ColorTestPoolManager() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isOwner = hasRole("owner");
  const { data: pool, isLoading } = useColorTestPool();
  const { create, setActive, archive, update } = useColorTestPoolMutations();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("semua");
  const [page, setPage] = useState(1);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ColorTestPoolQuestion | null>(null);
  const [asset, setAsset] = useState<MediaAsset | null>(null);
  const [answer, setAnswer] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ColorTestPoolQuestion | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (pool ?? []).filter((item) => {
      if (status === "aktif" && !item.active) return false;
      if (status === "nonaktif" && item.active) return false;
      if (q && !item.correct_answer.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [pool, search, status]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (!isOwner) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Halaman ini hanya untuk Owner.
        </CardContent>
      </Card>
    );
  }

  const openCreate = () => {
    setEditing(null);
    setAsset(null);
    setAnswer("");
    setFormActive(true);
    setEditorOpen(true);
  };

  const openEdit = (question: ColorTestPoolQuestion) => {
    setEditing(question);
    setAsset({
      url: question.image_url,
      public_id: question.image_public_id ?? "",
      format: "",
      resource_type: "image",
      bytes: 0,
      created_at: question.created_at,
      kind: "image",
    });
    setAnswer(question.correct_answer);
    setFormActive(question.active);
    setEditorOpen(true);
  };

  const submit = () => {
    if (!asset?.url || !answer.trim()) {
      toast.error("Gambar plate dan jawaban benar wajib diisi.");
      return;
    }

    if (editing) {
      update.mutate(
        {
          id: editing.id,
          patch: {
            image_url: asset.url,
            image_public_id: asset.public_id || null,
            correct_answer: answer.trim(),
            active: formActive,
          },
        },
        {
          onSuccess: () => {
            toast.success("Soal diperbarui.");
            setEditorOpen(false);
          },
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Gagal memperbarui soal."),
        },
      );
      return;
    }

    create.mutate(
      [
        {
          image_url: asset.url,
          image_public_id: asset.public_id || null,
          correct_answer: answer.trim(),
          answer_type: "numeric",
        },
      ],
      {
        onSuccess: (created) => {
          const row = created[0];
          if (row && !formActive) setActive.mutate({ id: row.id, active: false });
          toast.success("Soal tes buta warna ditambahkan.");
          setEditorOpen(false);
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Gagal menambah soal."),
      },
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    archive.mutate(deleteTarget.id, {
      onSuccess: () => toast.success("Soal diarsipkan. Riwayat sesi lama tetap utuh."),
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "Gagal mengarsipkan soal."),
    });
    setDeleteTarget(null);
  };

  const saving = create.isPending || update.isPending;

  return (
    <section className="space-y-5">
      <header className="space-y-3">
        <Button
          size="sm"
          variant="ghost"
          className="-ml-2"
          onClick={() => void navigate({ to: "/owner/question-bank" })}
        >
          <ArrowLeft className="mr-1.5 size-4" /> Kembali ke Question Bank
        </Button>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Bank Soal Tes Buta Warna</h1>
          <p className="text-sm text-muted-foreground">
            Pool plate Ishihara untuk tes buta warna setelah ujian. Setiap sesi mengambil 12 soal
            acak dari soal yang berstatus aktif.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button className="min-h-11" onClick={openCreate}>
          <Plus className="mr-1 size-4" /> Tambah Soal
        </Button>
      </div>

      <div className="space-y-3 rounded-xl border p-4">
        <div className="space-y-2">
          <Label htmlFor="ct-search">Cari soal</Label>
          <Input
            id="ct-search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari berdasarkan jawaban benar"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v as StatusFilter);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua</SelectItem>
                <SelectItem value="aktif">Aktif</SelectItem>
                <SelectItem value="nonaktif">Nonaktif</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{rows.length} soal ditampilkan</p>
      </div>

      {isLoading ? (
        <div className="flex min-h-[20vh] items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" /> Memuat bank soal…
        </div>
      ) : pageRows.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Belum ada soal tes buta warna.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {pageRows.map((question, index) => (
            <Card key={question.id}>
              <CardContent className="flex items-center gap-3 p-3">
                <img
                  src={question.image_url}
                  alt={`Plate tes buta warna jawaban ${question.correct_answer}`}
                  className="size-16 shrink-0 rounded-full object-cover"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    #{(safePage - 1) * PAGE_SIZE + index + 1}
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    Jawaban: {question.correct_answer}
                  </p>
                  <Badge variant={question.active ? "default" : "outline"}>
                    {question.active ? "Aktif" : "Nonaktif"}
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    Dibuat {formatTanggal(question.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-center gap-2">
                  <Switch
                    checked={question.active}
                    aria-label="Aktifkan soal"
                    onCheckedChange={(checked) =>
                      setActive.mutate({ id: question.id, active: checked })
                    }
                  />
                  <div className="flex gap-1.5">
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label="Edit soal"
                      onClick={() => openEdit(question)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label="Hapus soal"
                      onClick={() => setDeleteTarget(question)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Sebelumnya
          </Button>
          <span className="text-xs text-muted-foreground">
            Halaman {safePage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Berikutnya
          </Button>
        </div>
      ) : null}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Soal" : "Tambah Soal"}</DialogTitle>
            <DialogDescription>
              Unggah gambar plate, isi jawaban benar, lalu tentukan statusnya.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <MediaPicker
              allowed={["image"]}
              folder="color-test"
              label="Gambar plate (Ishihara)"
              value={asset}
              onChange={setAsset}
            />
            <div className="space-y-1.5">
              <Label htmlFor="color-test-answer">Jawaban benar</Label>
              <Input
                id="color-test-answer"
                inputMode="numeric"
                maxLength={2}
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="mis. 12"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Status aktif</p>
                <p className="text-xs text-muted-foreground">
                  Hanya soal aktif yang dipakai sesi tes buta warna.
                </p>
              </div>
              <Switch checked={formActive} onCheckedChange={setFormActive} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Batal
            </Button>
            <Button disabled={saving} onClick={submit}>
              {saving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus soal tes buta warna?</AlertDialogTitle>
            <AlertDialogDescription>
              Soal diarsipkan (soft delete) dan tidak lagi muncul di sesi baru. Riwayat sesi yang
              pernah memakai soal ini tetap utuh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Arsipkan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
