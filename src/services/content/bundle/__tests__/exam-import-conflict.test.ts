import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", async () => {
  const fake = await import("./fake-supabase");
  return { supabase: fake.supabase };
});

const { db, resetDb } = await import("./fake-supabase");
const { importExam, analyzeExamBundle } = await import("../bundle-import.service");
const { parseBundle } = await import("../bundle-schema");
type ExamFileBundle = Parameters<typeof importExam>[0];

/** Bundle exam dengan key soal generik (q1) — persis kasus nyata user. */
function bundleFor(name: string): ExamFileBundle {
  const lower = name.toLowerCase();
  const result = parseBundle(
    {
      schema_version: 1,
      exported_at: new Date().toISOString(),
      exported_by: null,
      source: "test",
      bundle_type: "exam",
      data: [
        {
          slug: `import-${lower}`,
          title: `IMPORT ${name}`,
          category: "umum",
          description: `desc ${name}`,
          sections: [{ key: "s1", title: `Section ${name}`, type: "reading", order: 0 }],
          question_refs: [{ question_key: "q01", section_key: "s1", order: 0 }],
          question_bundle: [
            {
              key: "q01",
              text: `${name}${name}${name}`,
              answers: [
                { label: "A", text: `${name}-benar`, is_correct: true },
                { label: "B", text: `${name}-salah`, is_correct: false },
              ],
            },
          ],
        },
      ],
    },
    "exam",
  );
  if (!result.ok) throw new Error(result.errors.join("; "));
  return result.bundle as ExamFileBundle;
}

const opts = (strategy: "skip" | "update" | "create_new") => ({
  strategy,
  importBundledQuestions: true,
  allowMissingQuestions: false,
});

const exams = () => (db["exams"] ?? []) as { id: string; slug: string; title: string }[];
const questions = () => (db["questions"] ?? []) as { id: string; text: string }[];
const examQuestionText = (slug: string) => {
  const exam = exams().find((e) => e.slug === slug)!;
  const refs = (db["exam_questions"] ?? []).filter((r) => r["exam_id"] === exam.id);
  return refs.map((r) => questions().find((q) => q.id === r["question_id"])!.text);
};

describe("import exam — isolasi & conflict resolution", () => {
  beforeEach(resetDb);

  it("A -> B -> C menghasilkan tiga exam independen", async () => {
    for (const name of ["A", "B", "C"]) {
      await importExam(bundleFor(name), opts("skip"));
    }
    expect(exams().map((e) => e.title)).toEqual(["IMPORT A", "IMPORT B", "IMPORT C"]);
    expect(examQuestionText("import-a")).toEqual(["AAA"]);
    expect(examQuestionText("import-b")).toEqual(["BBB"]);
    expect(examQuestionText("import-c")).toEqual(["CCC"]);
    // soal q1 dari tiap file TIDAK saling menimpa
    expect(questions()).toHaveLength(3);
  });

  it("A -> B -> C -> A -> C -> B: setiap import memakai file terbarunya", async () => {
    for (const name of ["A", "B", "C", "A", "C", "B"]) {
      const report = await importExam(bundleFor(name), opts("create_new"));
      const exam = exams().find((e) => e.id === report.createdEntityId)!;
      expect(exam.title).toBe(`IMPORT ${name}`);
      const refs = (db["exam_questions"] ?? []).filter((r) => r["exam_id"] === exam.id);
      const text = questions().find((q) => q.id === refs[0]!["question_id"])!.text;
      expect(text).toBe(`${name}${name}${name}`);
    }
  });

  it("LEWATI: import ulang B tidak mengubah A maupun B", async () => {
    await importExam(bundleFor("A"), opts("skip"));
    await importExam(bundleFor("B"), opts("skip"));
    const before = JSON.stringify({ exams: exams(), questions: questions() });

    const report = await importExam(bundleFor("B"), opts("skip"));
    expect(report.skipped).toBeGreaterThan(0);
    expect(report.imported).toBe(0);
    expect(JSON.stringify({ exams: exams(), questions: questions() })).toBe(before);
    expect(examQuestionText("import-a")).toEqual(["AAA"]);
  });

  it("PERBARUI DATA LAMA: hanya entity dengan identity sama yang diubah", async () => {
    await importExam(bundleFor("A"), opts("update"));
    await importExam(bundleFor("B"), opts("update"));

    const modifiedB = bundleFor("B");
    modifiedB.data[0]!.title = "IMPORT B REV2";
    await importExam(modifiedB, opts("update"));

    expect(exams()).toHaveLength(2);
    expect(exams().find((e) => e.slug === "import-a")!.title).toBe("IMPORT A");
    expect(exams().find((e) => e.slug === "import-b")!.title).toBe("IMPORT B REV2");
    expect(examQuestionText("import-a")).toEqual(["AAA"]);
    expect(examQuestionText("import-b")).toEqual(["BBB"]);
  });

  it("BUAT SEBAGAI SOAL BARU: konten berasal dari file terbaru, soal lama utuh", async () => {
    await importExam(bundleFor("A"), opts("create_new"));
    await importExam(bundleFor("B"), opts("create_new"));
    const report = await importExam(bundleFor("B"), opts("create_new"));

    const exam = exams().find((e) => e.id === report.createdEntityId)!;
    expect(exam.title).toBe("IMPORT B");
    expect(exam.slug).toBe("import-b-2");
    expect(examQuestionText("import-a")).toEqual(["AAA"]);
    expect(examQuestionText(exam.slug)).toEqual(["BBB"]);
    // soal baru dibuat, tidak menimpa soal A/B lama
    expect(questions()).toHaveLength(3);
  });

  it("preview cocok dengan eksekusi (soal dari bundle tidak dianggap hilang)", async () => {
    const parsed = bundleFor("B");
    const [preview] = await analyzeExamBundle(parsed);
    expect(preview!.title).toBe("IMPORT B");
    expect(preview!.missingKeys).toEqual([]);
    const report = await importExam(parsed, opts("skip"));
    expect(exams().find((e) => e.id === report.createdEntityId)!.title).toBe("IMPORT B");
  });

  it("allowMissingQuestions OFF membatalkan import dan tidak meninggalkan exam", async () => {
    const parsed = bundleFor("C");
    parsed.data[0]!.question_bundle = [];
    await expect(importExam(parsed, opts("skip"))).rejects.toThrow(
      /tidak ditemukan/i,
    );
    expect(exams()).toHaveLength(0);
  });

  it("allowMissingQuestions ON melanjutkan dan melaporkan soal hilang", async () => {
    const parsed = bundleFor("C");
    parsed.data[0]!.question_bundle = [];
    const report = await importExam(parsed, {
      ...opts("skip"),
      allowMissingQuestions: true,
    });
    expect(report.skipped).toBe(1);
    expect(report.failures[0]!.reason).toMatch(/Tidak ditemukan/);
    expect(exams()).toHaveLength(1);
    expect((db["exam_questions"] ?? [])).toHaveLength(0);
  });

  it("importBundledQuestions OFF tidak membuat/mengubah soal apa pun", async () => {
    const report = await importExam(bundleFor("A"), {
      strategy: "skip",
      importBundledQuestions: false,
      allowMissingQuestions: true,
    });
    expect(report.imported).toBe(1); // exam saja
    expect(questions()).toHaveLength(0);
    expect((db["exam_questions"] ?? [])).toHaveLength(0);
  });
});
