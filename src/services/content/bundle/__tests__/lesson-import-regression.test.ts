import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", async () => {
  const fake = await import("./fake-supabase");
  return { supabase: fake.supabase };
});

const { db, resetDb } = await import("./fake-supabase");
const { importLesson } = await import("../bundle-import.service");
const { parseBundle } = await import("../bundle-schema");

describe("Lesson import regression", () => {
  beforeEach(resetDb);

  it("tetap mengimport lesson, section, block, dan bundled question", async () => {
    const parsed = parseBundle(
      {
        schema_version: 1,
        exported_at: new Date().toISOString(),
        exported_by: null,
        source: "test",
        bundle_type: "lesson",
        data: [
          {
            slug: "lesson-regression",
            title: "Lesson Regression",
            sections: [
              {
                key: "section-1",
                title: "Section 1",
                order: 0,
                blocks: [{ type: "paragraph", content: "Konten", order: 0 }],
                question_refs: [{ question_key: "lesson-q1", order: 0 }],
              },
            ],
            question_bundle: [
              {
                key: "lesson-q1",
                text: "Lesson question",
                answers: [
                  { label: "A", text: "Benar", is_correct: true },
                  { label: "B", text: "Salah", is_correct: false },
                ],
              },
            ],
          },
        ],
      },
      "lesson",
    );
    if (!parsed.ok || parsed.bundle.bundle_type !== "lesson") throw new Error("Invalid fixture");

    const report = await importLesson(parsed.bundle, {
      strategy: "skip",
      importBundledQuestions: true,
      allowMissingQuestions: false,
    });

    expect(report.createdEntityId).toBeTruthy();
    expect(db["lessons"]).toHaveLength(1);
    expect(db["lesson_sections"]).toHaveLength(1);
    expect(db["lesson_blocks"]).toHaveLength(1);
    expect(db["lesson_questions"]).toHaveLength(1);
    expect(db["questions"]).toHaveLength(1);
    expect(db["question_answers"]).toHaveLength(2);
  });
});