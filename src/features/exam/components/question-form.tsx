import { useEffect, useState, type FormEvent } from "react";
import {
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Loader2,
  Music,
  Trash2,
  Type as TypeIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExamMediaField } from "./media-field";
import { RichTextEditor } from "@/components/common/rich-text-editor";
import { isRichTextEmpty, richTextToPlain } from "@/lib/rich-text";
import { Switch } from "@/components/ui/switch";
import { useCreateQuestion, useUpdateQuestion } from "@/hooks/exam";
import { useAutosave } from "@/hooks/use-autosave";
import { AutosaveIndicator, useReportAutosave } from "./exam-autosave";
import { useArchiveBankQuestion, useLessons } from "@/hooks/question-bank";
import { ANSWER_LABELS } from "@/features/exam/exam.constants";
import { cn } from "@/lib/utils";
import type { ExamDifficulty } from "@/types/exam";
import { ORIGIN_LABELS, type QuestionType, type QuestionVisibility } from "@/types/question-bank";
import type { QuestionBankInput, QuestionSourceType } from "@/types/question-bank";
import type { AnswerLabel, MediaSlot, QuestionFormValue } from "./question-types";

export type QuestionFormProps = {
  /** Exam pemilik soal (Exam Studio). Kosong bila dipakai dari Lesson Studio. */
  examId?: string;
  sectionId: string;
  question?: QuestionFormValue | null;
  /** Asal soal saat dibuat (default: exam). */
  sourceType?: QuestionSourceType;
  /** ID entitas asal yang disimpan pada created_from. */
  createdFrom?: string | null;
  /** Lesson yang otomatis terhubung saat soal dibuat dari Lesson Studio. */
  defaultLessonId?: string | null;
  /** Override penyimpanan (dipakai Lesson Studio agar service form tetap satu). */
  onSubmitQuestion?: (input: QuestionBankInput, questionId: string | null) => Promise<void>;
  /** Status pending dari mutation eksternal. */
  submitting?: boolean;
  /** Dipanggil setelah simpan berhasil. */
  onDone: () => void;
  onCancel?: () => void;
  /** Ubah nilai untuk memaksa reset state form. */
  resetKey?: string | number;
};

type AnswerState = {
  label: AnswerLabel;
  text: string;
  image_url: string | null;
  audio_url: string | null;
};

const emptyAnswers = (): AnswerState[] =>
  ANSWER_LABELS.map((label) => ({ label, text: "", image_url: null, audio_url: null }));

const NO_LESSON = "none";

/**
 * Form soal (state, validasi, dan mutation) — dipakai inline oleh Exam Studio
 * dan di dalam dialog oleh Lesson Studio. Satu sumber logika soal.
 */
export function QuestionForm({
  examId,
  sectionId,
  question = null,
  sourceType = "exam",
  createdFrom,
  defaultLessonId = null,
  onSubmitQuestion,
  submitting = false,
  onDone,
  onCancel,
  resetKey,
}: QuestionFormProps) {
  const [text, setText] = useState("");
  const [instruction, setInstruction] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [showImage, setShowImage] = useState(false);
  const [showAudio, setShowAudio] = useState(false);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [generalTagIds, setGeneralTagIds] = useState<string[]>([]);
  const [newTags, setNewTags] = useState<string[]>([]);
  const [questionType, setQuestionType] = useState<QuestionType>("reading");
  const [visibility, setVisibility] = useState<QuestionVisibility>("private");
  const [isArchived, setIsArchived] = useState(false);
  // Kategori soal tidak lagi diedit di Exam Studio (hanya di Detail Exam);
  // nilai existing dipertahankan agar Question Bank/import-export tidak berubah.
  const category = question?.category ?? "umum";
  const [difficulty, setDifficulty] = useState<ExamDifficulty>("sedang");
  const [lessonId, setLessonId] = useState<string>(NO_LESSON);
  const [explanation, setExplanation] = useState("");
  const [answers, setAnswers] = useState<AnswerState[]>(emptyAnswers());
  const [answerMedia, setAnswerMedia] = useState<Record<string, MediaSlot | null>>({});
  const [correct, setCorrect] = useState<AnswerLabel>("A");
  const [error, setError] = useState<string | null>(null);

  const archiveQuestion = useArchiveBankQuestion();
  const lessonQuery = useLessons();
  const createQuestion = useCreateQuestion();
  const updateQuestion = useUpdateQuestion();
  const pending = createQuestion.isPending || updateQuestion.isPending || submitting;

  useEffect(() => {
    setError(null);
    if (question) {
      setText(question.text);
      setInstruction(question.instruction ?? "");
      setImageUrl(question.image_url);
      setAudioUrl(question.audio_url);
      setShowImage(Boolean(question.image_url));
      setShowAudio(Boolean(question.audio_url));
      setTagIds(question.grammar_tags.map((t) => t.id));
      setGeneralTagIds((question.tags ?? []).map((t) => t.id));
      setQuestionType(question.question_type ?? "reading");
      setVisibility(question.visibility ?? "private");
      setIsArchived(question.is_archived ?? false);
      setNewTags([]);
      setDifficulty(question.difficulty ?? "sedang");
      setLessonId(question.lesson_id ?? NO_LESSON);
      setExplanation(question.explanation ?? "");
      const next = ANSWER_LABELS.map((label) => {
        const found = question.answers.find((a) => a.label === label);
        return {
          label,
          text: found?.text ?? "",
          image_url: found?.image_url ?? null,
          audio_url: found?.audio_url ?? null,
        };
      });
      setAnswers(next);
      setAnswerMedia(
        Object.fromEntries(
          next.map((a) => [a.label, a.image_url ? "image" : a.audio_url ? "audio" : null]),
        ),
      );
      setCorrect(question.answers.find((a) => a.is_correct)?.label ?? "A");
    } else {
      setText("");
      setInstruction("");
      setImageUrl(null);
      setAudioUrl(null);
      setShowImage(false);
      setShowAudio(false);
      setTagIds([]);
      setGeneralTagIds([]);
      setNewTags([]);
      setQuestionType("reading");
      setVisibility("private");
      setIsArchived(false);
      setDifficulty("sedang");
      setLessonId(defaultLessonId ?? NO_LESSON);
      setExplanation("");
      setAnswers(emptyAnswers());
      setAnswerMedia({});
      setCorrect("A");
    }
  }, [question, defaultLessonId, resetKey]);

  const setAnswer = (label: AnswerLabel, patch: Partial<AnswerState>) =>
    setAnswers((prev) => prev.map((a) => (a.label === label ? { ...a, ...patch } : a)));


  /** Tukar isi dua pilihan jawaban (urutan label A–D tetap sesuai skema). */
  const swapAnswers = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= answers.length) return;
    setAnswers((prev) => {
      const next = [...prev];
      const a = next[index];
      const b = next[target];
      if (!a || !b) return prev;
      next[index] = { ...b, label: a.label };
      next[target] = { ...a, label: b.label };
      return next;
    });
  };

  const clearAnswer = (label: AnswerLabel) => {
    setAnswer(label, { text: "", image_url: null, audio_url: null });
    setAnswerMedia((prev) => ({ ...prev, [label]: null }));
  };

  /** Validasi form; mengembalikan pesan error atau null bila valid. */
  const validate = (): string | null => {
    if (isRichTextEmpty(instruction)) return "Perintah soal wajib diisi.";
    if (richTextToPlain(text).length < 3) return "Teks soal minimal 3 karakter.";
    if (isRichTextEmpty(explanation)) return "Pembahasan wajib diisi.";
    const filled = answers.filter((a) => !isRichTextEmpty(a.text) || a.image_url || a.audio_url);
    if (filled.length < 2) return "Minimal dua pilihan jawaban harus diisi.";
    if (!filled.some((a) => a.label === correct))
      return "Jawaban benar harus termasuk pilihan yang diisi.";
    return null;
  };

  const buildPayload = (): QuestionBankInput => ({
      text: text.trim(),
      instruction: instruction.trim() || null,
      image_url: imageUrl,
      audio_url: audioUrl,
      explanation: explanation.trim(),
      category,
      difficulty,
      lesson_id: lessonId === NO_LESSON ? null : lessonId,
      question_type: questionType,
      visibility,
      source_type: sourceType,
      created_from: createdFrom ?? examId ?? null,
      grammar_tag_ids: tagIds,
      tag_ids: generalTagIds,
      new_tags: newTags,
      answers: answers.map((a) => ({
        label: a.label,
        text: a.text.trim(),
        image_url: a.image_url,
        audio_url: a.audio_url,
        is_correct: a.label === correct,
      })),
  });

  const invalid = validate();
  const autosaveValue = { payload: buildPayload(), archived: isArchived };

  /** Simpan perubahan soal yang sudah ada (autosave, tanpa menutup form). */
  const persistExisting = async (value: typeof autosaveValue) => {
    if (!question) return;
    if (onSubmitQuestion) {
      await onSubmitQuestion(value.payload, question.question_id);
    } else {
      await updateQuestion.mutateAsync({ id: question.question_id, input: value.payload });
    }
    if (value.archived !== (question.is_archived ?? false)) {
      await archiveQuestion.mutateAsync({ id: question.question_id, isArchived: value.archived });
    }
  };

  const autosave = useAutosave({
    value: autosaveValue,
    enabled: Boolean(question) && !invalid,
    onSave: persistExisting,
  });
  useReportAutosave(
    `question:${question?.question_id ?? sectionId}`,
    question ? autosave.status : "idle",
    autosave.flush,
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const message = validate();
    if (message) return setError(message);

    const payload = buildPayload();

    try {
      if (onSubmitQuestion) {
        await onSubmitQuestion(payload, question?.question_id ?? null);
        if (question && isArchived !== (question.is_archived ?? false)) {
          await archiveQuestion.mutateAsync({ id: question.question_id, isArchived });
        }
        toast.success(question ? "Soal diperbarui." : "Soal ditambahkan ke Question Bank.");
      } else if (question) {
        await updateQuestion.mutateAsync({ id: question.question_id, input: payload });
        if (isArchived !== (question.is_archived ?? false)) {
          await archiveQuestion.mutateAsync({ id: question.question_id, isArchived });
        }
        toast.success("Soal diperbarui.");
      } else if (examId) {
        await createQuestion.mutateAsync({ examId, sectionId, input: payload });
        toast.success("Soal ditambahkan dan tersimpan ke Question Bank.");
      } else {
        throw new Error("Target penyimpanan soal tidak tersedia.");
      }

      autosave.markSaved(autosaveValue);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    }
  };

  const lessons = lessonQuery.data ?? [];

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Perintah Soal</Label>
        <RichTextEditor
          value={instruction}
          onChange={setInstruction}
          minRows={2}
          ariaLabel="Perintah soal"
          placeholder="Contoh: Pilihlah jawaban yang paling tepat."
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Teks Soal</Label>
        <RichTextEditor
          value={text}
          onChange={setText}
          minRows={3}
          ariaLabel="Teks soal"
          placeholder="Tulis pertanyaan di sini."
        />
      </div>

      {/* Media soal — dirender sebagai media, bukan URL mentah. */}
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <div className="min-w-0 space-y-1.5">
          <Label className="text-xs font-medium">Gambar (Opsional)</Label>
          {showImage || imageUrl ? (
            <ExamMediaField
              kind="image"
              url={imageUrl}
              uploadLabel="Unggah gambar soal"
              onChange={(url) => {
                setImageUrl(url);
                if (!url) setShowImage(false);
              }}
            />
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 w-full border-dashed text-primary"
              onClick={() => setShowImage(true)}
            >
              + Tambah Gambar
            </Button>
          )}
        </div>

        <div className="min-w-0 space-y-1.5">
          <Label className="text-xs font-medium">Audio (Opsional)</Label>
          {showAudio || audioUrl ? (
            <ExamMediaField
              kind="audio"
              url={audioUrl}
              uploadLabel="Unggah audio soal"
              onChange={(url) => {
                setAudioUrl(url);
                if (!url) setShowAudio(false);
              }}
            />
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 w-full border-dashed text-primary"
              onClick={() => setShowAudio(true)}
            >
              + Tambah Audio
            </Button>
          )}
        </div>
      </div>

      {/* Pilihan jawaban */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Pilihan Jawaban</Label>
        <RadioGroup
          value={correct}
          onValueChange={(v) => setCorrect(v as AnswerLabel)}
          className="gap-2"
        >
          {answers.map((answer, answerIndex) => {
            const media = answerMedia[answer.label] ?? null;
            return (
              <div key={answer.label} className="space-y-2 rounded-lg border border-border p-2">
                <div className="flex items-center gap-1.5">
                  <span className="grid size-7 shrink-0 place-items-center rounded-md border border-border text-xs font-semibold">
                    {answerIndex + 1}
                  </span>
                  <IconAction
                    label="Mode teks"
                    active={media === null}
                    onClick={() =>
                      setAnswerMedia((prev) => ({ ...prev, [answer.label]: null }))
                    }
                  >
                    <TypeIcon className="size-3.5" />
                  </IconAction>
                  <IconAction
                    label="Mode gambar"
                    active={media === "image"}
                    onClick={() =>
                      setAnswerMedia((prev) => ({ ...prev, [answer.label]: "image" }))
                    }
                  >
                    <ImageIcon className="size-3.5" />
                  </IconAction>
                  <IconAction
                    label="Mode audio"
                    active={media === "audio"}
                    onClick={() =>
                      setAnswerMedia((prev) => ({ ...prev, [answer.label]: "audio" }))
                    }
                  >
                    <Music className="size-3.5" />
                  </IconAction>
                  <IconAction label="Naikkan" onClick={() => swapAnswers(answerIndex, -1)}>
                    <ChevronUp className="size-3.5" />
                  </IconAction>
                  <IconAction label="Turunkan" onClick={() => swapAnswers(answerIndex, 1)}>
                    <ChevronDown className="size-3.5" />
                  </IconAction>
                  <IconAction label="Kosongkan" onClick={() => clearAnswer(answer.label)}>
                    <Trash2 className="size-3.5 text-destructive" />
                  </IconAction>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">
                    {media === "image"
                      ? "Caption Gambar"
                      : media === "audio"
                        ? "Caption Audio"
                        : "Teks Jawaban"}
                  </Label>
                  <RichTextEditor
                    value={answer.text}
                    onChange={(html) => setAnswer(answer.label, { text: html })}
                    minRows={1}
                    ariaLabel={`Teks jawaban ${answerIndex + 1}`}
                    placeholder={`Jawaban ${answerIndex + 1}`}
                  />
                </div>

                {media === "image" ? (
                  <div className="space-y-1.5">
                    <ExamMediaField
                      kind="image"
                      url={answer.image_url}
                      uploadLabel="Unggah gambar jawaban"
                      onChange={(url) => setAnswer(answer.label, { image_url: url })}
                    />
                  </div>
                ) : null}

                {media === "audio" ? (
                  <div className="space-y-1.5">
                    <ExamMediaField
                      kind="audio"
                      url={answer.audio_url}
                      uploadLabel="Unggah audio jawaban"
                      onChange={(url) => setAnswer(answer.label, { audio_url: url })}
                    />
                  </div>
                ) : null}

                <div className="flex items-center gap-2">
                  <RadioGroupItem value={answer.label} id={`correct-${answer.label}`} />
                  <Label
                    htmlFor={`correct-${answer.label}`}
                    className="text-xs font-normal text-muted-foreground"
                  >
                    Jadikan Kunci Jawaban
                  </Label>
                </div>
              </div>
            );
          })}
        </RadioGroup>
      </div>


      {question ? (
        <div className="space-y-2 rounded-lg border border-border p-2.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Version: v{question.version ?? 1}</span>
            <span>Origin: {ORIGIN_LABELS[question.origin ?? "manual"]}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="q-archive" className="text-xs font-normal">
              Arsipkan soal
            </Label>
            <Switch id="q-archive" checked={isArchived} onCheckedChange={setIsArchived} />
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          Pembahasan
        </Label>
        <RichTextEditor
          value={explanation}
          onChange={setExplanation}
          minRows={3}
          ariaLabel="Pembahasan"
          placeholder="Jelaskan alasan jawaban benar."
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Materi Terkait</Label>
        <Select value={lessonId} onValueChange={setLessonId}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Tanpa lesson" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_LESSON}>Tanpa lesson</SelectItem>
            {lessons.map((lesson) => (
              <SelectItem key={lesson.id} value={lesson.id}>
                {lesson.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {!error && question && autosave.error ? (
        <p className="text-sm text-destructive">{autosave.error}</p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        {question ? <AutosaveIndicator status={autosave.status} className="mr-auto" /> : null}

        {onCancel ? (
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>
            Batal
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Simpan Soal
        </Button>
      </div>
    </form>
  );
}

function IconAction({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted",
        active && "border-primary bg-primary/10 text-primary",
      )}
    >
      {children}
    </button>
  );
}
