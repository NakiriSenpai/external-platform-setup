import type { ExamDifficulty } from "@/types/exam";
import type {
  GrammarTagRow,
  QuestionAnswerRow,
  QuestionOrigin,
  QuestionSourceType,
  QuestionType,
  QuestionVisibility,
  TagRow,
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
  category: string;
  difficulty: ExamDifficulty;
  lesson_id?: string | null;
  source_type?: QuestionSourceType;
  origin?: QuestionOrigin;
  question_type?: QuestionType;
  visibility?: QuestionVisibility;
  version?: number;
  is_archived?: boolean;
  grammar_tags: GrammarTagRow[];
  tags?: TagRow[];
  answers: QuestionAnswerRow[];
};
