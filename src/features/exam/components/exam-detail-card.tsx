import { useCallback, useEffect, useMemo, useState } from "react";
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
import { RichTextEditor } from "@/components/common/rich-text-editor";
import { richTextToPlain } from "@/lib/rich-text";
import { useAutosave } from "@/hooks/use-autosave";
import { AutosaveIndicator, useReportAutosave } from "./exam-autosave";
import { ExamCategoryField } from "./exam-category-field";
import { ExamIconField } from "./exam-icon-field";
import { useUpdateExam } from "@/hooks/exam";
import { EXAM_DIFFICULTY_LABELS, toSlug } from "@/features/exam/exam.constants";
import type { ExamDifficulty, ExamRow } from "@/types/exam";

type Props = { exam: ExamRow };

/** Kartu "Detail Exam" — form inline dengan autosave (tanpa tombol simpan manual). */
export function ExamDetailCard({ exam }: Props) {
  const updateExam = useUpdateExam();
  const [title, setTitle] = useState(exam.title);
  const [slug, setSlug] = useState(exam.slug);
  const [category, setCategory] = useState(exam.category);
  const [description, setDescription] = useState(exam.description ?? "");
  const [duration, setDuration] = useState(String(exam.duration_minutes));
  const [passingScore, setPassingScore] = useState(String(exam.passing_score));
  const [difficulty, setDifficulty] = useState<ExamDifficulty>(exam.difficulty);
  const [iconUrl, setIconUrl] = useState(exam.icon_url ?? "");
  const [shuffleQuestions, setShuffleQuestions] = useState(exam.shuffle_questions);
  const [shuffleAnswers, setShuffleAnswers] = useState(exam.shuffle_answers);

  useEffect(() => {
    setTitle(exam.title);
    setSlug(exam.slug);
    setCategory(exam.category);
    setDescription(exam.description ?? "");
    setDuration(String(exam.duration_minutes));
    setPassingScore(String(exam.passing_score));
    setDifficulty(exam.difficulty);
    setIconUrl(exam.icon_url ?? "");
    setShuffleQuestions(exam.shuffle_questions);
    setShuffleAnswers(exam.shuffle_answers);
  }, [exam.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const draft = useMemo(
    () => ({
      title,
      slug,
      category,
      description,
      duration,
      passingScore,
      difficulty,
      iconUrl,
      shuffleQuestions,
      shuffleAnswers,
    }),
    [
      title,
      slug,
      category,
      description,
      duration,
      passingScore,
      difficulty,
      iconUrl,
      shuffleQuestions,
      shuffleAnswers,
    ],
  );

  /** Validasi ringan — hanya menahan autosave, tidak memblokir pengetikan. */
  const invalid = useMemo(() => {
    const nextTitle = title.trim();
    const nextSlug = toSlug(slug || title);
    const scoreValue = Number(passingScore);
    const durationValue = Number(duration);
    if (nextTitle.length < 3) return "Judul minimal 3 karakter.";
    if (nextSlug.length < 3) return "Slug minimal 3 karakter.";
    if (!Number.isFinite(scoreValue) || scoreValue < 0 || scoreValue > 100) {
      return "Passing score harus antara 0 dan 100.";
    }
    if (!Number.isFinite(durationValue) || durationValue < 1 || durationValue > 600) {
      return "Durasi harus antara 1 dan 600 menit.";
    }
    return null;
  }, [title, slug, passingScore, duration]);

  const save = useCallback(
    async (value: typeof draft) => {
      await updateExam.mutateAsync({
        id: exam.id,
        input: {
          title: value.title.trim(),
          slug: toSlug(value.slug || value.title),
          category: value.category,
          description: richTextToPlain(value.description) ? value.description : "",
          difficulty: value.difficulty,
          passing_score: Math.round(Number(value.passingScore)),
          duration_minutes: Math.round(Number(value.duration)),
          shuffle_questions: value.shuffleQuestions,
          shuffle_answers: value.shuffleAnswers,
          icon_url: value.iconUrl || null,
        },
      });
    },
    [exam.id, updateExam],
  );

  const autosave = useAutosave({
    value: draft,
    onSave: save,
    delay: 800,
    enabled: !invalid,
  });
  useReportAutosave(`exam-detail:${exam.id}`, autosave.status, autosave.flush);

  return (
    <section className="min-w-0 space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Detail Exam</h2>
        <AutosaveIndicator status={autosave.status} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="exam-title" className="text-xs font-medium">
          Judul Exam
        </Label>
        <Input id="exam-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="exam-slug" className="text-xs font-medium">
          Slug
        </Label>
        <Input id="exam-slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
      </div>

      <ExamCategoryField value={category} onChange={setCategory} />

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Deskripsi</Label>
        <RichTextEditor
          value={description}
          onChange={setDescription}
          minRows={3}
          ariaLabel="Deskripsi exam"
          placeholder="Deskripsi singkat ujian."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="exam-duration" className="text-xs font-medium">
            Durasi (menit)
          </Label>
          <Input
            id="exam-duration"
            inputMode="numeric"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="exam-score" className="text-xs font-medium">
            Passing Score
          </Label>
          <Input
            id="exam-score"
            inputMode="numeric"
            value={passingScore}
            onChange={(e) => setPassingScore(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Tingkat Kesulitan</Label>
        <Select value={difficulty} onValueChange={(v) => setDifficulty(v as ExamDifficulty)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(EXAM_DIFFICULTY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ExamIconField value={iconUrl} onChange={setIconUrl} />

      <div className="space-y-2 rounded-xl border border-border p-3">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="shuffle-q" className="text-xs font-normal">
            Acak Soal
          </Label>
          <Switch id="shuffle-q" checked={shuffleQuestions} onCheckedChange={setShuffleQuestions} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="shuffle-a" className="text-xs font-normal">
            Acak Jawaban
          </Label>
          <Switch id="shuffle-a" checked={shuffleAnswers} onCheckedChange={setShuffleAnswers} />
        </div>
      </div>

      <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
        Nilai total ujian selalu <span className="font-medium text-foreground">100</span> dan dibagi
        rata otomatis ke seluruh soal. Perubahan tersimpan otomatis.
      </p>

      {invalid ? <p className="text-sm text-destructive">{invalid}</p> : null}
      {autosave.error ? <p className="text-sm text-destructive">{autosave.error}</p> : null}
    </section>
  );
}
