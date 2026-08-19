import {
  attachQuestionsToExam,
  createExam,
  createSection,
  getExam,
  listQuestions,
  listSections,
} from "@/services/exam";
import { toSlug } from "@/features/exam/exam.constants";
import type { ExamRow } from "@/types/exam";

/**
 * Duplikat exam memakai service CRUD yang sudah ada (tanpa logika DB baru).
 * Section disalin berurutan, soal tetap referensi ke Question Bank.
 */
export async function duplicateExam(exam: ExamRow): Promise<ExamRow> {
  const source = await getExam(exam.id);
  const suffix = Date.now().toString(36).slice(-4);

  const created = await createExam({
    title: `${source.title} (Salinan)`,
    slug: toSlug(`${source.slug}-salinan-${suffix}`),
    category: source.category,
    description: source.description ?? "",
    difficulty: source.difficulty,
    passing_score: source.passing_score,
    duration_minutes: source.duration_minutes,
    status: "draft",
    shuffle_questions: source.shuffle_questions,
    shuffle_answers: source.shuffle_answers,
    icon_url: source.icon_url ?? null,
  });

  const sections = await listSections(source.id);
  for (const section of sections) {
    await createSection(created.id, {
      type: section.type,
      title: section.title,
      instruction: section.instruction ?? "",
    });
  }

  const newSections = await listSections(created.id);
  const questions = await listQuestions(source.id);

  for (const [index, section] of sections.entries()) {
    const target = newSections[index];
    if (!target) continue;
    const ids = questions.filter((q) => q.section_id === section.id).map((q) => q.question_id);
    if (ids.length > 0) await attachQuestionsToExam(created.id, target.id, ids);
  }

  return created;
}
