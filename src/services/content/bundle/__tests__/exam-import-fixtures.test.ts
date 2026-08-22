import { beforeEach, describe, expect, it, vi } from "vitest";
import fileARaw from "./fixtures/file-a.json";
import fileBRaw from "./fixtures/file-b.json";

vi.mock("@/lib/supabase/client", async () => {
  const fake = await import("./fake-supabase");
  return { supabase: fake.supabase };
});

const { db, resetDb } = await import("./fake-supabase");
const { importExam } = await import("../bundle-import.service");
const { parseBundle } = await import("../bundle-schema");
type ExamFileBundle = Parameters<typeof importExam>[0];
type Row = Record<string, unknown>;

const rows = (table: string) => (db[table] ?? []) as Row[];

const FIXTURES = {
  A: { file: "eps_topik_set_2_generated_fixed_image_questions.json", raw: fileARaw },
  B: { file: "Set2.json", raw: fileBRaw },
} as const;

function bundleOf(name: keyof typeof FIXTURES): ExamFileBundle {
  const result = parseBundle(structuredClone(FIXTURES[name].raw), "exam");
  if (!result.ok) throw new Error(result.errors.join("; "));
  return result.bundle as ExamFileBundle;
}

/** Temporary IMPORT TRACE — dihapus setelah verifikasi produksi selesai. */
async function importWithTrace(name: keyof typeof FIXTURES) {
  const bundle = bundleOf(name);
  const exam = bundle.data[0]!;
  const rawExam = (FIXTURES[name].raw as { data: Record<string, unknown>[] }).data[0]!;
  const rawQ1 = (rawExam["question_bundle"] as Record<string, unknown>[])[0]!;
  const report = await importExam(bundle);
  const examId = report.createdEntityId ?? "";
  const firstRef = rows("exam_questions")
    .filter((row) => row["exam_id"] === examId)
    .sort((a, b) => Number(a["order_index"]) - Number(b["order_index"]))[0]!;
  const q1 = rows("questions").find((row) => row["id"] === firstRef["question_id"])!;

  // eslint-disable-next-line no-console
  console.log(
    [
      `IMPORT FILE: ${FIXTURES[name].file}`,
      `BUNDLE TITLE: ${exam.title}`,
      `BUNDLE SLUG: ${exam.slug}`,
      `CREATED EXAM ID: ${examId}`,
      `Q1 SOURCE KEY: ${exam.question_bundle[0]!.key}`,
      `Q1 SOURCE ID: ${String(rawQ1["source_id"] ?? "-")}`,
      `Q1 CREATED QUESTION ID: ${String(q1["id"])}`,
      `Q1 TEXT: ${String(q1["text"])}`,
    ].join(" | "),
  );

  return { examId, questionId: String(q1["id"]), q1Text: String(q1["text"]), title: exam.title };
}

describe("importExam dengan fixture produksi A/B", () => {
  beforeEach(resetDb);

  it("A -> B menghasilkan Exam dan Q1 yang berbeda", async () => {
    const a = await importWithTrace("A");
    const b = await importWithTrace("B");

    expect(a.q1Text).toBe("여기는 어디예요?");
    expect(b.q1Text).toBe("왕민은 사무실___ 있어요.");
    expect(a.questionId).not.toBe(b.questionId);
    expect(a.examId).not.toBe(b.examId);

    const questionIdsOf = (examId: string) =>
      new Set(
        rows("exam_questions")
          .filter((row) => row["exam_id"] === examId)
          .map((row) => String(row["question_id"])),
      );
    const idsA = questionIdsOf(a.examId);
    const idsB = questionIdsOf(b.examId);
    expect(idsA.size).toBe(40);
    expect(idsB.size).toBe(40);
    expect([...idsA].some((id) => idsB.has(id))).toBe(false);
  });

  it("A -> B -> A -> B menghasilkan 4 Exam dengan graph question sendiri", async () => {
    const results = [] as Awaited<ReturnType<typeof importWithTrace>>[];
    for (const name of ["A", "B", "A", "B"] as const) results.push(await importWithTrace(name));

    expect(new Set(results.map((r) => r.examId)).size).toBe(4);
    expect(new Set(results.map((r) => r.questionId)).size).toBe(4);
    expect(results.map((r) => r.q1Text)).toEqual([
      "여기는 어디예요?",
      "왕민은 사무실___ 있어요.",
      "여기는 어디예요?",
      "왕민은 사무실___ 있어요.",
    ]);
    expect(rows("exams").map((row) => row["slug"])).toEqual([
      "set-2",
      "chapter-1-3",
      "set-2-2",
      "chapter-1-3-2",
    ]);
    expect(rows("questions")).toHaveLength(160);
    for (const { examId } of results) {
      const refs = rows("exam_questions").filter((row) => row["exam_id"] === examId);
      expect(refs).toHaveLength(40);
      const others = rows("exam_questions").filter((row) => row["exam_id"] !== examId);
      const mine = new Set(refs.map((row) => row["question_id"]));
      expect(others.some((row) => mine.has(row["question_id"]))).toBe(false);
    }
  });
});
