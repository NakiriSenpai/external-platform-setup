import type {
  QuestionAnswerRow,
  QuestionOrigin,
  QuestionSourceType,
} from "@/types/question-bank";

export type MediaSlot = "image" | "audio";
export type { AnswerLabel, ExamQuestionWithAnswers } from "@/types/exam";

/**
 * Bentuk minimal soal yang dapat dimuat ke QuestionFormDialog.
 * Dipakai bersama oleh Exam Studio dan Lesson Studio agar form soal
 * tidak perlu diimplementasi ulang.
 */
export type QuestionFormValue = {
  question_id: string;
  text: string;
  instruction?: string | null;
  image_url: string | null;
  audio_url: string | null;
  explanation: string | null;
  lesson_id?: string | null;
  source_type?: QuestionSourceType;
  origin?: QuestionOrigin;
  version?: number;
  is_archived?: boolean;
  answers: QuestionAnswerRow[];
};
