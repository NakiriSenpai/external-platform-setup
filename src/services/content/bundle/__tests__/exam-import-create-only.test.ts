import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", async () => {
  const fake = await import("./fake-supabase");
  return { supabase: fake.supabase };
});

const { db, resetDb } = await import("./fake-supabase");
const { importExam, analyzeExamBundle } = await import("../bundle-import.service");
const { parseBundle } = await import("../bundle-schema");
type ExamFileBundle = Parameters<typeof importExam>[0];
type Row = Record<string, unknown>;

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
          slug: `import-test-${lower}`,
          title: `IMPORT TEST ${name}`,
          category: "umum",
          description: `<p>Description ${name}</p>`,
          sections: [
            { key: "s1", title: `Section ${name} 1`, type: "reading", order: 0 },
            { key: "s2", title: `Section ${name} 2`, type: "listening", order: 1 },
          ],
          question_refs: [
            { question_key: "q01", section_key: "s1", order: 0 },
            { question_key: "q02", section_key: "s2", order: 1 },
          ],
          question_bundle: [
            {
              key: "q01",
              instruction: `<p>Instruction ${name}</p>`,
              text: `<p>UNIQUE ${name} ONE</p>`,
              explanation: `<p>Explanation ${name}</p>`,
              image: { url: `https://media.example/${lower}-1.jpg` },
              answers: [
                { label: "A", order: 0, text: `${name}-correct`, is_correct: true },
                { label: "B", order: 1, text: `${name}-wrong`, is_correct: false },
              ],
            },
            {
              key: "q02",
              text: `<p>UNIQUE ${name} TWO</p>`,
              audio: { url: `https://media.example/${lower}-2.mp3` },
              answers: [
                { label: "A", order: 0, text: `${name}-wrong-2`, is_correct: false },
                { label: "B", order: 1, text: `${name}-correct-2`, is_correct: true },
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

const rows = (table: string) => (db[table] ?? []) as Row[];
const importedExam = (id: string) => rows("exams").find((row) => row["id"] === id);
const contentFor = (examId: string) => {
  const refs = rows("exam_questions").filter((row) => row["exam_id"] === examId);
  return refs.map((ref) => rows("questions").find((q) => q["id"] === ref["question_id"]));
};

describe("importExam create-only", () => {
  beforeEach(resetDb);

  it("A -> B -> C membuat tiga graph exam independen", async () => {
    const ids: string[] = [];
    for (const name of ["A", "B", "C"]) {
      const preview = await analyzeExamBundle(bundleFor(name));
      expect(preview[0]?.title).toBe(`IMPORT TEST ${name}`);
      const report = await importExam(bundleFor(name));
      expect(report.createdEntityId).toBeTruthy();
      ids.push(report.createdEntityId ?? "");
    }

    expect(new Set(ids).size).toBe(3);
    expect(rows("exams").map((row) => row["title"])).toEqual([
      "IMPORT TEST A",
      "IMPORT TEST B",
      "IMPORT TEST C",
    ]);
    ids.forEach((id, index) => {
      const name = ["A", "B", "C"][index];
      expect(contentFor(id).map((q) => q?.["text"])).toEqual([
        `<p>UNIQUE ${name} ONE</p>`,
        `<p>UNIQUE ${name} TWO</p>`,
      ]);
    });
    expect(rows("questions")).toHaveLength(6);
    expect(rows("question_answers")).toHaveLength(12);
  });

  it("A -> B -> A -> C -> B selalu create dan memberi suffix slug", async () => {
    const sequence = ["A", "B", "A", "C", "B"];
    const createdIds: string[] = [];
    for (const name of sequence) {
      const report = await importExam(bundleFor(name));
      const id = report.createdEntityId ?? "";
      createdIds.push(id);
      expect(importedExam(id)?.["title"]).toBe(`IMPORT TEST ${name}`);
      expect(contentFor(id)[0]?.["text"]).toBe(`<p>UNIQUE ${name} ONE</p>`);
    }

    expect(rows("exams").map((row) => row["slug"])).toEqual([
      "import-test-a",
      "import-test-b",
      "import-test-a-2",
      "import-test-c",
      "import-test-b-2",
    ]);
    expect(new Set(createdIds).size).toBe(5);
    expect(rows("questions")).toHaveLength(10);
    expect(rows("question_answers")).toHaveLength(20);
  });

  it("membuat ID baru dan mapping section/question/answer hanya untuk operasinya", async () => {
    const first = await importExam(bundleFor("A"));
    const second = await importExam(bundleFor("A"));
    const firstId = first.createdEntityId ?? "";
    const secondId = second.createdEntityId ?? "";
    const firstSections = rows("exam_sections").filter((r) => r["exam_id"] === firstId);
    const secondSections = rows("exam_sections").filter((r) => r["exam_id"] === secondId);
    const firstQuestions = contentFor(firstId);
    const secondQuestions = contentFor(secondId);

    expect(firstId).not.toBe(secondId);
    expect(firstSections.map((r) => r["id"])).not.toEqual(secondSections.map((r) => r["id"]));
    expect(firstQuestions.map((r) => r?.["id"])).not.toEqual(secondQuestions.map((r) => r?.["id"]));
    const firstAnswers = rows("question_answers").filter((a) => a["question_id"] === firstQuestions[0]?.["id"]);
    const secondAnswers = rows("question_answers").filter((a) => a["question_id"] === secondQuestions[0]?.["id"]);
    expect(firstAnswers.map((a) => [a["label"], a["is_correct"]])).toEqual([
      ["A", true],
      ["B", false],
    ]);
    expect(firstAnswers.map((a) => a["id"])).not.toEqual(secondAnswers.map((a) => a["id"]));
  });

  it("menolak referensi soal yang tidak dibawa file sebelum menulis data", async () => {
    await importExam(bundleFor("A"));
    const before = JSON.stringify(db);
    const broken = bundleFor("B");
    broken.data[0]?.question_bundle.pop();
    await expect(importExam(broken)).rejects.toThrow(/tidak tersedia di file/i);
    expect(JSON.stringify(db)).toBe(before);
  });

  it("menolak file dengan lebih dari satu Exam", async () => {
    const bundle = bundleFor("A");
    const second = bundleFor("B").data[0];
    if (second) bundle.data.push(second);
    await expect(importExam(bundle)).rejects.toThrow(/tepat satu Exam/i);
    expect(rows("exams")).toHaveLength(0);
  });

  it("clean-room ALPHA -> BETA -> GAMMA mempertahankan identitas sampai database", async () => {
    const identities = [
      ["ALPHA", "84721"],
      ["BETA", "59384"],
      ["GAMMA", "26173"],
    ] as const;

    const ids: string[] = [];
    for (const [name, marker] of identities) {
      const bundle = bundleFor(name);
      const exam = bundle.data[0];
      if (!exam) throw new Error("Fixture exam kosong.");
      exam.title = `CLEAN ROOM EXAM ${name} ${marker}`;
      exam.slug = `clean-room-${name.toLowerCase()}-${marker}`;
      const question = exam.question_bundle[0];
      if (!question) throw new Error("Fixture soal kosong.");
      question.text = `<p>THIS IS ${name} ${marker}</p>`;

      const report = await importExam(bundle);
      ids.push(report.createdEntityId ?? "");
    }

    expect(rows("exams").map((row) => [row["title"], row["slug"]])).toEqual([
      ["CLEAN ROOM EXAM ALPHA 84721", "clean-room-alpha-84721"],
      ["CLEAN ROOM EXAM BETA 59384", "clean-room-beta-59384"],
      ["CLEAN ROOM EXAM GAMMA 26173", "clean-room-gamma-26173"],
    ]);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(3);
    expect(ids.map((id) => contentFor(id)[0]?.["text"])).toEqual([
      "<p>THIS IS ALPHA 84721</p>",
      "<p>THIS IS BETA 59384</p>",
      "<p>THIS IS GAMMA 26173</p>",
    ]);

    const refs = rows("exam_questions");
    const questionIdsByExam = ids.map((id) =>
      refs.filter((ref) => ref["exam_id"] === id).map((ref) => ref["question_id"]),
    );
    expect(new Set(questionIdsByExam.flat()).size).toBe(questionIdsByExam.flat().length);
    expect(ids.map((id) => rows("exam_sections").filter((row) => row["exam_id"] === id).length)).toEqual([
      2, 2, 2,
    ]);
    expect(
      questionIdsByExam.map((questionIds) =>
        rows("question_answers").filter((answer) => questionIds.includes(answer["question_id"])).length,
      ),
    ).toEqual([4, 4, 4]);
  });
  it("graph penuh: TEST A dan TEST B tidak pernah bertukar question/answer", async () => {
    const build = (name: string) => {
      const bundle = bundleFor(name);
      const exam = bundle.data[0];
      if (!exam) throw new Error("Fixture exam kosong.");
      exam.title = `TEST ${name}`;
      exam.slug = `test-${name.toLowerCase()}`;
      exam.sections[0]!.title = `SECTION FROM ${name}`;
      const q1 = exam.question_bundle[0]!;
      q1.text = `QUESTION FROM ${name}`;
      q1.instruction = `INSTRUCTION FROM ${name}`;
      q1.answers = [
        { label: "A", order: 0, text: `ANSWER FROM ${name}`, is_correct: true },
        { label: "B", order: 1, text: `WRONG FROM ${name}`, is_correct: false },
      ] as never;
      return bundle;
    };

    const idA = (await importExam(build("A"))).createdEntityId ?? "";
    const idB = (await importExam(build("B"))).createdEntityId ?? "";

    const graph = (examId: string) => {
      const exam = importedExam(examId)!;
      const sections = rows("exam_sections")
        .filter((row) => row["exam_id"] === examId)
        .sort((a, b) => Number(a["order_index"]) - Number(b["order_index"]));
      const refs = rows("exam_questions")
        .filter((row) => row["exam_id"] === examId)
        .sort((a, b) => Number(a["order_index"]) - Number(b["order_index"]));
      const first = refs[0]!;
      const question = rows("questions").find((q) => q["id"] === first["question_id"])!;
      const answers = rows("question_answers")
        .filter((a) => a["question_id"] === question["id"])
        .sort((a, b) => String(a["label"]).localeCompare(String(b["label"])));
      return {
        title: exam["title"],
        sectionTitle: sections[0]!["title"],
        sectionOwned: first["section_id"] === sections[0]!["id"],
        question: question["text"],
        instruction: question["instruction"],
        answer: answers[0]!["text"],
        correct: answers[0]!["is_correct"],
        questionId: question["id"],
        answerIds: answers.map((a) => a["id"]),
      };
    };

    const a = graph(idA);
    const b = graph(idB);

    expect(a).toMatchObject({
      title: "TEST A",
      sectionTitle: "SECTION FROM A",
      sectionOwned: true,
      question: "QUESTION FROM A",
      instruction: "INSTRUCTION FROM A",
      answer: "ANSWER FROM A",
      correct: true,
    });
    expect(b).toMatchObject({
      title: "TEST B",
      sectionTitle: "SECTION FROM B",
      sectionOwned: true,
      question: "QUESTION FROM B",
      instruction: "INSTRUCTION FROM B",
      answer: "ANSWER FROM B",
      correct: true,
    });
    expect(a.questionId).not.toBe(b.questionId);
    expect(a.answerIds).not.toEqual(b.answerIds);
  });
});
