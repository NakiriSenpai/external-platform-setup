import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Archive, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MediaPicker } from "@/features/media";
import { useAuth } from "@/hooks/auth";
import { useColorTestPool, useColorTestPoolMutations } from "@/hooks/color-test";
import type { MediaAsset } from "@/types/media";

/**
 * Bank Soal Tes Buta Warna (Owner only).
 * Terpisah total dari Question Bank ujian; gambar memakai Cloudinary existing.
 */
export function ColorTestPoolManager() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isOwner = hasRole("owner");
  const { data: pool, isLoading } = useColorTestPool();
  const { create, setActive, archive } = useColorTestPoolMutations();

  const [asset, setAsset] = useState<MediaAsset | null>(null);
  const [answer, setAnswer] = useState("");

  if (!isOwner) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Halaman ini hanya untuk Owner.
        </CardContent>
      </Card>
    );
  }

  const submit = () => {
    if (!asset || !answer.trim()) {
      toast.error("Gambar dan jawaban benar wajib diisi.");
      return;
    }
    create.mutate(
      [
        {
          image_url: asset.url,
          image_public_id: asset.public_id,
          correct_answer: answer.trim(),
          answer_type: "numeric",
        },
      ],
      {
        onSuccess: () => {
          toast.success("Soal tes buta warna ditambahkan.");
          setAsset(null);
          setAnswer("");
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Gagal menambah soal."),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-foreground">
            Bank Soal Tes Buta Warna
          </h1>
          <p className="truncate text-sm text-muted-foreground">
            {pool?.length ?? 0} soal · setiap sesi mengambil 12 soal acak
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void navigate({ to: "/owner" })}>
          <ArrowLeft className="mr-1.5 size-4" /> Owner
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <MediaPicker
            allowed={["image"]}
            folder="color-test"
            label="Gambar soal (Ishihara)"
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
          <Button disabled={create.isPending} onClick={submit}>
            {create.isPending ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <Plus className="mr-1.5 size-4" />
            )}
            Tambah Soal
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex min-h-[20vh] items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" /> Memuat bank soal…
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(pool ?? []).map((question) => (
            <Card key={question.id}>
              <CardContent className="flex items-center gap-3 p-3">
                <img
                  src={question.image_url}
                  alt="Soal tes buta warna"
                  className="size-16 shrink-0 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    Jawaban: {question.correct_answer}
                  </p>
                  <Badge variant={question.active ? "default" : "outline"}>
                    {question.active ? "Aktif" : "Nonaktif"}
                  </Badge>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Switch
                    checked={question.active}
                    aria-label="Aktifkan soal"
                    onCheckedChange={(checked) =>
                      setActive.mutate({ id: question.id, active: checked })
                    }
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label="Arsipkan soal"
                    onClick={() => archive.mutate(question.id)}
                  >
                    <Archive className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
