import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileJson, Upload, XCircle } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { recordContentIoAudit } from "@/services/content/bundle/audit.service";
import type { BundleType } from "@/services/content/bundle/bundle-schema";
import {
  analyzeExamBundle,
  analyzeLessonBundle,
  analyzeQuestionBundle,
  importExam,
  importLesson,
  importQuestions,
  readBundleFile,
  validateBundle,
  type ConflictStrategy,
  type ExamImportPreview,
  type ImportResultReport,
  type LessonImportPreview,
  type QuestionImportPreview,
} from "@/services/content/bundle/bundle-import.service";

type Step = "pick" | "preview" | "running" | "done";

const TITLES: Record<BundleType, string> = {
  question_bank: "Import Question Bank",
  exam: "Import Exam",
  lesson: "Import Lesson",
};

const STRATEGY_LABELS: Record<ConflictStrategy, string> = {
  skip: "Lewati (aman, default)",
  update: "Perbarui data lama",
  create_new: "Buat sebagai soal baru",
};

type PreviewState =
  | { kind: "question_bank"; questions: QuestionImportPreview }
  | { kind: "exam"; exams: ExamImportPreview[] }
  | { kind: "lesson"; lessons: LessonImportPreview[] };

export function ImportBundleDialog({
  open,
  onOpenChange,
  bundleType,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bundleType: BundleType;
  onImported?: () => void;
}) {
  const [step, setStep] = useState<Step>("pick");
  const [errors, setErrors] = useState<string[]>([]);
  const [parsed, setParsed] = useState<unknown>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [strategy, setStrategy] = useState<ConflictStrategy>("skip");
  const [allowMissingLesson, setAllowMissingLesson] = useState(true);
  const [importBundled, setImportBundled] = useState(true);
  const [allowMissingQuestions, setAllowMissingQuestions] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResultReport | null>(null);
  const [fileName, setFileName] = useState("");

  const reset = () => {
    setStep("pick");
    setErrors([]);
    setParsed(null);
    setPreview(null);
    setProgress(0);
    setResult(null);
    setFileName("");
  };

  const close = (value: boolean) => {
    if (step === "running") return;
    if (!value) reset();
    onOpenChange(value);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setErrors([]);
    const read = await readBundleFile(file);
    if (!read.ok) {
      setErrors(read.errors);
      return;
    }
    const validation = validateBundle(read.raw, bundleType);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    const bundle = validation.bundle;
    try {
      if (bundle.bundle_type === "question_bank") {
        setPreview({ kind: "question_bank", questions: await analyzeQuestionBundle(bundle) });
      } else if (bundle.bundle_type === "exam") {
        setPreview({ kind: "exam", exams: await analyzeExamBundle(bundle) });
      } else {
        setPreview({ kind: "lesson", lessons: await analyzeLessonBundle(bundle) });
      }
      setParsed(bundle);
      setStep("preview");
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Gagal menganalisis bundle."]);
    }
  };

  const blocked = useMemo(() => {
    if (!preview) return true;
    if (preview.kind === "question_bank") return preview.questions.total === 0;
    if (preview.kind === "exam") {
      const exam = preview.exams[0];
      if (!exam) return true;
      const unresolved = exam.missingKeys.filter(
        (key) => !(importBundled && exam.resolvableFromBundle.includes(key)),
      );
      return unresolved.length > 0 && !allowMissingQuestions;
    }
    const lesson = preview.lessons[0];
    if (!lesson) return true;
    const unresolved = lesson.missingKeys.filter(
      (key) => !(importBundled && lesson.resolvableFromBundle.includes(key)),
    );
    return unresolved.length > 0 && !allowMissingQuestions;
  }, [preview, importBundled, allowMissingQuestions]);

  const runImport = async () => {
    if (!preview || !parsed) return;
    setStep("running");
    setProgress(0);
    const onProgress = (done: number, total: number) =>
      setProgress(total === 0 ? 100 : Math.round((done / total) * 100));

    try {
      let report: ImportResultReport;
      if (preview.kind === "question_bank") {
        report = await importQuestions(preview.questions, {
          strategy,
          allowMissingLesson,
          onProgress,
        });
      } else if (preview.kind === "exam") {
        report = await importExam(parsed as never, {
          strategy,
          importBundledQuestions: importBundled,
          allowMissingQuestions,
          onProgress,
        });
      } else {
        report = await importLesson(parsed as never, {
          strategy,
          importBundledQuestions: importBundled,
          allowMissingQuestions,
          onProgress,
        });
      }
      setProgress(100);
      setResult(report);
      setStep("done");
      void recordContentIoAudit({
        action:
          bundleType === "question_bank"
            ? "import_question_bundle"
            : bundleType === "exam"
              ? "import_exam"
              : "import_lesson",
        entity: fileName,
        count: report.imported + report.updated,
        result: report.failed > 0 ? "partial" : "success",
        detail: {
          imported: report.imported,
          updated: report.updated,
          skipped: report.skipped,
          failed: report.failed,
        },
      });
      onImported?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import gagal.";
      setErrors([message]);
      setStep("preview");
      toast.error(message);
      void recordContentIoAudit({
        action:
          bundleType === "question_bank"
            ? "import_question_bundle"
            : bundleType === "exam"
              ? "import_exam"
              : "import_lesson",
        entity: fileName,
        count: 0,
        result: "failed",
        detail: { message },
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{TITLES[bundleType]}</DialogTitle>
          <DialogDescription>
            Bundle JSON divalidasi terlebih dahulu. Tidak ada data yang ditulis sebelum kamu
            menekan tombol import.
          </DialogDescription>
        </DialogHeader>

        {step === "pick" ? (
          <div className="space-y-3">
            <Label htmlFor="bundle-file">Pilih file bundle (.json)</Label>
            <Input
              id="bundle-file"
              type="file"
              accept="application/json,.json"
              className="min-h-11"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
            <p className="text-xs text-muted-foreground">Maksimal 8 MB per file.</p>
          </div>
        ) : null}

        {errors.length > 0 ? (
          <ul className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            {errors.slice(0, 12).map((message, index) => (
              <li key={index} className="flex gap-2">
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{message}</span>
              </li>
            ))}
            {errors.length > 12 ? <li>…dan {errors.length - 12} error lainnya.</li> : null}
          </ul>
        ) : null}

        {step === "preview" && preview ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <FileJson className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{fileName}</span>
            </div>

            {preview.kind === "question_bank" ? (
              <QuestionPreviewPanel preview={preview.questions} />
            ) : null}
            {preview.kind === "exam" && preview.exams[0] ? (
              <EntityPreviewPanel
                title={preview.exams[0].title}
                slug={preview.exams[0].slug}
                slugTaken={preview.exams[0].slugTaken}
                stats={[
                  ["Section", preview.exams[0].sectionCount],
                  ["Referensi soal", preview.exams[0].questionRefCount],
                  ["Soal ditemukan", preview.exams[0].resolvedKeys.length],
                  ["Soal hilang", preview.exams[0].missingKeys.length],
                ]}
                questionPreview={preview.exams[0].questionPreview}
              />
            ) : null}
            {preview.kind === "lesson" && preview.lessons[0] ? (
              <EntityPreviewPanel
                title={preview.lessons[0].title}
                slug={preview.lessons[0].slug}
                slugTaken={preview.lessons[0].slugTaken}
                stats={[
                  ["Section", preview.lessons[0].sectionCount],
                  ["Block konten", preview.lessons[0].blockCount],
                  ["Referensi soal", preview.lessons[0].questionRefCount],
                  ["Soal hilang", preview.lessons[0].missingKeys.length],
                ]}
                questionPreview={preview.lessons[0].questionPreview}
              />
            ) : null}

            <div className="space-y-3 rounded-lg border p-3">
              <div className="space-y-1">
                <Label>Jika data sudah ada</Label>
                <Select value={strategy} onValueChange={(v) => setStrategy(v as ConflictStrategy)}>
                  <SelectTrigger className="min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STRATEGY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {preview.kind === "question_bank" ? (
                <ToggleRow
                  label="Tetap import walau lesson tidak ditemukan"
                  hint="Soal akan diimport tanpa keterkaitan lesson."
                  checked={allowMissingLesson}
                  onChange={setAllowMissingLesson}
                />
              ) : (
                <>
                  <ToggleRow
                    label="Import soal yang menyertai bundle"
                    hint="Soal baru dimasukkan ke Question Bank sebelum relasi dibuat."
                    checked={importBundled}
                    onChange={setImportBundled}
                  />
                  <ToggleRow
                    label="Lanjutkan walau ada soal yang hilang"
                    hint="Soal yang tidak ditemukan akan dilewati."
                    checked={allowMissingQuestions}
                    onChange={setAllowMissingQuestions}
                  />
                </>
              )}
            </div>

            {bundleType !== "question_bank" ? (
              <p className="text-xs text-muted-foreground">
                Hasil import selalu berstatus <strong>draft</strong> dan tidak langsung terlihat
                oleh siswa.
              </p>
            ) : null}
          </div>
        ) : null}

        {step === "running" ? (
          <div className="space-y-2 py-4">
            <p className="text-sm">Mengimport konten… jangan tutup halaman ini.</p>
            <Progress value={progress} />
          </div>
        ) : null}

        {step === "done" && result ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Import selesai
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <Stat label="Baru" value={result.imported} />
              <Stat label="Diperbarui" value={result.updated} />
              <Stat label="Dilewati" value={result.skipped} />
              <Stat label="Gagal" value={result.failed} />
            </div>
            {result.failures.length > 0 ? (
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-3 text-xs text-muted-foreground">
                {result.failures.map((failure, index) => (
                  <li key={index}>
                    <span className="font-medium">{failure.label}</span> — {failure.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          {step === "preview" ? (
            <>
              <Button variant="outline" className="min-h-11" onClick={reset}>
                Ganti file
              </Button>
              <Button className="min-h-11" disabled={blocked} onClick={() => void runImport()}>
                <Upload className="mr-2 h-4 w-4" />
                Import sekarang
              </Button>
            </>
          ) : null}
          {step === "done" || step === "pick" ? (
            <Button variant="outline" className="min-h-11" onClick={() => close(false)}>
              Tutup
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-2 text-center">
      <p className="text-base font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function QuestionPreviewPanel({ preview }: { preview: QuestionImportPreview }) {
  const invalid = preview.items.filter((item) => item.status === "invalid");
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Total" value={preview.total} />
        <Stat label="Baru" value={preview.newCount} />
        <Stat label="Sudah ada" value={preview.existingCount} />
        <Stat label="Tidak valid" value={preview.invalidCount} />
      </div>
      {preview.missingLessons.length > 0 ? (
        <p className="flex items-start gap-2 text-xs text-amber-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {preview.missingLessons.length} lesson referensi tidak ditemukan:{" "}
          {preview.missingLessons.slice(0, 3).join(", ")}
        </p>
      ) : null}
      {preview.mediaWarnings > 0 ? (
        <p className="flex items-start gap-2 text-xs text-amber-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {preview.mediaWarnings} media tidak dapat diverifikasi.
        </p>
      ) : null}
      {invalid.length > 0 ? (
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-3 text-xs">
          {invalid.slice(0, 20).map((item) => (
            <li key={item.key}>
              <span className="font-medium">{item.label}</span> —{" "}
              {item.issues
                .filter((i) => i.severity === "error")
                .map((i) => i.message)
                .join(" ")}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function EntityPreviewPanel({
  title,
  slug,
  slugTaken,
  stats,
  questionPreview,
}: {
  title: string;
  slug: string;
  slugTaken: boolean;
  stats: [string, number][];
  questionPreview: QuestionImportPreview | null;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1 rounded-lg border p-3">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">slug: {slug}</p>
        {slugTaken ? (
          <Badge variant="outline" className="text-amber-400">
            Slug sudah dipakai — akan dibuat slug baru
          </Badge>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <Stat key={label} label={label} value={value} />
        ))}
      </div>
      {questionPreview ? <QuestionPreviewPanel preview={questionPreview} /> : null}
    </div>
  );
}
