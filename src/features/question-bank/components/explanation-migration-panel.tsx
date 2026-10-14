import { useMemo, useState } from "react";
import { Download, Loader2, PlayCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { CHOICE_LABELS, resolveChoiceTokens } from "@/lib/choice-reference";
import { richTextToPlain } from "@/lib/rich-text";
import {
  applyExplanationMigration,
  buildExplanationMigrationPreview,
  type MigrationPreview,
  type QuestionMigrationStatus,
} from "@/services/question-bank/explanation-migration.service";

const STATUS_LABEL: Record<QuestionMigrationStatus, string> = {
  siap: "Siap dimigrasikan",
  sebagian: "Sebagian (ada nomor dilewati)",
  konflik: "Konflik — perlu diperiksa",
  "tidak-pasti": "Dilewati — tidak dapat dipastikan",
  "tanpa-referensi": "Tanpa referensi pilihan",
};

const FILTERS: QuestionMigrationStatus[] = ["siap", "sebagian", "konflik", "tidak-pasti"];

function download(name: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExplanationMigrationPanel() {
  const [preview, setPreview] = useState<MigrationPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [filter, setFilter] = useState<QuestionMigrationStatus>("siap");

  const counts = useMemo(() => {
    const base: Record<QuestionMigrationStatus, number> = {
      siap: 0,
      sebagian: 0,
      konflik: 0,
      "tidak-pasti": 0,
      "tanpa-referensi": 0,
    };
    for (const r of preview?.reports ?? []) base[r.status] += 1;
    return base;
  }, [preview]);

  const changes = useMemo(
    () => (preview?.reports ?? []).flatMap((r) => r.changes),
    [preview],
  );
  const visible = (preview?.reports ?? []).filter((r) => r.status === filter);

  const runPreview = async () => {
    setLoading(true);
    try {
      setPreview(await buildExplanationMigrationPreview());
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const runApply = async () => {
    setApplying(true);
    try {
      const result = await applyExplanationMigration(changes);
      toast.success(`${result.applied} pembahasan dimigrasikan, ${result.skipped} dilewati (teks sudah berubah).`);
      await runPreview();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setApplying(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Migrasi Referensi Pilihan</h1>
        <p className="text-sm text-muted-foreground">
          Mengubah nomor pilihan lama (①②③④ urutan asli) menjadi referensi yang otomatis mengikuti
          urutan acak di Review. Pratinjau tidak mengubah data apa pun.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void runPreview()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <PlayCircle className="size-4" />}
          Buat pratinjau
        </Button>
        {preview ? (
          <>
            <Button
              variant="outline"
              onClick={() => download(`laporan-migrasi-pembahasan-${preview.generatedAt}.json`, preview)}
            >
              <Download className="size-4" /> Unduh laporan
            </Button>
            <Button
              variant="secondary"
              disabled={changes.length === 0 || applying}
              onClick={() => setConfirmOpen(true)}
            >
              <ShieldCheck className="size-4" /> Terapkan ({changes.length} pembahasan)
            </Button>
          </>
        ) : null}
      </div>

      {preview ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Card>
              <CardContent className="p-3">
                <p className="text-[11px] text-muted-foreground">Total soal</p>
                <p className="text-lg font-semibold">{preview.totalQuestions}</p>
              </CardContent>
            </Card>
            {FILTERS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-xl border p-3 text-left ${filter === key ? "border-primary bg-primary/10" : "border-border bg-card"}`}
              >
                <p className="text-[11px] text-muted-foreground">{STATUS_LABEL[key]}</p>
                <p className="text-lg font-semibold">{counts[key]}</p>
              </button>
            ))}
          </div>

          <ul className="space-y-2">
            {visible.length === 0 ? (
              <li className="text-sm text-muted-foreground">Tidak ada soal pada kategori ini.</li>
            ) : null}
            {visible.map((r) => (
              <li key={r.question_id} className="space-y-2 rounded-xl border border-border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{STATUS_LABEL[r.status]}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {r.exams.length ? r.exams.join(", ") : "Question Bank"}
                  </span>
                </div>
                <p className="text-sm text-foreground">{r.preview || "(soal tanpa teks)"}</p>
                {r.changes.map((c, i) => (
                  <div key={i} className="grid gap-1 text-xs sm:grid-cols-2">
                    <div className="rounded-lg bg-muted/40 p-2">
                      <p className="mb-1 font-medium text-muted-foreground">Sebelum</p>
                      {richTextToPlain(c.original)}
                    </div>
                    <div className="rounded-lg bg-primary/10 p-2">
                      <p className="mb-1 font-medium text-muted-foreground">
                        Sesudah (tampil urutan asli)
                      </p>
                      {richTextToPlain(resolveChoiceTokens(c.migrated, CHOICE_LABELS))}
                    </div>
                  </div>
                ))}
                {r.issues.length > 0 ? (
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {r.issues.map((issue, i) => (
                      <li key={i}>
                        <span className="font-medium text-foreground">{issue.field}:</span>{" "}
                        {issue.detail} <span className="italic">“{issue.excerpt}”</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terapkan migrasi?</AlertDialogTitle>
            <AlertDialogDescription>
              {changes.length} pembahasan akan diubah. Teks asli disimpan sebagai cadangan dan dapat
              dipulihkan. Soal yang teksnya berubah sejak pratinjau akan dilewati. Attempt lama tidak
              diubah.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applying}>Batal</AlertDialogCancel>
            <AlertDialogAction disabled={applying} onClick={(e) => { e.preventDefault(); void runApply(); }}>
              {applying ? <Loader2 className="size-4 animate-spin" /> : null} Terapkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
